// Edge Function (Deno) — fora de `src/`, fora do typecheck/test/build do
// projeto. Único lugar autorizado a usar `SUPABASE_SERVICE_ROLE_KEY`, que
// nunca pode chegar ao navegador. Deploy manual: `supabase functions deploy
// admin-users` — ver o guia de configuração para o passo a passo completo.
import { createClient } from 'npm:@supabase/supabase-js@2'

type Role = 'user' | 'admin'

interface AdminUserSummary {
  id: string
  email: string
  role: Role
  createdAt: string
  lastSignInAt: string | null
  disabled: boolean
}

type RequestBody =
  | { action: 'list' }
  | { action: 'create'; email: string; password: string; role: Role }
  | { action: 'disable'; userId: string }
  | { action: 'enable'; userId: string }
  | { action: 'reset_password'; userId: string; password?: string }
  | { action: 'set_role'; userId: string; role: Role }
  | { action: 'delete_user'; userId: string }
  | { action: 'invite'; email: string; role: Role; redirectTo: string }
  | { action: 'list_audit'; limit?: number }
  | { action: 'get_defaults' }
  | { action: 'set_defaults'; categories: unknown; budgets: unknown }
  | { action: 'reset_mfa'; userId: string }

// A origem `*.github.io` real do deploy, mais `localhost` para desenvolvimento.
// Defesa em profundidade: a proteção de fato é a verificação de papel abaixo,
// não esta lista — uma requisição forjada fora do navegador não passa por CORS.
function isAllowedOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin)
    return hostname === 'localhost' || hostname.endsWith('.github.io')
  } catch {
    return false
  }
}

/*
 * `authorization` e `content-type` não bastam: o `supabase-js` manda também
 * `apikey` e `x-client-info` em toda chamada. Um cabeçalho pedido no
 * preflight e ausente desta lista faz o navegador abortar a requisição real,
 * e o preflight ainda assim responde 200 — o que faz a falha parecer queda de
 * rede em vez de CORS, e foi exatamente onde esta função travou na primeira
 * publicação.
 */
const CABECALHOS_PERMITIDOS = 'authorization, content-type, apikey, x-client-info'

function corsHeaders(origin: string | null): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin && isAllowedOrigin(origin) ? origin : 'null',
    'Access-Control-Allow-Headers': CABECALHOS_PERMITIDOS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}

/**
 * Registra uma ação no histórico.
 *
 * Nunca interrompe a ação que a originou: o `catch` vazio é deliberado. Se a
 * tabela de auditoria estiver indisponível, o certo é a conta ter sido criada
 * sem registro, e não a criação falhar por causa do registro. O histórico é
 * consequência da ação, não condição dela.
 */
async function registrar(
  admin: ReturnType<typeof createClient>,
  entrada: {
    actorId: string
    actorEmail: string
    action: string
    targetId?: string | null
    targetEmail?: string | null
    detail?: string | null
  },
): Promise<void> {
  try {
    await admin.from('admin_audit_log').insert({
      actor_id: entrada.actorId,
      actor_email: entrada.actorEmail,
      action: entrada.action,
      target_id: entrada.targetId ?? null,
      target_email: entrada.targetEmail ?? null,
      detail: entrada.detail ?? null,
    })
  } catch {
    // Ver acima.
  }
}

/** E-mail de uma conta, para o histórico não guardar só um identificador. */
async function emailDe(
  admin: ReturnType<typeof createClient>,
  userId: string,
): Promise<string | null> {
  try {
    const { data } = await admin.auth.admin.getUserById(userId)
    return data.user?.email ?? null
  } catch {
    return null
  }
}

/** Quantos administradores ativos existem. Usado pelas travas de segurança. */
async function contarAdmins(admin: ReturnType<typeof createClient>): Promise<number> {
  const { count, error } = await admin
    .from('profiles')
    .select('id', { count: 'exact', head: true })
    .eq('role', 'admin')

  // Na dúvida, trava. Deixar passar por causa de uma consulta que falhou é o
  // caminho mais curto para uma plataforma sem nenhum administrador.
  if (error) return 1
  return count ?? 1
}

/*
 * O mesmo mínimo que o Supabase aplica por padrão. Exigir mais aqui do que o
 * servidor de autenticação exige criaria duas regras para a mesma senha, e a
 * pessoa descobriria a segunda só quando a primeira já tivesse passado.
 */
const MINIMO_SENHA = 6

function generateTemporaryPassword(): string {
  const bytes = new Uint8Array(12)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (byte) => byte.toString(36).padStart(2, '0'))
    .join('')
    .slice(0, 16)
}

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) })
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Método não suportado.' }, 405, origin)
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return json({ ok: false, error: 'Sessão ausente.' }, 401, origin)
  }
  const jwt = authHeader.replace(/^Bearer\s+/i, '')

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  // 1. Confirma que o JWT pertence a uma sessão válida.
  const { data: callerData, error: callerError } = await admin.auth.getUser(jwt)
  if (callerError || !callerData.user) {
    return json({ ok: false, error: 'Sessão inválida.' }, 401, origin)
  }

  // 2. Confirma o papel — via service role, que ignora RLS de propósito
  //    (precisa poder ler o perfil de QUALQUER chamador, não só o dele).
  //    Nenhuma ação privilegiada roda antes desta checagem.
  const { data: callerProfile, error: profileError } = await admin
    .from('profiles')
    .select('role')
    .eq('id', callerData.user.id)
    .maybeSingle()

  if (profileError || callerProfile?.role !== 'admin') {
    return json({ ok: false, error: 'Acesso restrito a administradores.' }, 403, origin)
  }

  const autor = { actorId: callerData.user.id, actorEmail: callerData.user.email ?? '' }

  let body: RequestBody
  try {
    body = await req.json()
  } catch {
    return json({ ok: false, error: 'Corpo da requisição inválido.' }, 400, origin)
  }

  try {
    switch (body.action) {
      case 'list': {
        const { data, error } = await admin.auth.admin.listUsers({ perPage: 200 })
        if (error) throw error

        const { data: profiles, error: profilesError } = await admin.from('profiles').select('id, role')
        if (profilesError) throw profilesError

        const roleById = new Map<string, Role>(
          (profiles ?? []).map((profile) => [profile.id as string, profile.role as Role]),
        )

        const users: AdminUserSummary[] = data.users.map((user) => ({
          id: user.id,
          email: user.email ?? '',
          role: roleById.get(user.id) ?? 'user',
          createdAt: user.created_at,
          lastSignInAt: user.last_sign_in_at ?? null,
          disabled: Boolean(user.banned_until) && new Date(user.banned_until as string).getTime() > Date.now(),
        }))

        return json({ ok: true, users }, 200, origin)
      }

      case 'create': {
        const { email, password, role } = body
        if (!email || !password || password.length < 6) {
          return json(
            { ok: false, error: 'E-mail e senha (mínimo 6 caracteres) são obrigatórios.' },
            400,
            origin,
          )
        }

        const { data, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        })
        if (error || !data.user) throw error ?? new Error('Falha ao criar usuário.')

        // O gatilho `handle_new_user` já criou o perfil como 'user'; só marca
        // admin se foi pedido.
        if (role === 'admin') {
          const { error: updateError } = await admin
            .from('profiles')
            .update({ role: 'admin' })
            .eq('id', data.user.id)
          if (updateError) throw updateError
        }

        const user: AdminUserSummary = {
          id: data.user.id,
          email: data.user.email ?? email,
          role,
          createdAt: data.user.created_at,
          lastSignInAt: null,
          disabled: false,
        }

        await registrar(admin, {
          ...autor,
          action: 'create',
          targetId: data.user.id,
          targetEmail: user.email,
          detail: role === 'admin' ? 'como administrador' : 'como usuário',
        })

        return json({ ok: true, user }, 200, origin)
      }

      case 'disable': {
        // NOTA: confira este formato contra a versão instalada do SDK — a API
        // de ban do GoTrue já mudou de forma entre versões.
        const { error } = await admin.auth.admin.updateUserById(body.userId, {
          ban_duration: '876000h',
        })
        if (error) throw error

        await registrar(admin, {
          ...autor,
          action: 'disable',
          targetId: body.userId,
          targetEmail: await emailDe(admin, body.userId),
        })
        return json({ ok: true }, 200, origin)
      }

      case 'enable': {
        const { error } = await admin.auth.admin.updateUserById(body.userId, { ban_duration: 'none' })
        if (error) throw error

        await registrar(admin, {
          ...autor,
          action: 'enable',
          targetId: body.userId,
          targetEmail: await emailDe(admin, body.userId),
        })
        return json({ ok: true }, 200, origin)
      }

      case 'reset_password': {
        /*
         * A senha escolhida pelo admin é validada aqui, e não só no navegador.
         * Validação de cliente é conveniência: quem chama esta função direto,
         * sem passar pela tela, contornaria qualquer regra que só existisse
         * lá.
         */
        const escolhida = typeof body.password === 'string' ? body.password : null
        if (escolhida !== null && escolhida.length < MINIMO_SENHA) {
          return json(
            { ok: false, error: `A senha precisa de pelo menos ${MINIMO_SENHA} caracteres.` },
            400,
            origin,
          )
        }

        const temporaryPassword = escolhida ?? generateTemporaryPassword()
        const { error } = await admin.auth.admin.updateUserById(body.userId, {
          password: temporaryPassword,
        })
        if (error) throw error

        await registrar(admin, {
          ...autor,
          action: 'reset_password',
          targetId: body.userId,
          targetEmail: await emailDe(admin, body.userId),
          // O registro diz como a senha nasceu, nunca qual ela é. Um histórico
          // que guarda senha é um vazamento com data de validade longa.
          detail: escolhida ? 'definida pelo administrador' : 'gerada automaticamente',
        })
        return json({ ok: true, temporaryPassword }, 200, origin)
      }

      case 'set_role': {
        // Rebaixar o último admin deixaria a plataforma sem ninguém capaz de
        // promover outro: a recuperação só existiria por SQL no painel do
        // Supabase. A trava está aqui, e não na interface, porque a interface
        // não é o único jeito de chamar esta função.
        if (body.role === 'user' && (await contarAdmins(admin)) <= 1) {
          return json(
            { ok: false, error: 'Esta é a única conta de administrador. Promova outra antes.' },
            409,
            origin,
          )
        }

        const { error } = await admin.from('profiles').update({ role: body.role }).eq('id', body.userId)
        if (error) throw error

        await registrar(admin, {
          ...autor,
          action: 'set_role',
          targetId: body.userId,
          targetEmail: await emailDe(admin, body.userId),
          detail: body.role === 'admin' ? 'promovido a administrador' : 'rebaixado a usuário',
        })
        return json({ ok: true }, 200, origin)
      }

      case 'delete_user': {
        if (body.userId === callerData.user.id) {
          return json({ ok: false, error: 'Você não pode excluir a própria conta.' }, 409, origin)
        }

        const { data: alvo } = await admin
          .from('profiles')
          .select('role')
          .eq('id', body.userId)
          .maybeSingle()

        if (alvo?.role === 'admin' && (await contarAdmins(admin)) <= 1) {
          return json(
            { ok: false, error: 'Esta é a única conta de administrador.' },
            409,
            origin,
          )
        }

        // `profiles` e `user_finance_data` caem junto pelo `on delete cascade`
        // do schema: excluir a conta apaga os dados financeiros dela também,
        // sem este código precisar tocar neles (nem poder lê-los).
        // O e-mail é lido antes da exclusão: depois dela não há mais de onde
        // tirá-lo, e um histórico que só guarda o identificador de uma conta
        // que não existe mais não conta nada a ninguém.
        const emailAlvo = await emailDe(admin, body.userId)

        const { error } = await admin.auth.admin.deleteUser(body.userId)
        if (error) throw error

        await registrar(admin, {
          ...autor,
          action: 'delete_user',
          targetId: body.userId,
          targetEmail: emailAlvo,
        })
        return json({ ok: true }, 200, origin)
      }

      /*
       * Convite por link.
       *
       * `generateLink` devolve o endereço sem enviar e-mail nenhum, e é isso
       * que faz esta funcionalidade existir sem SMTP configurado: quem
       * administra copia o link e repassa pelo canal que já usa. A diferença
       * para `create` é quem escolhe a senha — aqui é a própria pessoa, o que
       * elimina a senha temporária circulando por aí.
       */
      case 'invite': {
        const { email, role, redirectTo } = body
        if (!email) return json({ ok: false, error: 'Informe o e-mail.' }, 400, origin)

        const { data, error } = await admin.auth.admin.generateLink({
          type: 'invite',
          email,
          options: { redirectTo },
        })
        if (error || !data.properties) throw error ?? new Error('Falha ao gerar o convite.')

        if (role === 'admin' && data.user) {
          const { error: updateError } = await admin
            .from('profiles')
            .update({ role: 'admin' })
            .eq('id', data.user.id)
          if (updateError) throw updateError
        }

        await registrar(admin, {
          ...autor,
          action: 'invite',
          targetId: data.user?.id ?? null,
          targetEmail: email,
          detail: role === 'admin' ? 'como administrador' : 'como usuário',
        })

        return json({ ok: true, inviteLink: data.properties.action_link }, 200, origin)
      }

      case 'list_audit': {
        const limite = Math.min(Math.max(body.limit ?? 100, 1), 500)
        const { data, error } = await admin
          .from('admin_audit_log')
          .select('id, actor_email, action, target_email, detail, created_at')
          .order('created_at', { ascending: false })
          .limit(limite)
        if (error) throw error

        return json({ ok: true, entries: data ?? [] }, 200, origin)
      }

      case 'get_defaults': {
        const { data, error } = await admin
          .from('app_defaults')
          .select('categories, budgets')
          .eq('id', 1)
          .maybeSingle()
        if (error) throw error

        return json(
          { ok: true, defaults: { categories: data?.categories ?? null, budgets: data?.budgets ?? null } },
          200,
          origin,
        )
      }

      case 'set_defaults': {
        const { error } = await admin
          .from('app_defaults')
          .update({ categories: body.categories, budgets: body.budgets, updated_at: new Date().toISOString() })
          .eq('id', 1)
        if (error) throw error

        await registrar(admin, { ...autor, action: 'set_defaults' })
        return json({ ok: true }, 200, origin)
      }

      /*
       * Remove os fatores de dois passos de uma conta.
       *
       * É a saída para quem perdeu o aparelho com o autenticador: sem isso, a
       * própria segurança vira uma tranca sem chave, e a única recuperação
       * seria apagar a conta com os dados dentro. Fica com o administrador, e
       * não com a pessoa, porque um "esqueci meu segundo fator" que qualquer
       * um dispara sozinho não é um segundo fator.
       */
      case 'reset_mfa': {
        const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: body.userId })
        if (error) throw error

        const fatores = data?.factors ?? []
        for (const fator of fatores) {
          const { error: erroRemocao } = await admin.auth.admin.mfa.deleteFactor({
            id: fator.id,
            userId: body.userId,
          })
          if (erroRemocao) throw erroRemocao
        }

        await registrar(admin, {
          ...autor,
          action: 'reset_mfa',
          targetId: body.userId,
          targetEmail: await emailDe(admin, body.userId),
          detail: `${fatores.length} fator(es) removido(s)`,
        })

        return json({ ok: true, removidos: fatores.length }, 200, origin)
      }

      default:
        return json({ ok: false, error: 'Ação desconhecida.' }, 400, origin)
    }
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : 'Falha ao processar a ação.'
    return json({ ok: false, error: message }, 500, origin)
  }
})
