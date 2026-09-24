import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/Icon'
import type { TransactionKind } from '@/domain/types'
import { cn } from '@/lib/cn'
import { formatCurrency, formatCurrencyCompact } from '@/lib/format'
import type { Cents } from '@/lib/money'
import { useCountUp } from '@/lib/useCountUp'
import { usePrivacy } from '@/store/hooks'

/*
 * A identidade de fluxo, aplicada em texto — a segunda exceção de cor do
 * sistema (DESIGN.md, "As Duas Exceções de Cor"). Fixa por tipo de
 * lançamento, nunca escolhida por quem usa; usada só em ícone, marca de
 * gráfico e na Figura grande o bastante para dispensar 4,5:1 — nunca no
 * algarismo pequeno de uma lista, que continua carregado só por Tinta.
 */
export const FLOW_TEXT_CLASS: Record<TransactionKind, string> = {
  income: 'text-income',
  expense: 'text-expense',
  contribution: 'text-contribution',
}

/**
 * A mesma seta que precede o valor na lista de lançamentos — entrada sobe,
 * saída desce, aporte segue para o lado — reaproveitada como rótulo de
 * resumo. Não é um enfeite novo: é o sinal que "A Regra das Quatro Leituras"
 * já usa para dizer a mesma coisa, só que como legenda de um número agregado
 * em vez de legenda de uma linha.
 */
export const FLOW_ICON: Record<TransactionKind, IconName> = {
  income: 'arrow-up-right',
  expense: 'arrow-down-right',
  contribution: 'arrow-right',
}

/** O rótulo de uma categoria de fluxo: a seta de direção, na cor da categoria. */
export function FlowIndicator({ tone, className }: { tone: TransactionKind; className?: string }) {
  return (
    <Icon
      name={FLOW_ICON[tone]}
      size={12}
      strokeWidth={2.5}
      aria-hidden="true"
      className={cn('shrink-0', FLOW_TEXT_CLASS[tone], className)}
    />
  )
}

type Emphasis = 'plain' | 'strong' | 'muted' | 'onBlock' | 'auto'

interface MoneyProps {
  cents: Cents
  emphasis?: Emphasis
  compact?: boolean
  /**
   * Prefixa `+`/`−`. Já foi o portador principal da direção, quando não havia
   * cor no sistema; hoje é uma das quatro leituras da Regra das Quatro
   * Leituras, ao lado da seta, do peso da tinta e da cor. Continua obrigatório
   * em coluna de valor: é a única das quatro que sobrevive a uma captura de
   * tela em preto e branco.
   */
  signed?: boolean
  tabular?: boolean
  className?: string
}

/**
 * Exibição de valor monetário.
 *
 * Sem matiz para distinguir entrada de saída, o peso e o sinal fazem esse
 * trabalho: receita ganha `+` e tinta cheia, despesa ganha `−` e tinta comum.
 * O resultado é legível em preto e branco, impresso, e para qualquer tipo de
 * daltonismo — porque não há cor nenhuma para se perder.
 */
const EMPHASIS_CLASS: Record<Exclude<Emphasis, 'auto'>, string> = {
  plain: 'text-ink',
  strong: 'text-ink font-semibold',
  muted: 'text-muted',
  onBlock: 'text-block-ink',
}

export function Money({
  cents,
  emphasis = 'plain',
  compact = false,
  signed = false,
  tabular = true,
  className,
}: MoneyProps) {
  const masked = usePrivacy()
  const resolved: Exclude<Emphasis, 'auto'> =
    emphasis === 'auto' ? (cents === 0 ? 'muted' : 'plain') : emphasis

  const magnitude = Math.abs(cents)
  const formatted = compact
    ? formatCurrencyCompact(magnitude, { masked })
    : formatCurrency(magnitude, { masked })

  const prefix = !signed || masked || cents === 0 ? '' : cents > 0 ? '+' : '−'

  /*
   * A face é a de interface, com algarismos tabulares — e não a monoespaçada.
   *
   * Todo valor monetário já vestiu Geist Mono, pela Regra da Coluna que
   * Alinha. A regra sobrevive; a face não. O que alinha uma coluna por casa
   * decimal é o algarismo de largura fixa, e a Geist tem esse algarismo como
   * variante OpenType (`tnum`). A monoespaçada fixava também a largura de todo
   * o resto — o espaço, o "R", o cifrão — e era isso que abria o vão visível em
   * "R$  2.570,00". O produto de referência escreve todo número em sem serifa.
   *
   * `tabular` desliga só o `tnum`. Ele já foi usado como se desligasse a face
   * monoespaçada, em dois lugares, para fechar esse mesmo vão; não fechava,
   * porque o `font-mono` estava aqui fora da condição.
   */
  return (
    <span className={cn(tabular && 'tnum', EMPHASIS_CLASS[resolved], className)}>
      {prefix}
      {formatted}
    </span>
  )
}

interface DeltaProps {
  cents: Cents
  /** Contra o que a variação é medida. Sem isso o número não significa nada. */
  since: string
  onBlock?: boolean
  className?: string
}

/**
 * Variação contra um período nomeado, em dinheiro.
 *
 * Fica em tinta, sem cor, de propósito — e é a diferença dela para o
 * `DeltaBadge`. Esta vive em prosa, colada a uma frase que já diz o que a
 * variação significa ("R$ 120 a mais que o mês anterior"). Colorir uma frase
 * inteira não acrescenta leitura e tira o sossego do parágrafo.
 */
export function Delta({ cents, since, onBlock = false, className }: DeltaProps) {
  const masked = usePrivacy()

  if (cents === 0) {
    return (
      <span className={cn('text-xs', onBlock ? 'text-block-muted' : 'text-muted', className)}>
        Sem variação {since}
      </span>
    )
  }

  const isUp = cents > 0

  return (
    <span className={cn('inline-flex items-center gap-1.5 text-xs font-medium', className)}>
      <Icon
        name={isUp ? 'arrow-up-right' : 'arrow-down-right'}
        size={13}
        strokeWidth={2.25}
        className={onBlock ? 'text-block-ink' : 'text-ink'}
      />
      <span className={cn('tnum', onBlock ? 'text-block-ink' : 'text-ink')}>
        {isUp ? '+' : '−'}
        {formatCurrency(Math.abs(cents), { masked })}
      </span>
      <span className={onBlock ? 'text-block-muted' : 'text-muted'}>{since}</span>
    </span>
  )
}

interface FigureProps {
  /** O valor em centavos. Omita quando a figura não for dinheiro — ver `value`. */
  cents?: Cents
  /**
   * Uma figura que não é dinheiro: uma contagem, um percentual.
   *
   * Existe porque quatro telas do produto — duas do painel de administração e
   * dois gráficos — escreviam `text-[1.75rem] font-semibold tracking-[-0.03em]`
   * à mão, cada uma com a sua cópia, justamente porque `Figure` só aceitava
   * centavos. Quatro cópias de um estilo é o estilo deixando de existir.
   *
   * Não passa pelo modo privacidade nem pela animação de contagem: nenhuma das
   * duas faz sentido fora de dinheiro. Mascarar "12 usuários" não protege
   * nada, e animar uma contagem que muda de 3 para 4 é ruído.
   */
  value?: ReactNode
  onBlock?: boolean
  /**
   * `'sm'` existe para o painel que tem uma figura própria mas divide a tela
   * com a figura principal. A Regra da Figura Solitária vale por painel, não
   * por página — mas dois números de 44px na mesma tela disputam mesmo em
   * linhas diferentes, e o segundo precisa ceder.
   */
  size?: 'sm' | 'md' | 'lg'
  /**
   * `'auto'` veste a figura na identidade de fluxo pelo sinal — verde se
   * sobrou, terracota se faltou. Reservado a números que já são "o
   * resultado" (positivo é bom, negativo é ruim); um total sem essa
   * polaridade fica em Tinta, o padrão.
   */
  tone?: 'auto'
  /**
   * A palavra pequena e cinza que segue a figura na mesma linha — "saldo
   * total", "acima", "/mês". Sem ela o número fica sem unidade de leitura, e
   * com ela numa linha própria o painel gasta uma altura que não precisava.
   */
  suffix?: string
  className?: string
}

/**
 * A figura: o número que o painel existe para mostrar.
 *
 * Algarismos proporcionais, não tabulares. Neste corpo a largura fixa da face
 * monoespaçada abre buracos visíveis entre os dígitos, e este número não tem
 * coluna nenhuma com que alinhar.
 *
 * A cor do sinal, quando `tone="auto"`, é a única vez que a identidade de
 * fluxo aparece em texto pequeno-o-bastante-para-doer: o corpo de 44–56px
 * conta como texto grande no critério de contraste, o que abre a exceção que
 * o corpo tabular não teria.
 */
export function Figure({
  cents,
  value,
  onBlock = false,
  size = 'md',
  tone,
  suffix,
  className,
}: FigureProps) {
  const masked = usePrivacy()
  const animado = useCountUp(cents ?? 0)

  const corDoSinal =
    tone === 'auto' &&
    !onBlock &&
    cents !== undefined &&
    cents !== 0 &&
    FLOW_TEXT_CLASS[cents > 0 ? 'income' : 'expense']

  return (
    <p
      className={cn(
        // A figura veste a face de interface, em peso 700.
        //
        // Ela já vestiu Figtree 800, a face do logotipo, para amarrar o painel
        // à identidade sem repetir a marca. Isso valia num sistema sem cor,
        // onde a tipografia carregava a expressão inteira. Com o acento em
        // cena a amarração passou a ser a cor, e uma segunda face no número
        // principal virou ruído: duas famílias na mesma tela para dizer o que
        // uma já dizia. Figtree fica só no logotipo.
        'figure font-sans font-bold',
        size === 'lg' && 'text-[2.5rem] sm:text-[3rem]',
        size === 'md' && 'text-[2.5rem]',
        size === 'sm' && 'text-[1.75rem]',
        onBlock ? 'text-block-ink' : (corDoSinal ?? 'text-ink'),
        className,
      )}
    >
      {value ?? (masked ? 'R$ ••••' : formatCurrency(animado))}
      {suffix ? (
        <span
          className={cn(
            // Peso e corpo de rótulo, não de figura: ele acompanha o número
            // sem disputar com ele.
            'ml-2 align-baseline text-base font-medium tracking-normal',
            onBlock ? 'text-block-muted' : 'text-muted',
          )}
        >
          {suffix}
        </span>
      ) : null}
    </p>
  )
}

type DeltaBadgeTone = 'good' | 'bad' | 'neutral'

const DELTA_BADGE_TONE: Record<DeltaBadgeTone, string> = {
  /*
   * Fundo tingido a 15%, texto na cor cheia. Preencher a pastilha com a cor
   * sólida exigiria tinta preta por cima e criaria um segundo bloco de alto
   * contraste ao lado da figura — a variação passaria a gritar mais alto que
   * o número que ela qualifica.
   */
  good: 'bg-income/15 text-income',
  bad: 'bg-expense/15 text-expense',
  neutral: 'bg-sunken text-muted',
}

interface DeltaBadgeProps {
  /** A variação em pontos percentuais. O sinal decide a seta. */
  percent: number
  /**
   * Se subir é bom ou ruim. Não dá para derivar do sinal: gasto que sobe é
   * ruim, receita que sobe é boa, e a mesma seta para cima serve às duas.
   */
  tone?: DeltaBadgeTone
  className?: string
}

/**
 * A variação como pastilha tingida.
 *
 * Difere de `Delta`, que diz a variação em dinheiro contra um período
 * nomeado e vive em prosa. Esta é percentual, mora colada na figura, e a cor
 * dela codifica **julgamento** — se a mudança é boa ou ruim — e não direção.
 * Por isso `tone` é explícito: a seta para cima é boa numa receita e ruim num
 * gasto, e nenhum sinal sozinho resolve isso.
 *
 * A seta continua sendo a leitura que sobrevive sem cor.
 */
export function DeltaBadge({ percent, tone = 'neutral', className }: DeltaBadgeProps) {
  const subiu = percent > 0

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold',
        DELTA_BADGE_TONE[tone],
        className,
      )}
    >
      <Icon
        name={subiu ? 'trending-up' : 'trending-down'}
        size={13}
        strokeWidth={2.25}
        aria-hidden="true"
      />
      {/*
        Face de interface, não a monoespaçada. A Regra da Coluna que Alinha
        vale para valor em coluna, e uma pastilha solta não tem coluna com que
        alinhar — na face tabular a vírgula ganha folga dos dois lados e o
        número lê como "115 ,9".
      */}
      <span>
        {subiu ? '+' : '−'}
        {Math.abs(percent).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%
      </span>
    </span>
  )
}
