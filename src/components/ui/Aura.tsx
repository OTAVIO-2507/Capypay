import { lazy, Suspense } from 'react'
import { cn } from '@/lib/cn'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'

/*
 * O Three.js entra por importação tardia, num pedaço próprio do build: ele
 * pesa mais que o aplicativo inteiro, e ninguém deve baixá-lo para ver uma
 * tabela de transações. Enquanto o pedaço não chega — ou se ele nunca chegar,
 * porque a rede caiu ou o aparelho não tem WebGL —, o fundo em CSS já está
 * desenhado embaixo.
 */
const AuraCanvas = lazy(() => import('@/features/motion/AuraCanvas'))

/**
 * A mancha de luz do fundo de um painel — o elemento abstrato que o produto de
 * referência usa atrás da saudação.
 *
 * São dois gradientes radiais, e não uma imagem nem um `filter: blur`. O
 * gradiente já nasce suave, custa nada para compor e escala com o card; um
 * blur de 100px sobre um elemento grande é a conta mais cara que uma tela
 * parada pode pagar, e uma imagem precisaria de duas versões e de um pedido de
 * rede para algo que ninguém veio ver.
 *
 * As cores são as do sistema: o acento e o azul do limite, ambos em opacidade
 * baixa (no máximo 22%). Não entra matiz novo para enfeite — a paleta tem dono, e um roxo
 * inventado aqui apareceria depois em algum gráfico sem querer dizer nada.
 *
 * Decorativa por completo: `aria-hidden` e sem eventos de ponteiro. As
 * opacidades são baixas o bastante para não mover o contraste do texto por
 * cima: o verde do título sobre a mancha mais forte continua em 9:1.
 */
export function Aura({ className, animada = false }: { className?: string; animada?: boolean }) {
  const semMovimento = usePrefersReducedMotion()

  return (
    <span aria-hidden className={cn('pointer-events-none absolute inset-0 overflow-hidden', className)}>
      {/* A mancha principal, no canto de onde a luz vem. */}
      <span
        className="absolute -top-1/4 -right-1/5 block size-[34rem] opacity-[0.22]"
        style={{
          background: 'radial-gradient(circle at center, var(--accent) 0%, transparent 62%)',
        }}
      />
      {/*
        Uma elipse inclinada por cima dela: são duas formas, e não uma só, que
        tiram o fundo do lugar de "degradê de canto" e o põem no de forma
        abstrata.
      */}
      <span
        className="absolute -top-1/3 right-1/4 block h-[22rem] w-[40rem] -rotate-12 opacity-[0.14]"
        style={{
          background: 'radial-gradient(ellipse at center, var(--accent-soft) 0%, transparent 60%)',
        }}
      />
      {/* A terceira, fria e mais baixa, para o conjunto ter duas temperaturas. */}
      <span
        className="absolute -bottom-2/5 -left-1/6 block size-[32rem] opacity-[0.18]"
        style={{
          background: 'radial-gradient(circle at center, var(--limit-used) 0%, transparent 68%)',
        }}
      />
      {/*
        Uma faixa clara atravessando, bem fraca: é ela que dá a sensação de
        "vidro" do produto de referência, e o que impede que as duas manchas
        leiam como dois círculos.
      */}
      <span
        className="absolute inset-0 block opacity-[0.06]"
        style={{
          background:
            'linear-gradient(115deg, transparent 30%, var(--ink) 50%, transparent 70%)',
        }}
      />

      {/*
        A versão viva, por cima das manchas paradas. Só monta quando o painel
        pede e quem usa não pediu menos movimento — e mesmo assim ela é a
        camada de cima de um fundo que já está completo sem ela.
      */}
      {animada && !semMovimento ? (
        <Suspense fallback={null}>
          <AuraCanvas />
        </Suspense>
      ) : null}
    </span>
  )
}
