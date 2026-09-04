/*
 * Quem está chamando, e com que nível de garantia.
 *
 * Duas perguntas diferentes que as funções faziam pela metade: a sessão era
 * validada, mas o **nível** dela não. Uma conta com aplicativo autenticador
 * cadastrado devolve sessão logo depois da senha — ela existe, é válida, e vale
 * `aal1`. Aceitá-la aqui faria a verificação em duas etapas ser um obstáculo de
 * tela: quem tivesse só a senha continuaria alcançando o servidor direto, sem
 * nunca digitar o código.
 */
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'

export interface Chamador {
  id: string
  email: string
  /** Nível alcançado por esta sessão: `aal1` (senha) ou `aal2` (segundo fator). */
  aal: string
}

export type ResultadoDeAutenticacao =
  | { ok: true; chamador: Chamador }
  | { ok: false; status: number; erro: string }

/**
 * O payload do JWT, sem verificar assinatura.
 *
 * Seguro **só** depois de `auth.getUser()` ter aprovado o mesmo token: é ele
 * quem prova a autenticidade contra o servidor de autenticação. Aqui o
 * interesse é um campo que a resposta do `getUser` não traz — o `aal` —, e
 * decodificar o que já foi provado autêntico não reabre nada.
 */
function lerAal(jwt: string): string {
  try {
    const payload = jwt.split('.')[1]
    if (!payload) return 'aal1'
    const normalizado = payload.replaceAll('-', '+').replaceAll('_', '/')
    const preenchido = normalizado.padEnd(Math.ceil(normalizado.length / 4) * 4, '=')
    const { aal } = JSON.parse(atob(preenchido)) as { aal?: unknown }
    return typeof aal === 'string' ? aal : 'aal1'
  } catch {
    // Na dúvida, o nível mais baixo: erra para o lado de pedir o segundo fator.
    return 'aal1'
  }
}

/**
 * Se a conta tem aplicativo autenticador confirmado.
 *
 * Consultada **apenas** quando a sessão está em `aal1`. Quem já apresentou o
 * segundo fator não paga por esta chamada, e ela é justamente a mais cara do
 * caminho.
 */
async function temSegundoFatorVerificado(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  try {
    const { data, error } = await admin.auth.admin.mfa.listFactors({ userId })
    if (error) {
      // Falha ao consultar não pode virar "não tem fator": seria transformar
      // uma indisponibilidade em porta aberta para a conta mais protegida do
      // sistema. Na dúvida, exige o segundo fator.
      console.error('auth: falha ao listar fatores', error.message)
      return true
    }
    return (data?.factors ?? []).some((fator) => fator.status === 'verified')
  } catch (causa) {
    console.error('auth: falha ao listar fatores', causa)
    return true
  }
}

/**
 * Valida a sessão do cabeçalho `Authorization` e devolve quem é.
 *
 * Recusa, nesta ordem: sem cabeçalho, token que o servidor de autenticação não
 * reconhece, e sessão em `aal1` de uma conta que tem segundo fator cadastrado.
 */
export async function autenticar(
  req: Request,
  admin: SupabaseClient,
): Promise<ResultadoDeAutenticacao> {
  const cabecalho = req.headers.get('authorization')
  if (!cabecalho) return { ok: false, status: 401, erro: 'Sessão ausente.' }

  const jwt = cabecalho.replace(/^Bearer\s+/i, '').trim()
  if (!jwt) return { ok: false, status: 401, erro: 'Sessão ausente.' }

  const { data, error } = await admin.auth.getUser(jwt)
  if (error || !data.user) return { ok: false, status: 401, erro: 'Sessão inválida.' }

  const aal = lerAal(jwt)

  if (aal !== 'aal2' && (await temSegundoFatorVerificado(admin, data.user.id))) {
    return {
      ok: false,
      status: 401,
      erro: 'Esta conta exige a verificação em duas etapas. Entre de novo e digite o código.',
    }
  }

  return {
    ok: true,
    chamador: { id: data.user.id, email: data.user.email ?? '', aal },
  }
}

/** Confirma que o chamador é administrador. Consulta feita com a chave de serviço. */
export async function ehAdministrador(
  admin: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await admin
    .from('profiles')
    .select('role')
    .eq('id', userId)
    .maybeSingle()

  // Erro de consulta nega o acesso. O contrário — deixar passar porque a
  // pergunta falhou — é como uma falha de banco vira escalada de privilégio.
  if (error) {
    console.error('auth: falha ao ler o papel', error.message)
    return false
  }
  return data?.role === 'admin'
}

/** Cliente com a chave de serviço. Nunca deve ser criado fora de uma função. */
export function clienteDeServico(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL') ?? ''
  const chave = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  return createClient(url, chave, {
    // Nada de sessão aqui: este cliente é o servidor agindo como servidor, e
    // uma sessão persistida entre requisições de pessoas diferentes seria
    // exatamente o vazamento que a chave de serviço torna caro.
    auth: { persistSession: false, autoRefreshToken: false },
  })
}
