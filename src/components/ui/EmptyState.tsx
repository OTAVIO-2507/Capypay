import type { ReactNode } from 'react'
import { Icon, type IconName } from '@/components/Icon'
import { cn } from '@/lib/cn'

interface EmptyStateProps {
  icon: IconName
  title: string
  /** Explique o que aparecerá aqui e como fazer aparecer. */
  description: string
  action?: ReactNode
  size?: 'sm' | 'md'
  className?: string
}

/**
 * Estado vazio.
 *
 * Não é caso de borda neste produto: é a primeira tela de quem abre a
 * demonstração pública. Por isso ensina o que a área faz em vez de anunciar
 * que não há nada — "Nenhum dado encontrado" não ajuda ninguém a começar.
 */
export function EmptyState({
  icon,
  title,
  description,
  action,
  size = 'md',
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center text-center',
        size === 'sm' ? 'gap-2.5 py-10' : 'gap-3 py-14',
        className,
      )}
    >
      <span
        className={cn(
          'inline-flex items-center justify-center rounded-full bg-sunken text-faint',
          size === 'sm' ? 'size-10' : 'size-14',
        )}
      >
        <Icon name={icon} size={size === 'sm' ? 18 : 24} />
      </span>
      <div className="max-w-[44ch]">
        <p className={cn('font-semibold text-ink', size === 'sm' ? 'text-[0.8125rem]' : 'text-sm')}>
          {title}
        </p>
        <p className="mt-1.5 text-xs leading-relaxed text-muted">{description}</p>
      </div>
      {action ? <div className="mt-1.5">{action}</div> : null}
    </div>
  )
}
