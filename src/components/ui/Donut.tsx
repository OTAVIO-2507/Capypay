import { cn } from '@/lib/cn'

const TONE_STROKE = {
  income: 'stroke-income',
  expense: 'stroke-expense',
} as const

const TONE_TEXT = {
  income: 'text-income',
  expense: 'text-expense',
} as const

interface DonutProps {
  /** Percentual de 0 a 100 para o arco. */
  value: number
  /** Percentual real, que pode passar de 100. Usado no rótulo. */
  rawValue?: number
  label: string
  /** Inverte as cores para uso dentro de um bloco de tinta. */
  onBlock?: boolean
  /**
   * Veste o arco (e o número) na identidade de fluxo, para status positivo
   * ou negativo — reserva de emergência avançando, orçamento estourado.
   * Omitido, o arco fica em Tinta: nem toda barra de progresso é alerta.
   */
  tone?: keyof typeof TONE_STROKE
  size?: number
  className?: string
}

/**
 * Anel de progresso.
 *
 * Um arco funciona aqui — e não como substituto de gráfico — porque compara
 * uma coisa só contra o seu próprio limite, que é exatamente o caso em que a
 * leitura de ângulo não atrapalha. O número no centro carrega o valor exato;
 * o arco carrega a sensação de "quanto falta".
 */
export function Donut({
  value,
  rawValue,
  label,
  onBlock = false,
  tone,
  size = 108,
  className,
}: DonutProps) {
  const stroke = Math.round(size * 0.1)
  const radius = (size - stroke) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(Math.min(value, 100), 0)
  const display = Math.round(rawValue ?? value)

  return (
    <div className={cn('relative inline-flex shrink-0', className)} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className={onBlock ? 'stroke-block-ink/20' : 'stroke-sunken'}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - clamped / 100)}
          className={cn(
            'transition-[stroke-dashoffset,stroke] duration-500',
            tone ? TONE_STROKE[tone] : onBlock ? 'stroke-block-ink' : 'stroke-ink',
          )}
        />
      </svg>

      <span className="absolute inset-0 flex items-center justify-center">
        <span
          className={cn(
            'tnum text-lg font-semibold tracking-[-0.03em]',
            tone ? TONE_TEXT[tone] : onBlock ? 'text-block-ink' : 'text-ink',
          )}
        >
          {display}%
        </span>
      </span>

      <span className="sr-only">{label}</span>
    </div>
  )
}
