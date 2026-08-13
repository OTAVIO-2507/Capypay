import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Segmented, type SegmentOption } from '@/components/ui/Controls'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/Field'
import { CreateUserDialog } from '@/features/admin/CreateUserDialog'
import { InviteUserDialog } from '@/features/admin/InviteUserDialog'
import { TemporaryPasswordDialog } from '@/features/admin/TemporaryPasswordDialog'
import { UserDetailDialog } from '@/features/admin/UserDetailDialog'
import { UsersTable } from '@/features/admin/UsersTable'
import { filterUsers, summarizeUsers, type UserFilter } from '@/features/admin/adminMetrics'
import { useAdminUsers } from '@/features/admin/useAdminUsers'
import type { AdminUserSummary } from '@/features/admin/adminApi'

const FILTROS: readonly SegmentOption<UserFilter>[] = [
  { value: 'todas', label: 'Todas' },
  { value: 'usuarios', label: 'Usuários' },
  { value: 'admins', label: 'Admins' },
  { value: 'desativadas', label: 'Desativadas' },
]

export function AdminUsersPage() {
  const { users, loading, error, reload } = useAdminUsers()

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<UserFilter>('todas')
  const [criando, setCriando] = useState(false)
  const [convidando, setConvidando] = useState(false)
  const [aberta, setAberta] = useState<AdminUserSummary | null>(null)
  const [senhaTemporaria, setSenhaTemporaria] = useState<{ email: string; password: string } | null>(
    null,
  )

  const lista = useMemo(() => users ?? [], [users])
  const visiveis = useMemo(() => filterUsers(lista, { query, filter }), [lista, query, filter])
  const resumo = summarizeUsers(lista, Date.now())

  // A ficha aberta precisa acompanhar a lista recarregada: sem isto, desativar
  // uma conta pela ficha deixaria o próprio diálogo mostrando "Ativa" até ele
  // ser fechado e reaberto.
  const abertaAtual = aberta ? (lista.find((user) => user.id === aberta.id) ?? null) : null

  return (
    <>
      <PageHeader
        title="Usuários"
        description="Contas de acesso. Nunca mostra ou gerencia dados financeiros de ninguém."
        actions={
          <>
            <Button variant="quiet" icon="repeat" onClick={() => void reload()}>
              Atualizar
            </Button>
            <Button variant="quiet" icon="mail" onClick={() => setConvidando(true)}>
              Convidar
            </Button>
            <Button icon="user-plus" onClick={() => setCriando(true)}>
              Nova conta
            </Button>
          </>
        }
      />

      {error ? (
        <Card>
          <EmptyState
            icon="triangle-alert"
            title="Não foi possível carregar as contas"
            description={error}
            action={
              <Button size="sm" variant="quiet" icon="repeat" onClick={() => void reload()}>
                Tentar de novo
              </Button>
            }
          />
        </Card>
      ) : (
        <Card className="flex flex-col gap-5">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <SearchInput
              label="Buscar por e-mail"
              placeholder="Buscar por e-mail…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              className="lg:max-w-xs"
            />
            <Segmented
              label="Filtrar contas"
              options={FILTROS}
              value={filter}
              onChange={setFilter}
              size="sm"
              className="lg:w-auto"
            />
          </div>

          {loading ? (
            <p className="text-[0.8125rem] text-muted">Carregando…</p>
          ) : (
            <>
              <UsersTable users={visiveis} onOpen={setAberta} />

              {visiveis.length > 0 ? (
                <p className="text-xs text-muted">
                  {visiveis.length === lista.length
                    ? `${lista.length} ${lista.length === 1 ? 'conta' : 'contas'}`
                    : `${visiveis.length} de ${lista.length} contas`}
                  {resumo.desativadas > 0 && filter === 'todas'
                    ? `, ${resumo.desativadas} desativada${resumo.desativadas === 1 ? '' : 's'}`
                    : ''}
                </p>
              ) : null}
            </>
          )}
        </Card>
      )}

      <CreateUserDialog
        open={criando}
        onClose={() => setCriando(false)}
        onCreated={() => void reload()}
      />

      <InviteUserDialog
        open={convidando}
        onClose={() => setConvidando(false)}
        onInvited={() => void reload()}
      />

      <UserDetailDialog
        user={abertaAtual}
        onClose={() => setAberta(null)}
        onChanged={() => void reload()}
        onTemporaryPassword={(email, password) => setSenhaTemporaria({ email, password })}
      />

      <TemporaryPasswordDialog
        email={senhaTemporaria?.email ?? null}
        password={senhaTemporaria?.password ?? null}
        onClose={() => setSenhaTemporaria(null)}
      />
    </>
  )
}
