import type { IconName } from '@/components/Icon'
import { SummaryCard, type SummaryStat } from '@/components/ui/SummaryCard'
import type { Cents } from '@/lib/money'

/**
 * A faixa de números que abre Parcelamentos e Assinaturas.
 *
 * As duas páginas abrem com a mesma pergunta em formatos diferentes — "quanto
 * disto existe, e quanto custa" — então dividem o componente em vez de
 * repetir o layout duas vezes e ele divergir na terceira mudança.
 *
 * Hoje ele é um adaptador fino sobre `SummaryCard`, e isso conserta uma
 * duplicação que eu mesmo criei: montei o `SummaryCard` para Transações sem
 * notar que esta faixa já resolvia o mesmo problema desde antes. Duas
 * implementações do mesmo cartão divergem na primeira mudança que alguém
 * aplica só de um lado — e a grade, o corte de duas para quatro colunas e o
 * espaçamento já eram idênticos nas duas.
 *
 * O que sobrevive aqui é a **tradução de vocabulário**: `SeriesStat` fala em
 * contagem e centavos, que é como as duas páginas pensam; `SummaryStat` fala
 * em conteúdo renderizado, que é como o cartão desenha.
 */

export interface SeriesStat {
  label: string
  /** Contagem crua. Exclui `cents`. */
  count?: number
  countUnit?: string
  cents?: Cents
  icon?: IconName
  /**
   * A cor do valor.
   *
   * Substituiu o antigo `highlight`, que engrossava um dos quatro para dizer
   * qual era a resposta. Com todos em negrito — que é como o cartão desenha
   * agora — o peso parou de estar disponível como canal, e a cor ocupou o
   * lugar dele. É uma leitura melhor, e não só uma diferente: `attention` num
   * "restante a pagar" diz *o que* aquele número é, e não apenas que ele
   * importa mais que os vizinhos.
   */
  tone?: SummaryStat['tone']
}

export function SeriesSummary({
  stats,
  children,
}: {
  stats: SeriesStat[]
  children?: React.ReactNode
}) {
  const icone = stats.find((stat) => stat.icon)?.icon

  return (
    <SummaryCard
      icon={icone}
      stats={stats.map((stat) => ({
        label: stat.label,
        ...(stat.count === undefined ? { cents: stat.cents ?? 0 } : { value: stat.count }),
        caption: stat.countUnit,
        tone: stat.tone,
      }))}
    >
      {children}
    </SummaryCard>
  )
}
