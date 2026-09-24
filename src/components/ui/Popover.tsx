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
  /**
   * De que lado do gatilho o painel se alinha. `end` (padrão) abre para a
   * esquerda, que é o certo para menu no canto direito da tela; `start` abre
   * para a direita, para gatilho na borda esquerda, onde `end` jogaria o
   * painel para fora da janela.
   */
  align?: 'start' | 'end'
  /**
   * De que lado do gatilho o painel abre. `bottom` é o padrão; `top` existe
   * para o gatilho que mora no pé da tela — o avatar no fim da barra lateral,
   * cujo menu abriria fora da janela se descesse.
   */
  placement?: 'bottom' | 'top'
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
export function Popover({
  trigger,
  children,
  width = 300,
  label,
  align = 'end',
  placement = 'bottom',
}: PopoverProps) {
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
          // O teto de largura segura o painel dentro da janela no celular,
          // onde 320px de painel e 16px de margem não cabem em 360px de tela.
          style={{ width, maxWidth: 'calc(100vw - 2rem)' }}
          className={cn(
            'absolute z-50 overflow-hidden',
            placement === 'top' ? 'bottom-full mb-2' : 'top-full mt-2',
            align === 'end' ? 'right-0' : 'left-0',
            placement === 'top'
              ? align === 'end'
                ? 'origin-bottom-right'
                : 'origin-bottom-left'
              : align === 'end'
                ? 'origin-top-right'
                : 'origin-top-left',
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
