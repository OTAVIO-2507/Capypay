import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, avatarRadius } from '@/components/Avatar'
import { Icon, type IconName } from '@/components/Icon'
import { Popover } from '@/components/ui/Popover'
import { cn } from '@/lib/cn'
import { useAdminProfile } from '@/store/adminPreferences'
import { useAuthStore } from '@/store/authStore'
import { AdminProfileDialog } from './AdminProfileDialog'
import { buildAdminAlerts, type AdminAlert } from './adminAlerts'
import { useAdminUsers } from './useAdminUsers'

/**
 * Os controles globais do painel de administração.
 *
 * Mesma composição da barra de topo do app financeiro: avisos e o
 * perfil por último, separado por um divisor, porque é o único que não muda a
 * tela.
 *
 * Falta um que existe do outro lado, de propósito: o modo privacidade. Ele
 * mascara valores monetários, e não há um único valor monetário aqui. Um
 * botão que não muda nada seria enfeite se comportando como controle.
 */
export function AdminTopBar() {
  return (
    <div className="flex items-center gap-0.5">
      <AdminNotifications />
      <span aria-hidden="true" className="mx-1.5 h-6 w-px bg-hairline" />
      <AdminProfileMenu />
    </div>
  )
}

function AdminNotifications() {
  const { users } = useAdminUsers()
  const avisos = buildAdminAlerts(users ?? [])
  const urgentes = avisos.filter((aviso) => aviso.severity === 'high').length

  return (
    <Popover
      label="Avisos"
      width={340}
      trigger={({ open, toggle, controls }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls={controls}
          aria-label={
            avisos.length === 0
              ? 'Avisos: nenhum'
              : `Avisos: ${avisos.length} ${avisos.length === 1 ? 'item' : 'itens'}`
          }
          className={cn(
            'relative inline-flex size-10 items-center justify-center rounded-sm transition-colors duration-150',
            open ? 'bg-sunken text-ink' : 'text-faint hover:bg-sunken hover:text-ink',
          )}
        >
          <Icon name="bell" size={18} />
          {avisos.length > 0 ? (
            <span
              className={cn(
                'absolute top-1 right-1 flex min-w-[18px] items-center justify-center rounded-full px-1',
                'text-[10px] leading-[18px] font-semibold',
                /*
                  O distintivo mudava de preenchimento e não de cor, porque o
                  sistema não tinha cor. Agora tem, e urgência é exatamente o
                  que ela existe para dizer: cheio de despesa quando há algo
                  urgente, contornado quando é só informação.

                  A contagem continua sendo a leitura principal — apagar a cor
                  não tira nada, porque o número está escrito dentro.

                  A tinta sobre o vermelho é a da mesa, e não a primária: branco
                  sobre o vermelho da despesa dá 3,61:1, abaixo do piso, e este
                  número tem dez pixels. Quase-preto sobre o mesmo vermelho dá
                  5,29:1.
                */
                urgentes > 0
                  ? 'bg-expense text-desk'
                  : 'border border-hairline-strong bg-sheet text-muted',
              )}
            >
              {avisos.length}
            </span>
          ) : null}
        </button>
      )}
    >
      {() => <ListaDeAvisos avisos={avisos} />}
    </Popover>
  )
}

function ListaDeAvisos({ avisos }: { avisos: AdminAlert[] }) {
  return (
    <>
      <p className="border-b border-hairline px-4 py-3 text-[0.8125rem] font-semibold text-ink">
        Avisos
      </p>

      {avisos.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-sunken text-faint">
            <Icon name="check" size={18} />
          </span>
          <p className="mt-2.5 text-[0.8125rem] font-medium text-ink">Nada exigindo atenção</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Toda conta criada já foi acessada e nenhuma está bloqueada.
          </p>
        </div>
      ) : (
        <ul className="max-h-[22rem] overflow-y-auto">
          {avisos.map((aviso) => (
            <li key={aviso.id} className="border-b border-hairline last:border-0">
              <div className="flex gap-3 px-4 py-3">
                <span
                  className={cn(
                    'mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-sm',
                    aviso.severity === 'high'
                      ? 'bg-expense/15 text-expense'
                      : 'bg-sunken text-muted',
                  )}
                >
                  <Icon name={aviso.icon} size={14} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.8125rem] font-medium text-ink">{aviso.title}</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                    {aviso.description}
                  </span>
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}

/**
 * O menu de conta.
 *
 * O retrato é o mesmo catálogo de vinte ilustrações do app financeiro, mas a
 * escolha mora em `adminPreferences`, não em `FinanceData.profile`: uma
 * sessão de administração nunca abre o documento de dados de ninguém, nem o
 * próprio.
 */
function AdminProfileMenu() {
  const email = useAuthStore((state) => state.session?.user.email)
  const signOut = useAuthStore((state) => state.signOut)
  const perfil = useAdminProfile()
  const [editando, setEditando] = useState(false)

  return (
    <>
      <Popover
        label="Conta"
        width={264}
        trigger={({ open, toggle, controls }) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={controls}
            aria-label={email ? `Conta de ${email}` : 'Conta'}
            data-tour="admin-profile"
            // O anel segue o formato do retrato: redondo em volta de um
            // quadrado arredondado desmancharia a escolha da pessoa.
            style={{ borderRadius: avatarRadius(perfil.avatar.shape, 40) }}
            className={cn(
              'ml-1 inline-flex items-center justify-center',
              'transition-[box-shadow,transform,border-radius] duration-200 active:scale-95',
              'ring-offset-2 ring-offset-[var(--sheet-raised)]',
              open ? 'ring-2 ring-ink' : 'hover:ring-2 hover:ring-hairline-strong',
            )}
          >
            <Avatar profile={perfil} size={40} />
          </button>
        )}
      >
        {({ close }) => (
          <>
            <div className="flex items-center gap-3 border-b border-hairline px-4 py-3.5">
              <Avatar profile={perfil} size={40} />
              <span className="min-w-0">
                <span className="block truncate text-[0.8125rem] font-semibold text-ink">
                  {perfil.name.trim() || email || 'Conta'}
                </span>
                {/* Com nome cadastrado o e-mail vira a segunda linha, para não
                    sumir: é ele que identifica a conta de fato. */}
                <span className="block truncate text-xs text-muted">
                  {perfil.name.trim() && email ? email : 'Administrador'}
                </span>
              </span>
            </div>

            <div className="p-1.5">
              <ItemButton
                icon="square-pen"
                onClick={() => {
                  close()
                  setEditando(true)
                }}
              >
                Personalizar perfil
              </ItemButton>
              <ItemLink icon="settings" to="/admin/ajustes" onClick={close}>
                Ajustes
              </ItemLink>
              <ItemButton
                icon="log-out"
                onClick={() => {
                  close()
                  void signOut()
                }}
              >
                Sair
              </ItemButton>
            </div>
          </>
        )}
      </Popover>

      <AdminProfileDialog open={editando} onClose={() => setEditando(false)} />
    </>
  )
}

const ITEM =
  'flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-[0.8125rem] font-medium text-ink ' +
  'transition-colors duration-150 hover:bg-sunken'

function ItemLink({
  icon,
  to,
  onClick,
  children,
}: {
  icon: IconName
  to: string
  onClick: () => void
  children: string
}) {
  return (
    <Link to={to} onClick={onClick} className={ITEM}>
      <Icon name={icon} size={16} className="text-faint" />
      {children}
    </Link>
  )
}

function ItemButton({
  icon,
  onClick,
  children,
}: {
  icon: IconName
  onClick: () => void
  children: string
}) {
  return (
    <button type="button" onClick={onClick} className={ITEM}>
      <Icon name={icon} size={16} className="text-faint" />
      {children}
    </button>
  )
}
