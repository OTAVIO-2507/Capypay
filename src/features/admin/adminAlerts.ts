import type { IconName } from '@/components/Icon'
import type { AdminUserSummary } from './adminApi'
import { nuncaAcessaram } from './adminMetrics'

export interface AdminAlert {
  id: string
  icon: IconName
  title: string
  description: string
  /** `high` acende o distintivo cheio; o resto é informação. */
  severity: 'high' | 'info'
}

/**
 * Os avisos do painel de administração.
 *
 * Derivados do mesmo `listUsers()` que alimenta o resto, e nunca guardados:
 * não existe "marcar como lido". Um contador que se apaga por decisão de quem
 * olha, e não porque a condição deixou de valer, para de significar alguma
 * coisa em uma semana.
 *
 * Só entram fatos que pedem ação de alguém. "Duas contas existem" não é
 * aviso, é o painel.
 */
export function buildAdminAlerts(users: readonly AdminUserSummary[]): AdminAlert[] {
  const avisos: AdminAlert[] = []

  const pendentes = nuncaAcessaram(users)
  if (pendentes.length > 0) {
    avisos.push({
      id: 'nunca-acessaram',
      icon: 'circle-dashed',
      severity: 'high',
      title:
        pendentes.length === 1
          ? 'Uma conta nunca foi acessada'
          : `${pendentes.length} contas nunca foram acessadas`,
      description:
        pendentes.length === 1
          ? `${pendentes[0].email} recebeu acesso mas nunca entrou. A senha pode não ter chegado.`
          : 'Foram criadas mas ninguém entrou. A senha pode não ter chegado a essas pessoas.',
    })
  }

  const desativadas = users.filter((user) => user.disabled)
  if (desativadas.length > 0) {
    avisos.push({
      id: 'desativadas',
      icon: 'user-x',
      severity: 'info',
      title:
        desativadas.length === 1
          ? 'Uma conta está desativada'
          : `${desativadas.length} contas estão desativadas`,
      description:
        desativadas.length === 1
          ? `${desativadas[0].email} não consegue entrar até ser reativada.`
          : 'Elas não conseguem entrar até serem reativadas.',
    })
  }

  /*
   * Uma plataforma com um administrador só não tem como se recuperar da perda
   * dele: o servidor recusa rebaixar ou excluir o último, mas nada impede que
   * a senha se perca. É o único aviso aqui que fala do risco em vez do estado.
   */
  const admins = users.filter((user) => user.role === 'admin' && !user.disabled)
  if (users.length > 0 && admins.length === 1) {
    avisos.push({
      id: 'admin-unico',
      icon: 'shield',
      severity: 'info',
      title: 'Só existe um administrador',
      description:
        'Perder o acesso desta conta deixaria a plataforma sem quem gerencie. Vale promover uma segunda.',
    })
  }

  return avisos
}
