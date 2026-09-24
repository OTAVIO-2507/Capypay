import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/Icon'
import { Card } from '@/components/ui/Card'
import { Money } from '@/components/ui/Money'
import type { Cents } from '@/lib/money'
import { cn } from '@/lib/cn'

/**
 * O tom de um valor de resumo.
 *
 * `attention` não é um "amarelo de aviso" genérico: veste o compromisso já
 * assumido que ainda não virou movimento — restante a pagar, projeção anual,
 * fatura estimada. Ver a nota do token `--attention` em `styles.css`.
 */
export type StatTone = 'ink' | 'income' | 'expense' | 'contribution' | 'attention' | 'accent'

const STAT_TONE: Record<StatTone, string> = {
  ink: 'text-ink',
  income: 'text-income',
  expense: 'text-expense',
  contribution: 'text-contribution',
  attention: 'text-attention',
  accent: 'text-accent',
}

/*
 * A contagem vira classe estática porque o Tailwind lê o código-fonte para
 * decidir o que gerar: `lg:grid-cols-${n}` nunca existiria no CSS final.
 */
const COLUNAS: Record<number, string> = {
  2: 'lg:grid-cols-2',
  3: 'lg:grid-cols-3',
  4: 'lg:grid-cols-4',
  5: 'lg:grid-cols-5',
}

export interface SummaryStat {
  label: string
  /**
   * O valor em centavos. Prefira este a `value` para dinheiro: o cartão
   * desenha o `Money` ele mesmo, já com a cor do tom.
   *
   * Passar `<Money />` pronto em `value` foi o jeito original, e ele engolia a
   * cor: `Money` impõe `text-ink` no próprio elemento, e isso vence a cor que
   * o cartão punha no parágrafo em volta. Todo "Já pago" em verde e todo
   * "Restante" em âmbar saíam brancos.
   */
  cents?: Cents
  /** Conteúdo que não é dinheiro — uma contagem, por exemplo. */
  value?: ReactNode
  tone?: StatTone
  /** Linha pequena sob o valor, para a unidade ou a contagem. */
  caption?: string
}

/**
 * O cartão de resumo que abre uma seção.
 *
 * Quatro estatísticas numa linha, e a primeira é diferente das outras três:
 * ela leva um ícone ao lado do rótulo e uma legenda embaixo do valor, porque
 * é a que responde "do que estamos falando" — *quantos* parcelamentos,
 * *quantas* assinaturas. As outras três são valores comparáveis entre si e
 * não precisam de moldura nenhuma para serem lidas em sequência.
 *
 * Empilha em duas colunas no celular. Quatro números lado a lado em 400px
 * dariam menos de 100px por coluna, e o primeiro valor que passasse de cinco
 * dígitos quebraria a linha — o que é pior que empilhar de propósito.
 */
export function SummaryCard({
  icon,
  stats,
  children,
  className,
}: {
  icon?: IconName
  stats: readonly SummaryStat[]
  /** Conteúdo extra abaixo da linha — uma barra de progresso, por exemplo. */
  children?: ReactNode
  className?: string
}) {
  return (
    <Card className={className}>
      <div className={cn('grid grid-cols-2 gap-x-6 gap-y-6', COLUNAS[stats.length] ?? 'lg:grid-cols-4')}>
        {stats.map((stat, index) => (
          <div key={stat.label} className="min-w-0">
            <p className="flex items-center gap-2 text-xs font-medium tracking-[0.06em] text-muted uppercase">
              {index === 0 && icon ? (
                <Icon name={icon} size={15} className="shrink-0 text-accent" aria-hidden="true" />
              ) : null}
              <span className="truncate">{stat.label}</span>
            </p>
            <p
              className={cn(
                'mt-1.5 truncate text-2xl font-bold tracking-[-0.02em]',
                STAT_TONE[stat.tone ?? 'ink'],
              )}
            >
              {stat.cents !== undefined ? (
                <Money cents={stat.cents} className={STAT_TONE[stat.tone ?? 'ink']} />
              ) : (
                stat.value
              )}
            </p>
            {stat.caption ? <p className="mt-0.5 text-xs text-muted">{stat.caption}</p> : null}
          </div>
        ))}
      </div>
      {children ? <div className="mt-6">{children}</div> : null}
    </Card>
  )
}
