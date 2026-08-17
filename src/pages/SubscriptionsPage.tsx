import { useMemo } from 'react'
import { Icon } from '@/components/Icon'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Money } from '@/components/ui/Money'
import { categoryColor } from '@/domain/categories'
import {
  activeSubscriptions,
  monthlySubscriptionCost,
  type Subscription,
} from '@/domain/subscriptions'
import { BrandMark } from '@/features/series/BrandMark'
import { SeriesSummary } from '@/features/series/SeriesSummary'
import { formatDayMonth } from '@/lib/date'
import { useCategories, useTransactions } from '@/store/hooks'

const CADENCIA: Record<Subscription['cadence'], string> = {
  weekly: 'toda semana',
  monthly: 'todo mês',
  yearly: 'todo ano',
}

/**
 * As assinaturas ativas, e o que elas custam.
 *
 * A projeção anual é o número que a página existe para mostrar. O gasto
 * mensal é fácil de aceitar — quarenta reais aqui, vinte ali — e é sobre doze
 * meses que a conta assusta; mostrar os dois lado a lado é o argumento
 * inteiro, e não um enfeite de dashboard.
 *
 * A média por serviço fecha a faixa porque separa dois casos que o total
 * confunde: muitas assinaturas baratas e poucas caras somam igual e pedem
 * decisões opostas.
 */
export function SubscriptionsPage() {
  const transactions = useTransactions()
  const categories = useCategories()

  const assinaturas = useMemo(
    () => activeSubscriptions(transactions, categories),
    [transactions, categories],
  )
  const mensal = useMemo(() => monthlySubscriptionCost(assinaturas), [assinaturas])

  return (
    <>
      <PageHeader
        title="Assinaturas"
        description="Serviços que cobram de novo, e o quanto ocupam do mês."
      />

      {assinaturas.length === 0 ? (
        <Card>
          <EmptyState
            icon="repeat"
            title="Nenhuma assinatura ativa"
            description="Ao lançar uma despesa, marque “Repetir lançamento” e escolha Assinatura para o serviço aparecer aqui."
          />
        </Card>
      ) : (
        /* A mesma moldura de Parcelamentos, e pelo mesmo motivo: são páginas
           irmãs, e eram as duas únicas do produto em coluna única. */
        <div className="grid gap-5 lg:grid-cols-12">
          <div className="lg:col-span-4">
            <div className="lg:sticky lg:top-6">
              <SeriesSummary
                stats={[
                  {
                    label: 'Assinaturas',
                    icon: 'repeat',
                    count: assinaturas.length,
                    countUnit: assinaturas.length === 1 ? 'ativa' : 'ativas',
                  },
                  { label: 'Gasto mensal', cents: mensal },
                  { label: 'Projeção anual', cents: mensal * 12, highlight: true },
                  {
                    label: 'Média por serviço',
                    cents: Math.round(mensal / assinaturas.length),
                  },
                ]}
              />
            </div>
          </div>

          <ul className="flex flex-col gap-3 lg:col-span-8">
            {assinaturas.map((assinatura) => (
              <li key={assinatura.seriesId}>
                <Card className="flex items-center justify-between gap-4">
                  <span className="flex min-w-0 items-center gap-3">
                    {/*
                      A mesma pastilha de Orçamento e do extrato. Estas duas
                      páginas nasceram antes da cor de categoria existir e
                      ficaram no cinza antigo — a categoria era a mesma coisa
                      em três telas e se apresentava de dois jeitos.
                    */}
                    <BrandMark
                      label={assinatura.label}
                      fallbackIcon={assinatura.icon}
                      fallbackColor={categoryColor(assinatura.categoryId)}
                    />
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-medium text-ink">
                        {assinatura.label}
                      </span>
                      <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted">
                        <span className="flex items-center gap-1.5">
                          <Icon name="calendar" size={11} className="shrink-0" />
                          Próxima: {formatDayMonth(assinatura.next)}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>
                          {assinatura.remaining}{' '}
                          {assinatura.remaining === 1 ? 'cobrança lançada' : 'cobranças lançadas'}
                        </span>
                      </span>
                    </span>
                  </span>

                  <span className="shrink-0 text-right">
                    <Money cents={assinatura.amountCents} emphasis="strong" className="block text-sm" />
                    <span className="mt-0.5 block text-xs text-muted">
                      {CADENCIA[assinatura.cadence]}
                    </span>
                  </span>
                </Card>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  )
}
