import { useEffect, useRef, useState } from 'react'

/**
 * Anima um número do valor anterior até o novo.
 *
 * Existe por um motivo funcional, não decorativo: o painel troca de mês sem
 * mudar de tela, e um número que salta de um valor para outro não avisa que
 * mudou. Vendo a figura correr, dá para perceber a direção — subiu ou desceu —
 * antes mesmo de ler o número.
 *
 * Não anima na primeira montagem: contar a partir do zero ao abrir seria
 * espetáculo, não informação. E respeita `prefers-reduced-motion`, indo direto
 * ao destino para quem pediu menos movimento.
 */
export function useCountUp(target: number, duration = 450): number {
  const [valor, setValor] = useState(target)
  const anterior = useRef(target)
  const primeira = useRef(true)

  useEffect(() => {
    const partida = anterior.current
    anterior.current = target

    if (primeira.current) {
      primeira.current = false
      setValor(target)
      return
    }

    if (partida === target) return

    const semMovimento =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    if (semMovimento) {
      setValor(target)
      return
    }

    let quadro = 0
    const inicio = performance.now()

    const passo = (agora: number) => {
      const progresso = Math.min((agora - inicio) / duration, 1)
      // Ease-out exponencial: a mesma curva do resto do sistema. O número
      // desacelera ao chegar, que é como um contador físico para.
      const suave = 1 - Math.pow(1 - progresso, 4)
      setValor(Math.round(partida + (target - partida) * suave))

      if (progresso < 1) quadro = requestAnimationFrame(passo)
    }

    quadro = requestAnimationFrame(passo)
    return () => cancelAnimationFrame(quadro)
  }, [target, duration])

  return valor
}
