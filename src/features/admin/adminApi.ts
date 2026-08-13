import { supabase } from '@/data/supabaseClient'
import type { Role } from '@/store/authStore'

export interface AdminUserSummary {
  id: string
  email: string
  role: Role
  createdAt: string
  lastSignInAt: string | null
  disabled: boolean
}

type AdminUsersRequest =
  | { action: 'list' }
  | { action: 'create'; email: string; password: string; role: Role }
  | { action: 'disable'; userId: string }
  | { action: 'enable'; userId: string }
  | { action: 'reset_password'; userId: string; password?: string }
  | { action: 'set_role'; userId: string; role: Role }
  | { action: 'delete_user'; userId: string }
  | { action: 'invite'; email: string; role: Role; redirectTo: string }
  | { action: 'list_audit'; limit?: number }
  | { action: 'reset_mfa'; userId: string }

export interface AuditEntry {
  id: number
  actor_email: string
  action: string
  target_email: string | null
  detail: string | null
  created_at: string
}

type AdminUsersResponse =
  | { ok: true; users: AdminUserSummary[] }
  | { ok: true; user: AdminUserSummary }
  | { ok: true; temporaryPassword: string }
  | { ok: true; inviteLink: string }
  | { ok: true; entries: AuditEntry[] }
  | { ok: true }
  | { ok: false; error: string }

/**
 * Fala com a Edge Function `admin-users` — o único lugar autorizado a usar a
 * `service_role key` do Supabase. Aqui só o JWT da sessão viaja (o
 * `supabase-js` já anexa isso sozinho); a função valida `role === 'admin'`
 * do lado do servidor antes de qualquer ação privilegiada.
 */
async function call(body: AdminUsersRequest): Promise<AdminUsersResponse> {
  const { data, error } = await supabase.functions.invoke<AdminUsersResponse>('admin-users', {
    body,
  })

  if (error) throw new Error(await describeError(error))
  if (!data) throw new Error('O servidor de administração respondeu vazio.')
  if (data.ok === false) throw new Error(data.error)

  return data
}

/**
 * Traduz a falha do `invoke` em algo que se possa agir a respeito.
 *
 * Duas armadilhas aqui, e a segunda custou caro. A primeira: `invoke` trata
 * **qualquer** resposta fora da faixa 2xx como erro e devolve `data` nulo, o
 * que significa que as recusas deliberadas da função (403 de quem não é
 * admin, 409 do último administrador) não passam pelo caminho normal. A
 * mensagem que o servidor escreveu com cuidado está no corpo da resposta
 * pendurada em `context`, e sem lê-la de volta toda recusa viraria o mesmo
 * "não foi possível" genérico.
 *
 * A segunda: a falha mais provável nesta instalação não é nenhuma delas, e
 * sim a função não estar publicada. Um 404 aqui não é defeito do aplicativo,
 * é uma etapa de configuração que falta, e dizer isso poupa a caçada.
 */
async function describeError(error: unknown): Promise<string> {
  const contexto = (error as { context?: unknown }).context

  if (contexto instanceof Response) {
    if (contexto.status === 404) {
      return 'A função "admin-users" ainda não foi publicada no Supabase. Veja a Etapa 2 do SETUP.md.'
    }

    // O corpo só pode ser lido uma vez; o clone deixa o original intacto para
    // quem quiser inspecionar depois.
    try {
      const corpo = (await contexto.clone().json()) as { error?: unknown }
      if (typeof corpo.error === 'string' && corpo.error) return corpo.error
    } catch {
      // Resposta sem JSON: cai nas mensagens por status, abaixo.
    }

    if (contexto.status === 401) return 'Sua sessão expirou. Entre de novo.'
    if (contexto.status === 403) return 'Esta conta não tem permissão de administrador.'
    return `O servidor de administração respondeu com erro ${contexto.status}.`
  }

  return 'Não foi possível alcançar o servidor de administração. Verifique sua conexão.'
}

export async function listUsers(): Promise<AdminUserSummary[]> {
  const result = await call({ action: 'list' })
  if (!('users' in result)) throw new Error('Resposta inesperada ao listar usuários.')
  return result.users
}

export async function createUser(input: {
  email: string
  password: string
  role: Role
}): Promise<AdminUserSummary> {
  const result = await call({ action: 'create', ...input })
  if (!('user' in result)) throw new Error('Resposta inesperada ao criar usuário.')
  return result.user
}

export async function disableUser(userId: string): Promise<void> {
  await call({ action: 'disable', userId })
}

export async function enableUser(userId: string): Promise<void> {
  await call({ action: 'enable', userId })
}

/**
 * Redefine a senha de uma conta e devolve a senha resultante, uma única vez.
 *
 * Sem `password`, o servidor sorteia uma. A senha nunca volta a ser legível
 * depois desta resposta, nem para o admin que a definiu: o Supabase guarda
 * só o hash, e o registro de auditoria anota que houve uma troca sem anotar
 * qual foi.
 */
export async function resetPassword(userId: string, password?: string): Promise<string> {
  const result = await call({ action: 'reset_password', userId, password })
  if (!('temporaryPassword' in result)) throw new Error('Resposta inesperada ao redefinir senha.')
  return result.temporaryPassword
}

export async function setRole(userId: string, role: Role): Promise<void> {
  await call({ action: 'set_role', userId, role })
}

export async function deleteUser(userId: string): Promise<void> {
  await call({ action: 'delete_user', userId })
}

/**
 * Convida por link, em vez de criar a conta com senha definida por outro.
 *
 * O link volta para o navegador e é copiado à mão: nenhum e-mail é enviado,
 * porque não há SMTP configurado nesta instalação. Quem convida repassa pelo
 * canal que já usa, e quem recebe define a própria senha — o que dispensa a
 * senha temporária circulando por aí.
 */
export async function inviteUser(email: string, role: Role): Promise<string> {
  const result = await call({
    action: 'invite',
    email,
    role,
    // Para onde a pessoa cai depois de definir a senha. Precisa estar na lista
    // de Redirect URLs do projeto Supabase, senão o convite abre e não volta.
    redirectTo: `${window.location.origin}${import.meta.env.BASE_URL}`,
  })
  if (!('inviteLink' in result)) throw new Error('Resposta inesperada ao gerar o convite.')
  return result.inviteLink
}

/** Remove a verificação em duas etapas de uma conta que perdeu o aparelho. */
export async function resetMfa(userId: string): Promise<void> {
  await call({ action: 'reset_mfa', userId })
}

export async function listAudit(limit = 100): Promise<AuditEntry[]> {
  const result = await call({ action: 'list_audit', limit })
  if (!('entries' in result)) throw new Error('Resposta inesperada ao carregar o histórico.')
  return result.entries
}
