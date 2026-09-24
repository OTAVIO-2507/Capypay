import { useEffect, useRef, type ReactNode } from 'react'
import { IconButton } from '@/components/ui/Button'
import { cn } from '@/lib/cn'

interface DrawerProps {
  open: boolean
  onClose: () => void
  /** Nome do painel para leitor de tela — o cabeçalho é livre e pode não ter título. */
  label: string
  children: ReactNode
  className?: string
}

/**
 * Painel lateral, preso à borda direita, sobre o elemento nativo `<dialog>`.
 *
 * Pelos mesmos motivos do `Dialog`: o navegador já dá camada superior,
 * armadilha de foco, Esc e a página de trás inerte. A diferença é de lugar e
 * de uso. O diálogo central pede uma decisão; o painel lateral mostra detalhe
 * de algo que continua visível atrás dele, e por isso ocupa só um lado da tela.
 *
 * Entra deslizando da direita, e só quando o sistema não pediu menos
 * movimento: com `prefers-reduced-motion`, ele aparece já no lugar.
 */
export function Drawer({ open, onClose, label, children, className }: DrawerProps) {
  const ref = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    if (open && !dialog.open) {
      dialog.showModal()
      // O foco começa no Fechar. Sem isto, o navegador escolhe o primeiro
      // elemento focável, e o contêiner que rola é focável: o foco caía no
      // painel inteiro, com o anel em volta de tudo.
      dialog.querySelector<HTMLButtonElement>('[data-drawer-close]')?.focus()
    } else if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const dialog = ref.current
    if (!dialog) return
    // Esc fecha o elemento por conta própria; escutar mantém o React em dia.
    const aoFechar = () => onClose()
    dialog.addEventListener('close', aoFechar)
    return () => dialog.removeEventListener('close', aoFechar)
  }, [onClose])

  return (
    <dialog
      ref={ref}
      aria-label={label}
      onClick={(evento) => {
        // Clique no fundo escurecido, fora do painel, fecha.
        if (evento.target === ref.current) onClose()
      }}
      className={cn(
        'm-0 ml-auto h-dvh max-h-dvh w-full max-w-[32rem] border-l border-hairline bg-sheet p-0 text-ink',
        'backdrop:bg-[var(--scrim)]',
        'motion-safe:open:animate-[drawer-in_260ms_cubic-bezier(0.16,1,0.3,1)]',
        className,
      )}
    >
      <div className="relative h-full overflow-y-auto">
        <IconButton
          icon="x"
          label="Fechar"
          size="sm"
          onClick={onClose}
          data-drawer-close=""
          className="absolute top-4 right-4 z-10"
        />
        {open ? children : null}
      </div>
    </dialog>
  )
}
