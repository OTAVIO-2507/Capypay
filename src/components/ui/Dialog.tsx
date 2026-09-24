import { useId, useEffect, useRef, type ReactNode } from 'react'
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
  /** Ação ao lado do título, antes do fechar — o "Editar" de um detalhe. */
  headerAction?: ReactNode
  /**
   * Onde o foco pousa ao abrir.
   *
   * `auto`, o padrão, deixa valer a regra do navegador — e, com ela, o
   * `autoFocus` que um formulário tenha declarado num campo.
   *
   * `dialog` põe o foco no próprio diálogo, e existe para o **detalhe**: ali o
   * primeiro elemento focável é o "Editar" do cabeçalho, e a janela abria com
   * um anel verde em volta de uma ação que ninguém pediu. Com o foco no
   * contêiner, o leitor de tela anuncia o título e o Tab segue dali para
   * dentro, sem nada destacado antes de a pessoa escolher.
   *
   * Isto já foi incondicional, e a conta chegou: `dialog.focus()` logo depois
   * de `showModal()` atropela o `autoFocus` que o React acabou de aplicar, e
   * os dois formulários de perfil do produto abriam com o campo do nome
   * **sem** foco.
   */
  initialFocus?: 'auto' | 'dialog'
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
  headerAction,
  initialFocus = 'auto',
}: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null)
  // Um id por diálogo. Era o texto fixo "dialog-title", e uma tela com quatro
  // diálogos montados — Transações tem novo, editar, detalhe e excluir —
  // tinha quatro títulos com o mesmo id: o leitor de tela anunciava o
  // primeiro deles, qualquer que fosse o diálogo aberto.
  const tituloId = useId()

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // Ver `initialFocus`: só o detalhe pede o foco no contêiner.
      if (initialFocus === 'dialog') dialog.focus()
    } else if (!open && dialog.open) {
      dialog.close()
    }
  }, [open, initialFocus])

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
      // Focável por código, nunca pelo Tab: é o alvo do foco na abertura.
      tabIndex={-1}
      aria-labelledby={tituloId}
      onClick={(event) => {
        if (event.target === ref.current) onClose()
      }}
      className={cn(
        'm-auto w-[calc(100vw-2rem)] rounded-lg border border-hairline bg-sheet p-0 text-ink',
        'shadow-[var(--shadow-float)] backdrop:bg-[var(--scrim)]',
        // Sem anel no próprio diálogo: ele recebe o foco na abertura, e um
        // contorno em volta da janela inteira não orienta ninguém.
        'focus:outline-none',
        LARGURAS[size],
      )}
    >
      <div className="flex items-start justify-between gap-4 p-6 pb-0">
        <div>
          <h2 id={tituloId} className="text-base font-semibold tracking-[-0.02em]">
            {title}
          </h2>
          {description ? <p className="mt-1 text-xs text-muted">{description}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {headerAction}
          <IconButton icon="x" label="Fechar" size="sm" onClick={onClose} />
        </div>
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
 * A gravidade vinha só do peso, porque não havia vermelho no sistema. Agora
 * há: o botão de confirmar veste a despesa, e a mensagem continua nomeando
 * exatamente o que desaparece.
 *
 * A cor entra aqui e não vira regra geral de botão. Ela é o **último** aviso
 * antes de um apagamento sem volta, e um vermelho que aparecesse em qualquer
 * botão secundário não teria peso nenhum neste.
 *
 * Tinta quase-preta sobre o vermelho, como no distintivo de urgência: branco
 * sobre `--expense` dá 3,61:1.
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
          className="inline-flex h-11 items-center rounded-full bg-expense px-5 text-[0.8125rem] font-semibold text-desk transition-colors duration-150 hover:opacity-90"
        >
          {confirmLabel}
        </button>
      </div>
    </Dialog>
  )
}
