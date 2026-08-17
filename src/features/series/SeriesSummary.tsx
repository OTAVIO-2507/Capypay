import { Icon, type IconName } from '@/components/Icon'
import { Card } from '@/components/ui/Card'
import { Money } from '@/components/ui/Money'
import type { Cents } from '@/lib/money'

/**
 * A faixa de números que abre Parcelamentos e Assinaturas.
 *
 * As duas páginas abrem com a mesma pergunta em formatos diferentes — "quanto
 * disto existe, e quanto custa" — então dividem o componente em vez de
 * repetir o layout duas vezes e ele divergir na terceira mudança.
 *
 * **Um número grande, o resto em linhas.** A versão anterior punha os quatro
 * numa grade de duas colunas, e numa coluna de um terço da tela isso viraram
 * quatro números grandes espremidos, sem hierarquia e cada um lutando pelo
 * espaço do vizinho. Aqui o destaque é um só e tem a coluna inteira; os outros
 * viram linhas de rótulo e valor, que é o formato que o resto do produto já
 * usa para listar fato ao lado de número.
 *
 * Nenhum deles ganha caixa própria: a Regra da Folha Única é explícita —
 * agrupamento interno é Rebaixado, nunca outra folha — e aqui nem Rebaixado é
 * preciso, porque a hairline entre linhas já separa.
 */

export interface SeriesStat {
  label: string
  /** Contagem crua. Exclui `cents`. */
  count?: number
  countUnit?: string
  cents?: Cents
  icon?: IconName
  /**
   * O número que a página existe para mostrar, e só um por faixa.
   *
   * Sem isto os quatro saem do mesmo tamanho, e faixa em que tudo pesa igual
   * não tem hierarquia: o olho começa pelo primeiro porque é o primeiro, não
   * porque é o que importa.
   */
  highlight?: boolean
}

export function SeriesSummary({
  stats,
  children,
}: {
  stats: SeriesStat[]
  children?: React.ReactNode
}) {
  const heroi = stats.find((stat) => stat.highlight)
  const linhas = stats.filter((stat) => stat !== heroi)

  return (
    <Card>
      {heroi ? (
        <div className="mb-5">
          <p className="flex items-center gap-1.5 text-xs text-muted">
            {heroi.icon ? <Icon name={heroi.icon} size={13} className="shrink-0" /> : null}
            {heroi.label}
          </p>
          <Money
            cents={heroi.cents ?? 0}
            emphasis="strong"
            className="mt-1.5 block text-[1.75rem] tracking-[-0.03em]"
          />
        </div>
      ) : null}

      <dl className="flex flex-col divide-y divide-hairline border-t border-hairline">
        {linhas.map((stat) => (
          <div key={stat.label} className="flex items-baseline justify-between gap-4 py-2.5">
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              {stat.icon ? <Icon name={stat.icon} size={13} className="shrink-0" /> : null}
              {stat.label}
            </dt>
            {stat.count === undefined ? (
              <dd>
                <Money cents={stat.cents ?? 0} className="text-[0.8125rem]" />
              </dd>
            ) : (
              <dd className="flex items-baseline gap-1.5">
                <span className="tnum text-[0.8125rem] font-medium text-ink">{stat.count}</span>
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
