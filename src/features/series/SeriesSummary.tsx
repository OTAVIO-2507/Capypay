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
 * **Os quatro lado a lado, ocupando a largura toda.** A versão anterior era
 * uma coluna fixa de um terço da tela, com um número grande e três linhas de
 * rótulo e valor. Empilhados numa coluna estreita, os números viravam uma
 * lista de fatos: para comparar "já pago" com "restante" o olho tinha que
 * descer e voltar, quando a comparação entre eles é a leitura inteira. Em
 * linha, os quatro entram de uma vez e a página abre respondendo.
 *
 * Nenhum deles ganha caixa própria: a Regra da Folha Única é explícita —
 * agrupamento interno é Rebaixado, nunca outra folha — e aqui nem Rebaixado é
 * preciso, porque o espaço entre as colunas já separa.
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
   * Com os quatro do mesmo tamanho, o peso da tinta é o que sobra para dizer
   * qual deles é a resposta. Sem isso a faixa não tem hierarquia: o olho
   * começa pelo primeiro porque é o primeiro, não porque é o que importa.
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
  return (
    <Card>
      {/*
        Duas colunas no celular e quatro no desktop. Quatro números destes numa
        tela de 360px sairiam com dois algarismos por linha e o resto cortado.
      */}
      <dl className="grid grid-cols-2 gap-x-6 gap-y-6 sm:grid-cols-4">
        {stats.map((stat) => (
          <div key={stat.label} className="min-w-0">
            <dt className="flex items-center gap-1.5 text-xs text-muted">
              {stat.icon ? <Icon name={stat.icon} size={13} className="shrink-0" /> : null}
              <span className="truncate">{stat.label}</span>
            </dt>

            {stat.count === undefined ? (
              <dd>
                {/*
                  Todos do mesmo tamanho, e só o destaque em semibold. Foi o
                  que sobrou de hierarquia quando os quatro passaram a dividir
                  a linha: apagar os outros três em tinta secundária faria um
                  número de 24px parecer desligado, não secundário.
                */}
                <Money
                  cents={stat.cents ?? 0}
                  emphasis={stat.highlight ? 'strong' : 'plain'}
                  className={cn(
                    'mt-1.5 block text-2xl tracking-[-0.03em]',
                    !stat.highlight && 'font-normal',
                  )}
                />
              </dd>
            ) : (
              <dd className="mt-1.5">
                <span className="tnum block text-2xl font-semibold tracking-[-0.03em] text-ink">
                  {stat.count}
                </span>
                {stat.countUnit ? (
                  <span className="mt-0.5 block truncate text-xs text-muted">{stat.countUnit}</span>
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
