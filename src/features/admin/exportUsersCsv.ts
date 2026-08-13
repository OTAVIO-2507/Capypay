import { buildCsv, downloadCsv } from '@/lib/csv'
import { todayIso } from '@/lib/date'
import type { AdminUserSummary } from './adminApi'
import { formatAbsoluteDate } from './adminMetrics'

/**
 * Exportação da lista de contas.
 *
 * Só o que o painel já mostra na tela: e-mail, papel, situação e as duas
 * datas. Nada de dado financeiro, porque nada de dado financeiro chega até
 * aqui — a Edge Function nunca o consulta e o banco recusaria de qualquer
 * forma. Um CSV de administração que trouxesse saldo seria a fronteira
 * inteira vazando por um botão de download.
 */
export function exportUsersCsv(users: readonly AdminUserSummary[]): void {
  if (users.length === 0) return

  const header = ['E-mail', 'Papel', 'Situação', 'Criada em', 'Último acesso']
  const rows = users.map((user) => [
    user.email,
    user.role === 'admin' ? 'Administrador' : 'Usuário',
    user.disabled ? 'Desativada' : 'Ativa',
    formatAbsoluteDate(user.createdAt),
    user.lastSignInAt ? formatAbsoluteDate(user.lastSignInAt) : 'Nunca',
  ])

  downloadCsv(buildCsv(header, rows), `capypay-contas-${todayIso()}.csv`)
}
