import { useEffect, useState } from 'react'

const CONSULTA = '(prefers-reduced-motion: reduce)'

/**
 * Se a pessoa pediu ao sistema operacional para reduzir movimento.
 *
 * A regra de `prefers-reduced-motion` em `styles.css` só alcança animação
 * **CSS** — ela encurta `animation-duration` e `transition-duration` para
 * quase zero. Tudo que anima por JavaScript, quadro a quadro, passa por baixo
 * dela sem ser notado, e é o caso dos gráficos do Recharts: as barras crescem e
 * as áreas se desenham por `requestAnimationFrame`, não por CSS. Este hook é o
 * que esses componentes consultam para desligar a própria animação.
 *
 * É uma preferência viva: quem liga a opção com a tela aberta vê o efeito na
 * próxima renderização, sem recarregar.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduzir, setReduzir] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(CONSULTA).matches,
  )

  useEffect(() => {
    const media = window.matchMedia(CONSULTA)
    const aoMudar = () => setReduzir(media.matches)
    media.addEventListener('change', aoMudar)
    return () => media.removeEventListener('change', aoMudar)
  }, [])

  return reduzir
}
