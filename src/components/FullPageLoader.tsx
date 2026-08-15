import { Wordmark } from '@/components/Wordmark'

/**
 * Preenche a tela inteira enquanto sessão ou dados carregam.
 *
 * Antes, ler `localStorage` era síncrono e a tela nunca tinha nada para
 * esperar. Sessão e dados agora vêm de rede, então este é o estado que
 * aparece entre abrir a aba e saber se há alguém logado, e entre logar e os
 * dados da conta chegarem.
 *
 * Veste o extremo da escala, e não a Folha: branco puro no claro, preto puro
 * no escuro. A mesa só existe para ter folhas apoiadas nela, e aqui não há
 * nenhuma — mas a folha do escuro é #0A0B0D, e três pontos acima do preto
 * ocupando a tela inteira leem como cinza chapado, porque não há nenhuma
 * outra superfície com que comparar. Sem vizinha, a superfície pode ir ao
 * extremo.
 */
export function FullPageLoader() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 bg-void">
      <Wordmark />
      <span
        aria-hidden="true"
        className="size-5 animate-spin rounded-full border-2 border-hairline-strong border-t-ink"
      />
      <span className="sr-only">Carregando…</span>
    </div>
  )
}
