import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/Icon'
import { cn } from '@/lib/cn'

interface ToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  label: string
  description?: string
  icon?: IconName
}

export function Toggle({ checked, onChange, label, description, icon }: ToggleProps) {
  return (
    <label className="flex cursor-pointer items-center justify-between gap-4">
      <span className="flex min-w-0 items-center gap-2.5">
        {icon ? <Icon name={icon} size={16} className="text-faint" /> : null}
        <span className="min-w-0">
          <span className="block text-[0.8125rem] font-medium text-ink">{label}</span>
          {description ? <span className="block text-xs text-muted">{description}</span> : null}
        </span>
      </span>
      <span className="relative inline-flex shrink-0">
        <input
          type="checkbox"
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="peer sr-only"
        />
        <span
          aria-hidden="true"
          className={cn(
            'block h-6 w-11 rounded-full transition-colors duration-150',
            'peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
            // Ligado veste o acento, e é um dos poucos lugares onde ele aparece
            // sem ser a ação principal da tela. Um interruptor é exatamente o
            // que a lima faz melhor: dizer "isto está valendo" de longe, sem
            // texto. Desligado fica no trilho neutro, sem cor nenhuma.
            checked ? 'bg-accent' : 'bg-hairline-strong',
          )}
        />
        <span
          aria-hidden="true"
          className={cn(
            'pointer-events-none absolute top-0.5 left-0.5 size-5 rounded-full transition-transform duration-150',
            checked ? 'translate-x-5 bg-accent-ink' : 'bg-sheet',
          )}
        />
      </span>
    </label>
  )
}

export interface SegmentOption<T extends string> {
  value: T
  label: string
  icon?: IconName
}

interface SegmentedProps<T extends string> {
  options: readonly SegmentOption<T>[]
  value: T
  onChange: (value: T) => void
  label: string
  size?: 'sm' | 'md'
  /**
   * `solid` é a escolha dentro de um formulário: Despesa, Receita, Aporte.
   * `tint` é o filtro de uma lista — "Em andamento (2)" — e segue o produto de
   * referência: sem trilho, e a aba escolhida tingida de acento.
   */
  variant?: 'solid' | 'tint'
  className?: string
}

/**
 * Abas segmentadas. O selecionado veste a pílula clara de contraste máximo —
 * a mesma da ação principal.
 *
 * Não veste o acento, e isso é decisão: o acento diz "positivo" ou "ativo", e
 * uma aba selecionada não é nenhuma das duas — é só onde você está. Gastar a
 * cor aqui a esvaziaria nos lugares onde ela significa algo.
 *
 * A exceção é `variant="tint"`, e ela é a mesma das abas de seção no topo: o
 * produto de referência marca com acento o lugar onde se está na navegação e
 * nos filtros de lista, e a tela seguir a referência foi pedido explícito. O
 * acento aí vai tingido a 12%, nunca sólido, e a escolha dentro de formulário
 * continua na pílula clara.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  size = 'md',
  variant = 'solid',
  className,
}: SegmentedProps<T>) {
  const tint = variant === 'tint'

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={cn('flex gap-1 rounded-full', !tint && 'bg-sunken p-1', className)}
    >
      {options.map((option) => {
        const selected = option.value === value
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => onChange(option.value)}
            className={cn(
              'inline-flex flex-1 items-center justify-center gap-1.5 rounded-full font-semibold whitespace-nowrap',
              'transition-colors duration-150',
              tint
                ? 'h-11 px-5 text-[0.8125rem]'
                : size === 'sm'
                  ? 'h-7 px-3 text-xs'
                  : 'h-9 px-4 text-[0.8125rem]',
              selected
                ? tint
                  ? 'bg-accent/12 text-accent'
                  : 'bg-block text-block-ink'
                : 'text-muted hover:text-ink',
            )}
          >
            {option.icon ? <Icon name={option.icon} size={14} /> : null}
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

/**
 * Ênfase de um distintivo.
 *
 * `quiet` é o padrão e não carrega estado nenhum — é só uma etiqueta.
 * `accent` diz "isto está valendo": assinatura ativa, parcelamento em
 * andamento. `attention` diz "isto pede acompanhamento", e `strong` é a
 * pastilha de contraste máximo, reservada ao alerta.
 *
 * Os três tingidos usam a cor a 15% no fundo e cheia no texto, como o resto
 * do sistema — nunca a cor sólida com tinta por cima, que num distintivo de
 * doze pixels vira uma mancha antes de virar uma palavra.
 */
type BadgeTone = 'quiet' | 'accent' | 'attention' | 'strong' | 'outline'

const BADGE_TONE: Record<BadgeTone, string> = {
  quiet: 'bg-sunken text-muted',
  accent: 'bg-accent/15 text-accent',
  attention: 'bg-attention/15 text-attention',
  strong: 'bg-block text-block-ink',
  outline: 'border border-hairline-strong text-ink',
}

interface BadgeProps {
  children: ReactNode
  tone?: BadgeTone
  icon?: IconName
  className?: string
}

export function Badge({ children, tone = 'quiet', icon, className }: BadgeProps) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium',
        BADGE_TONE[tone],
        className,
      )}
    >
      {icon ? <Icon name={icon} size={12} /> : null}
      {children}
    </span>
  )
}

const TONE_BG = {
  income: 'bg-income',
  expense: 'bg-expense',
} as const

const TONE_TEXT = {
  income: 'text-income',
  expense: 'text-expense',
} as const

interface ProgressProps {
  /** De 0 a 100. Acima disso, use `overflow` para mostrar o transbordo. */
  value: number
  label: string
  /** Percentual real quando passa de 100. Desenha o transbordo hachurado. */
  overflow?: number
  /** Inverte para uso sobre a pílula clara, onde a tinta normal sumiria. */
  onBlock?: boolean
  /**
   * Veste o preenchimento na identidade de fluxo, para status positivo ou
   * negativo — dentro do limite, acima dele. Omitido, a barra fica em
   * Tinta: nem todo progresso é sinal de alerta ou de saúde financeira.
   */
  tone?: keyof typeof TONE_BG
  className?: string
}

/**
 * Barra de progresso.
 *
 * O estouro nunca depende só de cor: a barra enche por completo e o excesso
 * aparece como faixa hachurada, uma diferença de textura que sobrevive ao
 * preto e branco, à impressão e à cor que falta enxergar. `tone`, quando
 * presente, soma a identidade de fluxo a essa leitura — nunca a substitui.
 */
export function Progress({
  value,
  label,
  overflow,
  onBlock = false,
  tone,
  className,
}: ProgressProps) {
  const exceeded = typeof overflow === 'number' && overflow > 100
  const overflowWidth = exceeded ? Math.min(overflow - 100, 100) : 0

  return (
    <div
      role="progressbar"
      aria-valuenow={Math.round(overflow ?? value)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
      className={cn(
        'flex h-2 w-full overflow-hidden rounded-full',
        onBlock ? 'bg-block-ink/20' : 'bg-sunken',
        className,
      )}
    >
      <div
        className={cn(
          'h-full transition-[width,background-color] duration-300',
          tone ? TONE_BG[tone] : onBlock ? 'bg-block-ink' : 'bg-ink',
        )}
        style={{ width: `${Math.max(Math.min(value, 100), 0)}%` }}
      />
      {exceeded ? (
        <div
          className={cn('h-full transition-[width] duration-300', tone ? TONE_TEXT[tone] : undefined)}
          style={{
            width: `${overflowWidth}%`,
            // Hachura a 45°: a textura carrega o estouro onde a cor não pode.
            backgroundImage: `repeating-linear-gradient(45deg, currentColor 0 2px, transparent 2px 5px)`,
          }}
        />
      ) : null}
    </div>
  )
}
