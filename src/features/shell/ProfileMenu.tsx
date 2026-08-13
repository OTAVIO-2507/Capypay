import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, avatarRadius } from '@/components/Avatar'
import { Icon, type IconName } from '@/components/Icon'
import { Popover } from '@/components/ui/Popover'
import { exportTransactionsCsv } from '@/features/settings/exportCsv'
import { cn } from '@/lib/cn'
import { useAuthStore } from '@/store/authStore'
import { useCategories, useGoals, useProfile, useTransactions } from '@/store/hooks'
import { EditProfileDialog } from './EditProfileDialog'

export function ProfileMenu() {
  const profile = useProfile()
  const transactions = useTransactions()
  const categories = useCategories()
  const goals = useGoals()
  const signOut = useAuthStore((state) => state.signOut)
  const [editando, setEditando] = useState(false)

  return (
    <>
      <Popover
        label="Perfil"
        width={272}
        trigger={({ open, toggle, controls }) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={controls}
            aria-label={profile.name ? `Perfil de ${profile.name}` : 'Perfil'}
            data-tour="profile"
            // O anel segue o formato do retrato: redondo em volta de um
            // quadrado arredondado desmancharia a escolha da pessoa.
            style={{ borderRadius: avatarRadius(profile.avatar.shape, 40) }}
            className={cn(
              'ml-1 inline-flex items-center justify-center',
              'transition-[box-shadow,transform,border-radius] duration-200 active:scale-95',
              'ring-offset-2 ring-offset-[var(--sheet-raised)]',
              open ? 'ring-2 ring-ink' : 'hover:ring-2 hover:ring-hairline-strong',
            )}
          >
            <Avatar profile={profile} size={40} />
          </button>
        )}
      >
        {({ close }) => (
          <>
            <div className="flex items-center gap-3 border-b border-hairline px-4 py-3.5">
              <Avatar profile={profile} size={40} />
              <span className="min-w-0">
                <span className="block truncate text-[0.8125rem] font-semibold text-ink">
                  {profile.name || 'Sem nome cadastrado'}
                </span>
                <span className="block text-xs text-muted">
                  {transactions.length}{' '}
                  {transactions.length === 1 ? 'lançamento' : 'lançamentos'}
                </span>
              </span>
            </div>

            <div className="p-1.5">
              <MenuButton
                icon="square-pen"
                onClick={() => {
                  close()
                  setEditando(true)
                }}
              >
                Personalizar perfil
              </MenuButton>

              <MenuButton
                icon="download"
                disabled={transactions.length === 0}
                onClick={() => {
                  exportTransactionsCsv(transactions, categories, goals)
                  close()
                }}
              >
                Exportar CSV
              </MenuButton>

              <MenuLink icon="settings" to="/ajustes" onClick={close}>
                Ajustes
              </MenuLink>
            </div>

            <div className="border-t border-hairline p-1.5">
              <MenuButton
                icon="log-out"
                onClick={() => {
                  close()
                  void signOut()
                }}
              >
                Sair
              </MenuButton>
            </div>
          </>
        )}
      </Popover>

      <EditProfileDialog open={editando} onClose={() => setEditando(false)} />
    </>
  )
}

const ITEM_CLASS =
  'flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-[0.8125rem] font-medium text-ink ' +
  'transition-colors duration-150 hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-40 ' +
  'disabled:hover:bg-transparent'

function MenuButton({
  icon,
  children,
  ...props
}: { icon: IconName; children: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button type="button" className={ITEM_CLASS} {...props}>
      <Icon name={icon} size={16} className="text-faint" />
      {children}
    </button>
  )
}

function MenuLink({
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
    <Link to={to} onClick={onClick} className={ITEM_CLASS}>
      <Icon name={icon} size={16} className="text-faint" />
      {children}
    </Link>
  )
}
