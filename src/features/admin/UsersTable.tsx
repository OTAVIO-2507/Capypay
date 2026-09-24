import { Icon } from '@/components/Icon'
import { Badge } from '@/components/ui/Controls'
import { EmptyState } from '@/components/ui/EmptyState'
import type { AdminUserSummary } from './adminApi'
import { formatAbsoluteDate, formatRelativeTime } from './adminMetrics'

/**
 * A tabela de contas.
 *
 * Cada linha é um botão para a ficha (`UserDetailDialog`), e não um punhado
 * de ícones de ação. Três ícones já era o limite do que cabia sem virar
 * charada, e faltavam ações: trocar o papel e excluir não tinham onde morar.
 */
export function UsersTable({
  users,
  onOpen,
}: {
  users: AdminUserSummary[]
  onOpen: (user: AdminUserSummary) => void
}) {
  if (users.length === 0) {
    return (
      <EmptyState
        icon="users"
        title="Nenhuma conta encontrada"
        description="Ajuste a busca ou o filtro, ou crie uma conta nova."
      />
    )
  }

  const agora = Date.now()

  return (
    <div className="-mx-2 overflow-x-auto">
      <table className="w-full min-w-[36rem] border-collapse text-left text-[0.8125rem]">
        <thead>
          {/* Mesma regra das outras tabelas do produto: rótulo de coluna em
              caixa alta, cinza, com tracking. */}
          <tr className="border-b border-hairline text-xs font-medium tracking-[0.06em] text-muted uppercase">
            <th className="px-2 py-2.5">E-mail</th>
            <th className="px-2 py-2.5">Papel</th>
            <th className="px-2 py-2.5">Último acesso</th>
            <th className="px-2 py-2.5">Criada</th>
            <th className="px-2 py-2.5">
              <span className="sr-only">Abrir</span>
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-hairline">
          {users.map((user) => (
            <tr
              key={user.id}
              onClick={() => onOpen(user)}
              className="cursor-pointer transition-colors duration-150 hover:bg-sunken/60"
            >
              <td className="px-2 py-3">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate font-medium text-ink">{user.email}</span>
                  {user.disabled ? <Badge tone="outline">Desativada</Badge> : null}
                </span>
              </td>
              <td className="px-2 py-3">
                <Badge tone={user.role === 'admin' ? 'strong' : 'quiet'}>
                  {user.role === 'admin' ? 'Admin' : 'Usuário'}
                </Badge>
              </td>
              <td className="px-2 py-3 text-muted">
                {formatRelativeTime(user.lastSignInAt, agora)}
              </td>
              <td className="px-2 py-3 text-muted">{formatAbsoluteDate(user.createdAt)}</td>
              <td className="px-2 py-3 text-right">
                {/*
                  Botão de verdade dentro da linha clicável: a linha inteira é
                  atalho de mouse, e este é o alvo que o teclado alcança por
                  Tab. Sem ele, a tabela seria navegável só com o ponteiro.
                */}
                <button
                  type="button"
                  onClick={(event) => {
                    event.stopPropagation()
                    onOpen(user)
                  }}
                  aria-label={`Abrir ${user.email}`}
                  className="inline-flex size-8 items-center justify-center rounded-sm text-faint transition-colors duration-150 hover:bg-hairline hover:text-ink"
                >
                  <Icon name="chevron-right" size={15} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
