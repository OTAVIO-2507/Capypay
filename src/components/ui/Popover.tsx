import { useEffect, useId, useRef, useState, type ReactNode } from 'react'
import { useLocation } from 'react-router-dom'
import { cn } from '@/lib/cn'

interface PopoverProps {
  /** Recebe o estado para o gatilho poder se marcar como aberto. */
  trigger: (props: {
    open: boolean
    toggle: () => void
    id: string
    controls: string
  }) => ReactNode
  children: (props: { close: () => void }) => ReactNode
  /** Largura do painel. */
  width?: number
  label: string
}

/**
 * Menu suspenso ancorado ao gatilho.
 *
 * Cobre as três coisas que um menu deste tipo erra quando é feito às pressas:
 * fecha ao clicar fora, fecha com Esc devolvendo o foco ao gatilho, e fecha ao
 * navegar — sem isso ele fica aberto por cima da tela nova.
 *
 * Fica posicionado por `absolute` dentro de um pai relativo, e não em camada
 * superior, porque nenhum ancestral da barra de topo recorta o conteúdo. Se um
 * dia recortar, isto vira `<dialog>` ou a API de popover.
 */
export function Popover({ trigger, children, width = 300, label }: PopoverProps) {
  const [open, setOpen] = useState(false)
  const wrapperRef = useRef<HTMLDivElement>(null)
  const triggerRef = useRef<HTMLElement | null>(null)
  const id = useId()
  const panelId = `${id}-panel`
  const { pathname } = useLocation()

  const close = () => setOpen(false)

  // Navegar fecha o menu. Um menu que sobrevive à troca de rota fica órfão,
  // apontando para uma tela que não está mais ali.
  useEffect(() => setOpen(false), [pathname])

  useEffect(() => {
    if (!open) return

    const aoClicar = (event: MouseEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      setOpen(false)
      // Devolver o foco é o que permite continuar navegando por teclado do
      // ponto onde se estava, em vez de voltar para o início do documento.
      triggerRef.current?.focus()
    }

    document.addEventListener('mousedown', aoClicar)
    document.addEventListener('keydown', aoTeclar)
    return () => {
      document.removeEventListener('mousedown', aoClicar)
      document.removeEventListener('keydown', aoTeclar)
    }
  }, [open])

  return (
    <div ref={wrapperRef} className="relative">
      <span
        ref={(node) => {
          triggerRef.current = node?.querySelector('button') ?? null
        }}
      >
        {trigger({ open, toggle: () => setOpen((v) => !v), id, controls: panelId })}
      </span>

      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={label}
          style={{ width }}
          className={cn(
            'absolute top-full right-0 z-50 mt-2 origin-top-right overflow-hidden',
            'rounded-md border border-hairline bg-sheet shadow-[var(--shadow-float)]',
            'motion-safe:animate-[popover_160ms_cubic-bezier(0.16,1,0.3,1)]',
          )}
        >
          {children({ close })}
        </div>
      ) : null}
    </div>
  )
}
