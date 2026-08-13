import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from '@/components/Icon'
import { cn } from '@/lib/cn'

type Variant = 'primary' | 'quiet' | 'ghost' | 'onBlock'
type Size = 'sm' | 'md'

/**
 * Sem cor de acento, a hierarquia dos botões vem só de preenchimento e peso:
 * tinta cheia para a ação principal, superfície rebaixada para a secundária,
 * nada para a terciária.
 */
const VARIANTS: Record<Variant, string> = {
  primary: 'bg-block text-block-ink hover:bg-block-hover',
  quiet: 'bg-sunken text-ink hover:bg-hairline',
  ghost: 'bg-transparent text-muted hover:bg-sunken hover:text-ink',
  // Para uso dentro de um bloco de tinta, onde as variantes normais sumiriam.
  onBlock: 'bg-block-ink/12 text-block-ink hover:bg-block-ink/20',
}

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-3.5 text-xs gap-1.5',
  md: 'h-11 px-5 text-[0.8125rem] gap-2',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  icon?: IconName
  iconEnd?: IconName
  block?: boolean
  loading?: boolean
  children?: ReactNode
  /**
   * Marca o botão como alvo do tour de boas-vindas
   * (`features/onboarding/tourSteps.ts`). Declarado explicitamente porque o
   * tipo de props do React não aceita `data-*` arbitrário em componente de
   * função — sem isto, marcar um botão exigiria envolvê-lo numa caixa a mais
   * só para pendurar o atributo.
   */
  'data-tour'?: string
}

export function Button({
  variant = 'primary',
  size = 'md',
  icon,
  iconEnd,
  block = false,
  loading = false,
  disabled,
  className,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        'group/btn inline-flex items-center justify-center rounded-full font-semibold whitespace-nowrap',
        // A resposta ao toque é o que separa um botão de uma etiqueta clicável:
        // ele cede um pouco sob o dedo e volta. Escala, não cor — cor já está
        // ocupada pelo estado de hover.
        'transition-[background-color,color,transform] duration-150 active:scale-[0.97]',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
        VARIANTS[variant],
        SIZES[size],
        block && 'w-full',
        className,
      )}
      {...props}
    >
      {icon ? (
        <Icon
          name={icon}
          size={size === 'sm' ? 14 : 16}
          // O ícone principal se adianta ao texto no hover, insinuando a ação.
          className="transition-transform duration-200 group-hover/btn:-translate-y-px"
        />
      ) : null}
      {children}
      {iconEnd ? <Icon name={iconEnd} size={size === 'sm' ? 14 : 16} /> : null}
    </button>
  )
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  /** Obrigatório: um botão só de ícone precisa de nome acessível. */
  label: string
  variant?: Extract<Variant, 'ghost' | 'quiet' | 'onBlock'>
  size?: Size
}

export function IconButton({
  icon,
  label,
  variant = 'ghost',
  size = 'md',
  className,
  ...props
}: IconButtonProps) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-sm',
        'transition-[background-color,color,transform] duration-150 active:scale-90',
        'disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100',
        VARIANTS[variant],
        size === 'sm' ? 'size-9' : 'size-11',
        className,
      )}
      {...props}
    >
      <Icon name={icon} size={size === 'sm' ? 15 : 18} />
    </button>
  )
}
