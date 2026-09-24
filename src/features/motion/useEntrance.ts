import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { usePrefersReducedMotion } from '@/lib/usePrefersReducedMotion'
import { SAIDA } from './easing'

/**
 * A entrada dos painéis de uma tela: eles sobem oito pixels e aparecem, um
 * pouco depois do outro.
 *
 * É entrada de **montagem**, e não de rolagem. Revelar painel conforme a
 * pessoa rola é recurso de página de marketing: numa tela que se abre todo dia
 * ele vira a interface brigando com quem lê, e o dado que ela veio conferir
 * chega atrasado de propósito. Aqui a animação acontece uma vez, quando a tela
 * troca, e some do caminho.
 *
 * Fica curta e rasa — 220ms, oito pixels, 35ms entre um painel e o seguinte.
 * O suficiente para a tela não trocar de conteúdo num estalo; pouco o
 * bastante para não custar tempo a quem já sabe o que veio ver.
 *
 * Com `prefers-reduced-motion`, não faz nada: os painéis já nascem visíveis no
 * CSS, e é o GSAP que os esconde por um instante. Se o script falhar, a tela
 * continua inteira — nada aqui depende de JavaScript para aparecer.
 */
export function useEntrance<T extends HTMLElement>(chave?: unknown) {
  const ref = useRef<T>(null)
  const semMovimento = usePrefersReducedMotion()

  useEffect(() => {
    if (semMovimento) return
    const alvo = ref.current
    if (!alvo) return

    const filhos = Array.from(alvo.children) as HTMLElement[]
    if (filhos.length === 0) return

    const contexto = gsap.context(() => {
      gsap.fromTo(
        filhos,
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: 0.22,
          ease: SAIDA,
          stagger: 0.035,
          // Devolve o controle ao CSS no fim: sem isto, o GSAP deixa um
          // `transform` inline em cada painel, e qualquer `sticky` ou menu
          // suspenso passa a se posicionar por ele.
          clearProps: 'opacity,transform',
        },
      )
    }, alvo)

    return () => contexto.revert()
  }, [semMovimento, chave])

  return ref
}
