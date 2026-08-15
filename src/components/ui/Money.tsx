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
   * Prefixa `+`/`−`. Num sistema sem cor, este é o portador principal do
   * sinal — não um reforço.
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

  return (
    <span className={cn('font-mono', tabular && 'tnum', EMPHASIS_CLASS[resolved], className)}>
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

/** Variação contra um período nomeado. Seta e sinal, sem cor. */
export function Delta({ cents, since, onBlock = false, className }: DeltaProps) {
  const masked = usePrivacy()

  if (cents === 0) {
    return (
      <span className={cn('text-xs', onBlock ? 'text-block-muted' : 'text-muted', className)}>
        Igual {since}
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
      <span className={cn('tnum font-mono', onBlock ? 'text-block-ink' : 'text-ink')}>
        {isUp ? '+' : '−'}
        {formatCurrency(Math.abs(cents), { masked })}
      </span>
      <span className={onBlock ? 'text-block-muted' : 'text-muted'}>{since}</span>
    </span>
  )
}

interface FigureProps {
  cents: Cents
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
export function Figure({ cents, onBlock = false, size = 'md', tone, className }: FigureProps) {
  const masked = usePrivacy()
  const animado = useCountUp(cents)

  const corDoSinal =
    tone === 'auto' && !onBlock && cents !== 0 && FLOW_TEXT_CLASS[cents > 0 ? 'income' : 'expense']

  return (
    <p
      className={cn(
        // A figura veste a face da marca, e não a de interface. É o número que
        // a tela existe para mostrar; dar a ele o desenho do logotipo amarra o
        // painel à identidade sem repetir a marca em lugar nenhum.
        'figure font-[Figtree_Variable,var(--font-sans)] font-extrabold',
        size === 'lg' && 'text-[2.75rem] sm:text-[3.5rem]',
        size === 'md' && 'text-[2.75rem]',
        size === 'sm' && 'text-[2rem]',
        onBlock ? 'text-block-ink' : (corDoSinal ?? 'text-ink'),
        className,
      )}
    >
      {masked ? 'R$ ••••' : formatCurrency(animado)}
    </p>
  )
}
