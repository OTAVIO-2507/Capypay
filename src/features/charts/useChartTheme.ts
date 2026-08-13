import { useEffect, useState } from 'react'

/**
 * Cores dos gráficos resolvidas a partir das variáveis CSS.
 *
 * O Recharts escreve `fill` como atributo de apresentação no SVG, e atributo de
 * apresentação não resolve `var()` de forma confiável entre navegadores. Então
 * lemos o valor computado uma vez por tema e passamos hex de verdade.
 *
 * O observer existe porque a troca de tema muda uma classe no <html>, não um
 * estado do React — sem ele os gráficos ficariam com as cores do tema anterior
 * até que outro motivo provocasse um render.
 */
export interface ChartTheme {
  /** A curva de resultado mensal — segue em tinta; não é uma das três categorias de fluxo. */
  series1: string
  /** A identidade de fluxo. Fixa, nunca escolhida — ver "As Duas Exceções de Cor" no DESIGN.md. */
  income: string
  expense: string
  contribution: string
  /** A mesma identidade, calibrada para o bloco de tinta — usada no balão do gráfico. */
  incomeOnBlock: string
  expenseOnBlock: string
  contributionOnBlock: string
  grid: string
  axis: string
  sheet: string
  ink: string
  muted: string
}

const TOKENS: Record<keyof ChartTheme, string> = {
  series1: '--series-1',
  income: '--income',
  expense: '--expense',
  contribution: '--contribution',
  incomeOnBlock: '--income-on-block',
  expenseOnBlock: '--expense-on-block',
  contributionOnBlock: '--contribution-on-block',
  grid: '--chart-grid',
  axis: '--chart-axis',
  sheet: '--sheet',
  ink: '--ink',
  muted: '--ink-secondary',
}

function readTheme(): ChartTheme {
  const styles = getComputedStyle(document.documentElement)
  const entries = Object.entries(TOKENS).map(([key, variable]) => [
    key,
    styles.getPropertyValue(variable).trim(),
  ])
  return Object.fromEntries(entries) as ChartTheme
}

export function useChartTheme(): ChartTheme {
  const [theme, setTheme] = useState<ChartTheme>(readTheme)

  useEffect(() => {
    const update = () => setTheme(readTheme())
    update()

    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => observer.disconnect()
  }, [])

  return theme
}
