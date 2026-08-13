import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

interface SheetProps {
  children: ReactNode
  className?: string
  /** Remove o preenchimento interno, para folhas que hospedam tabela. */
  flush?: boolean
  as?: 'div' | 'section' | 'article'
}

/**
 * A folha: o painel branco apoiado sobre a mesa.
 *
 * A sombra tem duas camadas de propósito. A curta é o contato — o escurecimento
 * logo abaixo da borda, onde o papel encosta. A longa é a difusão. Uma sombra
 * de camada única fica ou dura demais ou vaga demais; é a soma das duas que
 * lê como objeto apoiado em vez de retângulo com efeito.
 */
export function Card({ children, className, flush = false, as: Tag = 'div' }: SheetProps) {
  return (
    <Tag
      className={cn(
        'rounded-lg border border-hairline bg-sheet shadow-[var(--shadow-sheet)]',
        !flush && 'p-6',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

/**
 * O bloco de tinta: o único acento do sistema.
 *
 * Num campo sem cor, um retângulo preenchido é o evento mais alto disponível.
 * Por isso a regra de no máximo três por tela — passando disso ele deixa de
 * significar "isto importa".
 */
export function BlockPanel({ children, className, flush = false, as: Tag = 'div' }: SheetProps) {
  return (
    <Tag
      className={cn(
        'rounded-lg bg-block text-block-ink shadow-[var(--shadow-block)]',
        !flush && 'p-6',
        className,
      )}
    >
      {children}
    </Tag>
  )
}

interface CardHeaderProps {
  title: ReactNode
  description?: ReactNode
  action?: ReactNode
  /** Usa a tinta invertida, para cabeçalhos dentro de um bloco. */
  onBlock?: boolean
  className?: string
}

/**
 * Cabeçalho de folha. O corpo é separado por espaço, não por divisor — uma
 * linha em cada painel multiplicaria hairlines numa tela que já é densa.
 */
export function CardHeader({
  title,
  description,
  action,
  onBlock = false,
  className,
}: CardHeaderProps) {
  return (
    <div className={cn('mb-5 flex items-start justify-between gap-3', className)}>
      <div className="min-w-0">
        <h2
          className={cn(
            'text-base font-semibold tracking-[-0.02em]',
            onBlock ? 'text-block-ink' : 'text-ink',
          )}
        >
          {title}
        </h2>
        {description ? (
          <p className={cn('mt-1 text-xs', onBlock ? 'text-block-muted' : 'text-muted')}>
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="flex shrink-0 items-center gap-1.5">{action}</div> : null}
    </div>
  )
}

/**
 * Agrupamento interno. Usa a superfície rebaixada em vez de uma segunda folha:
 * folha dentro de folha é proibido pelo sistema.
 */
export function CardWell({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('rounded-md bg-sunken p-4', className)}>{children}</div>
}
