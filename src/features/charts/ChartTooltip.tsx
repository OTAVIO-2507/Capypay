import { Icon } from '@/components/Icon'
import { FLOW_ICON } from '@/components/ui/Money'
import type { TransactionKind } from '@/domain/types'
import { formatCurrency } from '@/lib/format'
import type { Cents } from '@/lib/money'
import { usePrivacy } from '@/store/hooks'
import { useChartTheme, type ChartTheme } from './useChartTheme'

/**
 * A identidade de fluxo comum, e não a variante calibrada para bloco.
 *
 * O balão deixou de ser bloco de tinta e virou folha erguida, então a
 * superfície de trás passou a ser a mesma contra a qual estas três foram
 * validadas. A variante `*-on-block` continua existindo para quem de fato
 * pousa sobre tinta cheia — o cartão, a barra lateral.
 */
const NA_FOLHA: Record<TransactionKind, keyof ChartTheme> = {
  income: 'income',
  expense: 'expense',
  contribution: 'contribution',
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
    /*
     * Folha erguida, e não bloco de tinta.
     *
     * O balão é o elemento mais efêmero da tela — aparece e some ao passar o
     * mouse — e no sistema o que flutua é folha, não bloco. O bloco tem cota
     * (no máximo dois ou três por tela, pela Regra da Tinta Escassa), e um
     * balão de hover furava essa cota a cada movimento do ponteiro.
     *
     * Invertendo, ele também piscava: preto sobre a tela clara, quase branco
     * sobre a tela escura. Como folha erguida ele pousa sobre o gráfico em vez
     * de perfurá-lo, e a hairline mais a sombra dão a separação que a inversão
     * dava à força.
     */
    <div className="rounded-sm border border-hairline bg-sheet-raised px-3.5 py-3 text-ink shadow-[var(--shadow-float)]">
      <p className="text-xs font-semibold">{title}</p>
      <ul className="mt-2 flex flex-col gap-1.5">
        {rows.map((row) => (
          <li key={row.label} className="flex items-center justify-between gap-5 text-xs">
            <span className="flex items-center gap-2 text-muted">
              {row.tone ? (
                /*
                 * A mesma seta da lista de lançamentos e do resumo — não uma
                 * marca própria do gráfico. Agora na variante comum: com o
                 * balão virando folha, a superfície de trás voltou a ser
                 * aquela contra a qual as três foram validadas.
                 */
                <Icon
                  name={FLOW_ICON[row.tone]}
                  size={12}
                  strokeWidth={2.5}
                  aria-hidden="true"
                  className="shrink-0"
                  style={{ color: theme[NA_FOLHA[row.tone]] }}
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
