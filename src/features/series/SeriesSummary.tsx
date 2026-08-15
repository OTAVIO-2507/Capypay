import { Icon, type IconName } from '@/components/Icon'
import { Card } from '@/components/ui/Card'
import { Money } from '@/components/ui/Money'
import { cn } from '@/lib/cn'
import type { Cents } from '@/lib/money'

/**
 * A faixa de números que abre Parcelamentos e Assinaturas.
 *
 * As duas páginas abrem com a mesma pergunta em formatos diferentes — "quanto
 * disto existe, e quanto custa" — então dividem o componente em vez de
 * repetir o layout duas vezes e ele divergir na terceira mudança.
 *
 * Os totais ficam em `Money` e não em `Figure`: são quatro lado a lado, e
 * quatro figuras de 44px numa faixa só é exatamente o que a Regra da Figura
 * Solitária existe para impedir. O primeiro item é a contagem, que ganha o
 * corpo maior por ser o assunto da página; os outros três são dinheiro.
 */

export interface SeriesStat {
  label: string
  /** Contagem crua, para o primeiro item. Exclui `cents`. */
  count?: number
  countUnit?: string
  cents?: Cents
  icon?: IconName
}

export function SeriesSummary({ stats, children }: { stats: SeriesStat[]; children?: React.ReactNode }) {
  return (
    <Card>
      <dl className="grid gap-x-8 gap-y-6 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label}>
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              {stat.icon ? <Icon name={stat.icon} size={13} className="shrink-0" /> : null}
              {stat.label}
            </dt>
            {stat.count === undefined ? (
              <Money
                cents={stat.cents ?? 0}
                emphasis="strong"
                className={cn('mt-1.5 block text-[1.375rem]')}
              />
            ) : (
              <dd className="mt-1.5 flex items-baseline gap-1.5">
                <span className="tnum text-[1.75rem] font-semibold tracking-[-0.02em] text-ink">
                  {stat.count}
                </span>
                {stat.countUnit ? (
                  <span className="text-xs text-muted">{stat.countUnit}</span>
                ) : null}
              </dd>
            )}
          </div>
        ))}
      </dl>
      {children}
    </Card>
  )
}
