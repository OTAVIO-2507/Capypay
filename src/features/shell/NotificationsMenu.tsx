import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { Popover } from '@/components/ui/Popover'
import { buildAlerts, type Alert } from '@/domain/alerts'
import { cn } from '@/lib/cn'
import { formatCurrency } from '@/lib/format'
import {
  useBudgets,
  useCategories,
  useGoals,
  usePrivacy,
  useSelectedMonth,
  useTransactions,
} from '@/store/hooks'

/**
 * O sino.
 *
 * A contagem só aparece quando existe algo de fato pendente, e some sozinha
 * quando a condição deixa de valer — não há "marcar como lido". Um contador
 * que fica aceso por decisão do usuário e não pelo estado do dinheiro deixa de
 * significar alguma coisa em uma semana.
 */
export function NotificationsMenu() {
  const transactions = useTransactions()
  const categories = useCategories()
  const goals = useGoals()
  const budgets = useBudgets()
  const month = useSelectedMonth()
  const masked = usePrivacy()

  const alerts = useMemo(
    () =>
      buildAlerts({
        transactions,
        categories,
        goals,
        budgets,
        month,
        formatValue: (cents) => formatCurrency(cents, { masked }),
      }),
    [transactions, categories, goals, budgets, month, masked],
  )

  const urgentes = alerts.filter((alerta) => alerta.severity === 'high').length

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
            alerts.length === 0
              ? 'Avisos: nenhum'
              : `Avisos: ${alerts.length} ${alerts.length === 1 ? 'item' : 'itens'}`
          }
          className={cn(
            'relative inline-flex size-10 items-center justify-center rounded-sm transition-colors duration-150',
            open ? 'bg-sunken text-ink' : 'text-faint hover:bg-sunken hover:text-ink',
          )}
        >
          <Icon name="bell" size={18} />
          {alerts.length > 0 ? (
            <span
              className={cn(
                'absolute top-1 right-1 flex min-w-[18px] items-center justify-center rounded-full px-1',
                'text-[10px] leading-[18px] font-semibold',
                // O distintivo muda de preenchimento, não de cor: cheio quando
                // há algo urgente, contornado quando é só informação.
                urgentes > 0
                  ? 'bg-block text-block-ink'
                  : 'border border-hairline-strong bg-sheet text-muted',
              )}
            >
              {alerts.length}
            </span>
          ) : null}
        </button>
      )}
    >
      {({ close }) => <AlertList alerts={alerts} onNavigate={close} />}
    </Popover>
  )
}

function AlertList({ alerts, onNavigate }: { alerts: Alert[]; onNavigate: () => void }) {
  return (
    <>
      <p className="border-b border-hairline px-4 py-3 text-[0.8125rem] font-semibold text-ink">
        Avisos
      </p>

      {alerts.length === 0 ? (
        <div className="px-4 py-8 text-center">
          <span className="inline-flex size-10 items-center justify-center rounded-full bg-sunken text-faint">
            <Icon name="check" size={18} />
          </span>
          <p className="mt-2.5 text-[0.8125rem] font-medium text-ink">Nada exigindo atenção</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">
            Limites dentro do teto e nenhuma pendência no mês selecionado.
          </p>
        </div>
      ) : (
        <ul className="max-h-[22rem] overflow-y-auto">
          {alerts.map((alerta) => (
            <li key={alerta.id} className="border-b border-hairline last:border-0">
              <Link
                to={alerta.to}
                onClick={onNavigate}
                className="flex gap-3 px-4 py-3 transition-colors duration-150 hover:bg-sunken"
              >
                <span
                  className={cn(
                    'mt-0.5 inline-flex size-7 shrink-0 items-center justify-center rounded-sm',
                    alerta.severity === 'high'
                      ? 'bg-block text-block-ink'
                      : 'bg-sunken text-muted',
                  )}
                >
                  <Icon name={alerta.icon} size={14} />
                </span>
                <span className="min-w-0">
                  <span className="block text-[0.8125rem] font-medium text-ink">
                    {alerta.title}
                  </span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-muted">
                    {alerta.description}
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
