import { Icon } from '@/components/Icon'
import { FLOW_ICON } from '@/components/ui/Money'
import type { TransactionKind } from '@/domain/types'
import { formatCurrency } from '@/lib/format'
import type { Cents } from '@/lib/money'
import { usePrivacy } from '@/store/hooks'
import { useChartTheme, type ChartTheme } from './useChartTheme'

const ON_BLOCK: Record<TransactionKind, keyof ChartTheme> = {
  income: 'incomeOnBlock',
  expense: 'expenseOnBlock',
  contribution: 'contributionOnBlock',
}

export interface TooltipRow {
  label: string
  value: Cents
  /** A marca é a seta de direção, na variante da identidade de fluxo calibrada para o bloco de tinta. */
  tone?: TransactionKind
}

interface ChartTooltipProps {
  title: string
  rows: TooltipRow[]
}

export function ChartTooltipBody({ title, rows }: ChartTooltipProps) {
  const masked = usePrivacy()
  const theme = useChartTheme()

  return (
    <div className="rounded-sm bg-block px-3.5 py-3 text-block-ink shadow-[var(--shadow-float)]">
      <p className="text-xs font-semibold">{title}</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-5 text-xs">
            <span className="flex items-center gap-2 text-block-muted">
              {row.tone ? (
                /*
                 * A mesma seta da lista de lançamentos e do resumo — não uma
                 * marca própria do gráfico. Veste a variante calibrada para o
                 * bloco de tinta: a cor comum falha 3:1 contra o bloco claro
                 * do tema escuro (2,76:1, medido), porque foi validada contra
                 * folha e rebaixado, não contra o inverso do tema.
                 */
                <Icon
                  name={FLOW_ICON[row.tone]}
                  size={12}
                  strokeWidth={2.5}
                  aria-hidden="true"
                  className="shrink-0"
                  style={{ color: theme[ON_BLOCK[row.tone]] }}
                />
              ) : null}
              {row.label}
            </span>
            <span className="tnum font-mono font-medium">
              {formatCurrency(row.value, { masked })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
