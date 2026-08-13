/**
 * Isolado de `authStore.ts` de propósito: aquele arquivo importa o cliente
 * Supabase e cria a sessão no escopo do módulo, então importá-lo num teste
 * exigiria credenciais reais só para checar uma tradução de string. Esta
 * função não depende de nada — só de um teste por tabela.
 */
export function mapAuthError(error: { message: string } | null | undefined): string {
  if (!error) return 'Não foi possível entrar. Tente novamente.'
  const message = error.message.toLowerCase()

  if (message.includes('invalid login credentials')) return 'E-mail ou senha incorretos.'
  if (message.includes('email not confirmed')) return 'Esta conta ainda não foi confirmada.'
  if (message.includes('banned') || message.includes('disabled')) {
    return 'Esta conta foi desativada. Fale com um administrador.'
  }
  return 'Não foi possível entrar. Tente novamente.'
}
