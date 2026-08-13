import { Icon } from '@/components/Icon'
import { Card, CardHeader } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Money } from '@/components/ui/Money'
import { categoryIcon, categoryLabel } from '@/domain/categories'
import type { Category, Transaction } from '@/domain/types'
import { formatDayMonth, monthOf, todayIso, type MonthKey } from '@/lib/date'

interface UpcomingPanelProps {
  transactions: readonly Transaction[]
  categories: readonly Category[]
  month: MonthKey
}

/**
 * O que ainda vence dentro do mês.
 *
 * "Últimos lançamentos" responde o que já aconteceu; esta lista responde o que
 * falta — que numa conta pessoal costuma ser a pergunta mais urgente das duas.
 * São lançamentos que já existem no histórico com data futura, quase sempre
 * parcelas geradas por uma recorrência, então não há previsão nem estimativa
 * aqui: é dinheiro já comprometido.
 *
 * Ao consultar um mês passado a lista fica naturalmente vazia, e o painel diz
 * isso em vez de sumir — um card que aparece e desaparece conforme o mês faz a
 * página inteira pular de altura.
 */
export function UpcomingPanel({ transactions, categories, month }: UpcomingPanelProps) {
  const hoje = todayIso()

  const aVencer = transactions
    .filter(
      (item) => item.kind !== 'income' && monthOf(item.date) === month && item.date > hoje,
    )
    .sort((a, b) => (a.date < b.date ? -1 : 1))

  const total = aVencer.reduce((soma, item) => soma + item.amountCents, 0)

  return (
    <Card className="flex w-full flex-col">
      <CardHeader
        title="Ainda vence este mês"
        description={
          aVencer.length > 0
            ? `${aVencer.length} ${aVencer.length === 1 ? 'lançamento' : 'lançamentos'} com data à frente`
            : undefined
        }
      />

      {aVencer.length === 0 ? (
        <EmptyState
          icon="calendar"
          size="sm"
          title="Nada a vencer"
          description="Nenhum lançamento deste mês está com data à frente de hoje."
        />
      ) : (
        <>
          <ul className="flex flex-1 flex-col divide-y divide-hairline">
            {aVencer.slice(0, 6).map((item) => (
              <li key={item.id} className="flex items-center justify-between gap-3 py-2.5 first:pt-0">
                <span className="flex min-w-0 items-center gap-2.5">
                  <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm bg-sunken text-faint">
                    <Icon name={categoryIcon(categories, item.categoryId)} size={14} />
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[0.8125rem] font-medium text-ink">
                      {item.description}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {formatDayMonth(item.date)} · {categoryLabel(categories, item.categoryId)}
                    </span>
                  </span>
                </span>
                <Money cents={item.amountCents} className="shrink-0 text-[0.8125rem]" />
              </li>
            ))}
          </ul>

          <div className="mt-3.5 flex items-baseline justify-between gap-3 border-t border-hairline pt-3">
            <span className="text-xs text-muted">
              {aVencer.length > 6 ? `Total dos ${aVencer.length}` : 'Total'}
            </span>
            <Money cents={total} emphasis="strong" className="text-base" />
          </div>
        </>
      )}
    </Card>
  )
}
