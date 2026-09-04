// Edge Function (Deno) — fora de `src/`, fora do typecheck/test/build do
// projeto. Único lugar autorizado a usar `SUPABASE_SERVICE_ROLE_KEY`, que
// nunca pode chegar ao navegador. Deploy manual: `supabase functions deploy
// admin-users` — ver o guia de configuração para o passo a passo completo.
//
// A chave de serviço ignora RLS por definição: dentro deste arquivo o banco
// não protege nada, e toda a proteção é o código abaixo. Por isso a ordem é
// sempre a mesma e não tem exceção — sessão válida, segundo fator quando a
// conta o exige, papel de administrador, freio de repetição, validação da
// entrada, e só então a ação.
import type { SupabaseClient, User } from 'npm:@supabase/supabase-js@2'
import { autenticar, clienteDeServico, ehAdministrador } from '../_shared/auth.ts'
import { json, lerCorpoJson, origemPermitida, preflight } from '../_shared/http.ts'
import { dentroDoLimite } from '../_shared/limite.ts'
import {
  ehEmail,
  ehPapel,
  ehUuid,
  redirecionamentoPermitido,
  tamanhoDeJson,
  textoLimitado,
} from '../_shared/validacao.ts'

type Role = 'user' | 'admin'

interface AdminUserSummary {
  id: string
  email: string
  role: Role
  createdAt: string
  lastSignInAt: string | null
  disabled: boolean
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
  admin: SupabaseClient,
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
async function emailDe(admin: SupabaseClient, userId: string): Promise<string | null> {
  try {
    const { data } = await admin.auth.admin.getUserById(userId)
    return data.user?.email ?? null
  } catch {
    return null
  }
}

/** Quantos administradores ativos existem. Usado pelas travas de segurança. */
async function contarAdmins(admin: SupabaseClient): Promise<number> {
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

/*
 * Teto de senha. O bcrypt do GoTrue trunca em 72 bytes, então nada além disso
 * acrescenta força — mas um campo sem limite é um corpo grande aceito de
 * graça, e hash de senha é justamente a operação cara.
 */
const MAXIMO_SENHA = 128

/*
 * Teto dos padrões da plataforma. São listas de categorias e limites por
 * categoria: alguns quilobytes na prática. O teto existe porque a coluna é
 * `jsonb` sem limite próprio, e quem administra também pode errar um `paste`.
 */
const MAXIMO_DEFAULTS = 128 * 1024

/*
 * Freio por administrador. Generoso para o painel (que lista, abre fichas e
 * exporta), apertado o bastante para um laço não virar mil contas criadas.
 */
const LIMITE_DE_ACOES = 60
const JANELA_MS = 60_000

/*
 * O mesmo alfabeto do sorteio da tela (`ResetPasswordDialog`): sem `0`, `O`,
 * `l` e `1`, porque esta senha vai ser ditada ou copiada à mão por alguém, e
 * caractere ambíguo vira um chamado de suporte.
 */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
const COMPRIMENTO_SORTEADO = 16

/** Ver a nota em `ResetPasswordDialog`: descarta o resto que enviesaria o módulo. */
const TETO = Math.floor(256 / ALFABETO.length) * ALFABETO.length

function generateTemporaryPassword(): string {
  const escolhidos: string[] = []

  while (escolhidos.length < COMPRIMENTO_SORTEADO) {
    const bytes = new Uint8Array(COMPRIMENTO_SORTEADO)
    crypto.getRandomValues(bytes)

    for (const byte of bytes) {
      if (byte >= TETO) continue
      escolhidos.push(ALFABETO[byte % ALFABETO.length])
      if (escolhidos.length === COMPRIMENTO_SORTEADO) break
    }
  }

  return escolhidos.join('')
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') return preflight(origin)
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Método não suportado.' }, 405, origin)
  }

  /*
   * Origem recusada para de ser só um cabeçalho de resposta.
   *
   * O CORS sozinho protege o **navegador de outra pessoa**: a resposta chega e
   * ele a descarta. Mas a ação já aconteceu — a conta já foi criada, a senha já
   * foi trocada. Recusar antes de agir é o que transforma a lista de origens em
   * decisão de servidor. Chamada sem `Origin` (script, `curl`) continua
   * passando: ela nunca foi o que o CORS endereça, e para ela a barreira é o
   * JWT com papel de administrador.
   */
  if (origin !== null && !origemPermitida(origin)) {
    return json({ ok: false, error: 'Origem não autorizada.' }, 403, origin)
  }

  const admin = clienteDeServico()

  // 1. Sessão válida — e, quando a conta tem aplicativo autenticador, sessão
  //    que já passou por ele. Uma sessão `aal1` de conta com segundo fator é
  //    meia entrada, e meia entrada no painel de administração é entrada.
  const autenticacao = await autenticar(req, admin)
  if (!autenticacao.ok) {
    return json({ ok: false, error: autenticacao.erro }, autenticacao.status, origin)
  }
  const autor = {
    actorId: autenticacao.chamador.id,
    actorEmail: autenticacao.chamador.email,
  }

  // 2. Papel de administrador, lido com a chave de serviço porque precisa
  //    poder ler o perfil de QUALQUER chamador, e não só o dele. Nenhuma ação
  //    privilegiada roda antes desta checagem.
  if (!(await ehAdministrador(admin, autenticacao.chamador.id))) {
    return json({ ok: false, error: 'Acesso restrito a administradores.' }, 403, origin)
  }

  if (!dentroDoLimite(`admin:${autenticacao.chamador.id}`, LIMITE_DE_ACOES, JANELA_MS)) {
    return json(
      { ok: false, error: 'Muitas ações em pouco tempo. Espere um minuto e tente de novo.' },
      429,
      origin,
    )
  }

  const body = await lerCorpoJson<Record<string, unknown>>(req)
  if (!body) {
    return json({ ok: false, error: 'Corpo da requisição inválido.' }, 400, origin)
  }

  /*
   * O identificador do alvo, validado como UUID antes de virar consulta.
   *
   * `.eq('id', body.userId)` com um valor de tipo inesperado é erro do
   * PostgREST, não brecha — mas o erro nasce lá dentro, com mensagem de banco,
   * e chega ao cliente como falha de servidor. Recusar aqui devolve 400 com
   * uma frase que diz o que houve.
   */
  const alvoId = ehUuid(body.userId) ? (body.userId as string) : null
  const exigirAlvo = () =>
    json({ ok: false, error: 'Identificador de conta inválido.' }, 400, origin)

  try {
    switch (body.action) {
      case 'list': {
        /*
         * A listagem é paginada, e antes não era.
         *
         * `listUsers({ perPage: 200 })` devolve a **primeira** página e mais
         * nada. Com 201 contas, a de número 201 simplesmente não aparecia no
         * painel — não havia erro, aviso ou reticências, e quem procurasse por
         * ela concluiria que foi excluída. Um limite que ninguém vê é pior do
         * que um limite baixo.
         *
         * O teto de páginas existe pelo mesmo motivo do teto de páginas da
         * Pluggy: guardar contra laço, e não contra volume. Dez páginas são
         * duas mil contas, ordens de grandeza acima do que esta instalação
         * comporta.
         */
        const todas: User[] = []
        const MAXIMO_DE_PAGINAS = 10

        for (let pagina = 1; pagina <= MAXIMO_DE_PAGINAS; pagina += 1) {
          const { data, error } = await admin.auth.admin.listUsers({ page: pagina, perPage: 200 })
          if (error) throw error

          todas.push(...data.users)
          // Página incompleta é a última: pedir a seguinte devolveria vazio.
          if (data.users.length < 200) break
        }

        const { data: profiles, error: profilesError } = await admin
          .from('profiles')
          .select('id, role')
        if (profilesError) throw profilesError

        const roleById = new Map<string, Role>(
          (profiles ?? []).map((profile) => [profile.id as string, profile.role as Role]),
        )

        const users: AdminUserSummary[] = todas.map((user) => ({
          id: user.id,
          email: user.email ?? '',
          role: roleById.get(user.id) ?? 'user',
          createdAt: user.created_at,
          lastSignInAt: user.last_sign_in_at ?? null,
          disabled:
            Boolean(user.banned_until) &&
            new Date(user.banned_until as string).getTime() > Date.now(),
        }))

        return json({ ok: true, users }, 200, origin)
      }

      case 'create': {
        const email = ehEmail(body.email) ? (body.email as string) : null
        const password = typeof body.password === 'string' ? body.password : ''
        const role: Role = ehPapel(body.role) ? body.role : 'user'

        if (!email) return json({ ok: false, error: 'Informe um e-mail válido.' }, 400, origin)
        if (password.length < MINIMO_SENHA || password.length > MAXIMO_SENHA) {
          return json(
            {
              ok: false,
              error: `A senha precisa ter entre ${MINIMO_SENHA} e ${MAXIMO_SENHA} caracteres.`,
            },
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
        if (!alvoId) return exigirAlvo()

        /*
         * As mesmas duas travas de `delete_user`, e pelo mesmo motivo.
         *
         * Elas faltavam aqui, e a falta era real: desativar a própria conta
         * derruba quem está usando o painel, e desativar o último
         * administrador deixa a plataforma sem ninguém capaz de reativá-lo. O
         * conserto dos dois casos só existiria por SQL no painel do Supabase —
         * que é exatamente o que uma trava evita precisar.
         */
        if (alvoId === autenticacao.chamador.id) {
          return json({ ok: false, error: 'Você não pode desativar a própria conta.' }, 409, origin)
        }

        const { data: alvo } = await admin
          .from('profiles')
          .select('role')
          .eq('id', alvoId)
          .maybeSingle()

        if (alvo?.role === 'admin' && (await contarAdmins(admin)) <= 1) {
          return json(
            { ok: false, error: 'Esta é a única conta de administrador. Promova outra antes.' },
            409,
            origin,
          )
        }

        // NOTA: confira este formato contra a versão instalada do SDK — a API
        // de ban do GoTrue já mudou de forma entre versões.
        const { error } = await admin.auth.admin.updateUserById(alvoId, {
          ban_duration: '876000h',
        })
        if (error) throw error

        await registrar(admin, {
          ...autor,
          action: 'disable',
          targetId: alvoId,
          targetEmail: await emailDe(admin, alvoId),
        })
        return json({ ok: true }, 200, origin)
      }

      case 'enable': {
        if (!alvoId) return exigirAlvo()

        const { error } = await admin.auth.admin.updateUserById(alvoId, { ban_duration: 'none' })
        if (error) throw error

        await registrar(admin, {
          ...autor,
          action: 'enable',
          targetId: alvoId,
          targetEmail: await emailDe(admin, alvoId),
        })
        return json({ ok: true }, 200, origin)
      }

      case 'reset_password': {
        if (!alvoId) return exigirAlvo()

        /*
         * A senha escolhida pelo admin é validada aqui, e não só no navegador.
         * Validação de cliente é conveniência: quem chama esta função direto,
         * sem passar pela tela, contornaria qualquer regra que só existisse
         * lá.
         */
        const escolhida = typeof body.password === 'string' ? body.password : null
        if (
          escolhida !== null &&
          (escolhida.length < MINIMO_SENHA || escolhida.length > MAXIMO_SENHA)
        ) {
          return json(
            {
              ok: false,
              error: `A senha precisa ter entre ${MINIMO_SENHA} e ${MAXIMO_SENHA} caracteres.`,
            },
            400,
            origin,
          )
        }

        const temporaryPassword = escolhida ?? generateTemporaryPassword()
        const { error } = await admin.auth.admin.updateUserById(alvoId, {
          password: temporaryPassword,
        })
        if (error) throw error

        await registrar(admin, {
          ...autor,
          action: 'reset_password',
          targetId: alvoId,
          targetEmail: await emailDe(admin, alvoId),
          // O registro diz como a senha nasceu, nunca qual ela é. Um histórico
          // que guarda senha é um vazamento com data de validade longa.
          detail: escolhida ? 'definida pelo administrador' : 'gerada automaticamente',
        })
        return json({ ok: true, temporaryPassword }, 200, origin)
      }

      case 'set_role': {
        if (!alvoId) return exigirAlvo()
        if (!ehPapel(body.role)) {
          return json({ ok: false, error: 'Papel inválido.' }, 400, origin)
        }
        const papel = body.role

        // Rebaixar o último admin deixaria a plataforma sem ninguém capaz de
        // promover outro: a recuperação só existiria por SQL no painel do
        // Supabase. A trava está aqui, e não na interface, porque a interface
        // não é o único jeito de chamar esta função.
        if (papel === 'user' && (await contarAdmins(admin)) <= 1) {
          return json(
            { ok: false, error: 'Esta é a única conta de administrador. Promova outra antes.' },
            409,
            origin,
          )
        }

        const { error } = await admin.from('profiles').update({ role: papel }).eq('id', alvoId)
        if (error) throw error

        await registrar(admin, {
          ...autor,
          action: 'set_role',
          targetId: alvoId,
          targetEmail: await emailDe(admin, alvoId),
          detail: papel === 'admin' ? 'promovido a administrador' : 'rebaixado a usuário',
        })
        return json({ ok: true }, 200, origin)
      }

      case 'delete_user': {
        if (!alvoId) return exigirAlvo()

        if (alvoId === autenticacao.chamador.id) {
          return json({ ok: false, error: 'Você não pode excluir a própria conta.' }, 409, origin)
        }

        const { data: alvo } = await admin
          .from('profiles')
          .select('role')
          .eq('id', alvoId)
          .maybeSingle()

        if (alvo?.role === 'admin' && (await contarAdmins(admin)) <= 1) {
          return json({ ok: false, error: 'Esta é a única conta de administrador.' }, 409, origin)
        }

        // `profiles` e `user_finance_data` caem junto pelo `on delete cascade`
        // do schema: excluir a conta apaga os dados financeiros dela também,
        // sem este código precisar tocar neles (nem poder lê-los).
        // O e-mail é lido antes da exclusão: depois dela não há mais de onde
        // tirá-lo, e um histórico que só guarda o identificador de uma conta
        // que não existe mais não conta nada a ninguém.
        const emailAlvo = await emailDe(admin, alvoId)

        const { error } = await admin.auth.admin.deleteUser(alvoId)
        if (error) throw error

        await registrar(admin, {
          ...autor,
          action: 'delete_user',
          targetId: alvoId,
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
        const email = ehEmail(body.email) ? (body.email as string) : null
        if (!email) return json({ ok: false, error: 'Informe um e-mail válido.' }, 400, origin)

        const role: Role = ehPapel(body.role) ? body.role : 'user'

        /*
         * O destino do convite é conferido contra a mesma lista do CORS.
         *
         * O link carrega um token de uso único que cria a sessão. Um destino
         * escolhido livremente por quem chama entregaria esse token ao
         * servidor de outra pessoa — e quem clicou teria dado a conta achando
         * que a estava criando. O Supabase também filtra por `Redirect URLs`
         * do projeto, mas depender só disso é depender de uma configuração que
         * este código não controla e não consegue conferir.
         */
        const redirectTo = redirecionamentoPermitido(body.redirectTo, origemPermitida)
        if (!redirectTo) {
          return json({ ok: false, error: 'Endereço de retorno não autorizado.' }, 400, origin)
        }

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
        const pedido = typeof body.limit === 'number' && Number.isFinite(body.limit) ? body.limit : 100
        const limite = Math.min(Math.max(Math.trunc(pedido), 1), 500)

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
          {
            ok: true,
            defaults: { categories: data?.categories ?? null, budgets: data?.budgets ?? null },
          },
          200,
          origin,
        )
      }

      case 'set_defaults': {
        const tamanho = tamanhoDeJson({ categories: body.categories, budgets: body.budgets })
        if (tamanho === null || tamanho > MAXIMO_DEFAULTS) {
          return json({ ok: false, error: 'Os padrões enviados são grandes demais.' }, 413, origin)
        }

        const { error } = await admin
          .from('app_defaults')
          .update({
            categories: body.categories ?? null,
            budgets: body.budgets ?? null,
            updated_at: new Date().toISOString(),
          })
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
        if (!alvoId) return exigirAlvo()

        const { data, error } = await admin.auth.admin.mfa.listFactors({ userId: alvoId })
        if (error) throw error

        const fatores = data?.factors ?? []
        for (const fator of fatores) {
          const { error: erroRemocao } = await admin.auth.admin.mfa.deleteFactor({
            id: fator.id,
            userId: alvoId,
          })
          if (erroRemocao) throw erroRemocao
        }

        await registrar(admin, {
          ...autor,
          action: 'reset_mfa',
          targetId: alvoId,
          targetEmail: await emailDe(admin, alvoId),
          detail: `${fatores.length} fator(es) removido(s)`,
        })

        return json({ ok: true, removidos: fatores.length }, 200, origin)
      }

      default:
        return json({ ok: false, error: 'Ação desconhecida.' }, 400, origin)
    }
  } catch (cause) {
    /*
     * A mensagem interna fica no log, e não na resposta.
     *
     * Antes ela era repassada inteira. O que vem de `cause.message` aqui é
     * texto do Postgres ou do GoTrue: nome de coluna, restrição violada,
     * trecho da consulta. Para quem administra não diz nada acionável; para
     * quem sonda, desenha o schema de graça. O que a tela precisa saber é que
     * a ação não aconteceu.
     */
    const detalhe = cause instanceof Error ? cause.message : String(cause)
    console.error('admin-users:', textoLimitado(body.action, 40) ?? 'sem ação', detalhe)

    return json({ ok: false, error: 'Não foi possível concluir a ação.' }, 500, origin)
  }
})
