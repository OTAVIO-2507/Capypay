import { useEffect, useRef, type ReactNode } from 'react'
import { IconButton } from './Button'
import { cn } from '@/lib/cn'

interface DialogProps {
  open: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
  footer?: ReactNode
  /**
   * `lg` existe para formulário que cabe melhor em duas colunas do que numa
   * pilha: acima de uma certa altura o diálogo passa a rolar por dentro, e
   * rolagem dentro de modal esconde o botão de confirmar, que é justamente o
   * que a pessoa está procurando.
   */
  size?: 'sm' | 'md' | 'lg'
}

const LARGURAS: Record<NonNullable<DialogProps['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-2xl',
}

/**
 * Diálogo sobre o elemento nativo `<dialog>`.
 *
 * Escolhido em vez de uma div posicionada porque o navegador já entrega o que
 * um modal precisa e é fácil errar à mão: camada superior (nunca recortado por
 * um ancestral com `overflow`), armadilha de foco, fechamento por Esc e
 * inertização do resto da página. O que sobra para nós é o visual.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    else if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    // Esc dispara `close` do próprio elemento; escutar aqui mantém o estado do
    // React em sincronia com o que o navegador já fez.
    const handleClose = () => onClose()
    dialog.addEventListener('close', handleClose)
    return () => dialog.removeEventListener('close', handleClose)
  }, [onClose])

  return (
    <dialog
      ref={ref}
      aria-labelledby="dialog-title"
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className={cn(
        'm-auto w-[calc(100vw-2rem)] rounded-lg border border-hairline bg-sheet p-0 text-ink',
        'shadow-[var(--shadow-float)] backdrop:bg-[var(--scrim)]',
        LARGURAS[size],
      )}
    >
      <div className="flex items-start justify-between gap-4 p-6 pb-0">
        <div>
          <h2 id="dialog-title" className="text-base font-semibold tracking-[-0.02em]">
            {title}
          </h2>
          {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
        </div>
        <IconButton icon="x" label="Fechar" size="sm" onClick={onClose} />
      </div>

      <div className="p-6">{children}</div>

      {footer ? <div className="flex justify-end gap-2 px-6 pb-6">{footer}</div> : null}
    </dialog>
  )
}

interface ConfirmDialogProps {
  open: boolean
  onClose: () => void
  onConfirm: () => void
  title: string
  /** Diga o que será perdido, em números quando possível. */
  message: ReactNode
  confirmLabel: string
}

/**
 * Confirmação de ação destrutiva.
 *
 * Sem vermelho disponível, a gravidade vem do peso: o botão de confirmar é o
 * bloco de tinta cheia, e a mensagem nomeia exatamente o que desaparece.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  message,
  confirmLabel,
}: ConfirmDialogProps) {
  return (
    <Dialog open={open} onClose={onClose} title={title} size="sm">
      <p className="text-[0.8125rem] leading-relaxed text-muted">{message}</p>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-11 items-center rounded-full px-5 text-[0.8125rem] font-semibold text-muted transition-colors duration-150 hover:bg-sunken hover:text-ink"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={() => {
            onConfirm()
            onClose()
          }}
          className="inline-flex h-11 items-center rounded-full bg-block px-5 text-[0.8125rem] font-semibold text-block-ink transition-colors duration-150 hover:bg-block-hover"
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
