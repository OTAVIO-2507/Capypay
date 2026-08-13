import { Wordmark } from '@/components/Wordmark'

/**
 * Preenche a tela inteira enquanto sessão ou dados carregam.
 *
 * Antes, ler `localStorage` era síncrono e a tela nunca tinha nada para
 * esperar. Sessão e dados agora vêm de rede, então este é o estado que
 * aparece entre abrir a aba e saber se há alguém logado, e entre logar e os
 * dados da conta chegarem.
 */
export function FullPageLoader() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-desk">
      <Wordmark />
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-hairline-strong border-t-ink"
      />
      <span className="sr-only">Carregando…</span>
    </div>
  )
}
