/**
 * Dinheiro é representado em centavos inteiros no aplicativo inteiro.
 *
 * A versão anterior guardava reais como `number` de ponto flutuante, o que faz
 * `0.1 + 0.2 === 0.30000000000000004` aparecer em soma de extrato. Somar
 * inteiros elimina a classe inteira desse erro; a conversão para reais acontece
 * só na borda (exibição e entrada do usuário).
 */

/** Valor monetário em centavos. Sempre inteiro, pode ser negativo. */
export type Cents = number

/** Converte reais (como o usuário digita) para centavos inteiros. */
export function toCents(reais: number | string): Cents {
  const value = typeof reais === 'string' ? parseDecimalInput(reais) : reais
  if (!Number.isFinite(value)) return 0
  return Math.round(value * 100)
}

/** Converte centavos para reais, para preencher campos numéricos. */
export function toReais(cents: Cents): number {
  return cents / 100
}

/**
 * Valor pronto para preencher um campo de edição: sempre com duas casas e
 * vírgula decimal, sem separador de milhar. `String(1000/100)` devolveria
 * "1000", que num campo de dinheiro parece um valor pela metade.
 */
export function toInputValue(cents: Cents): string {
  return toReais(cents).toFixed(2).replace('.', ',')
}

/**
 * Lê o que o usuário digitou aceitando tanto `1234.56` quanto `1.234,56`.
 * O teclado numérico do celular produz ponto, o teclado brasileiro produz
 * vírgula, e os dois precisam significar a mesma coisa.
 */
export function parseDecimalInput(raw: string): number {
  const trimmed = raw.trim()
  if (!trimmed) return Number.NaN

  const hasComma = trimmed.includes(',')
  const normalized = hasComma
    ? trimmed.replace(/\./g, '').replace(',', '.')
    : trimmed

  return Number.parseFloat(normalized.replace(/[^\d.-]/g, ''))
}

export function sumCents(values: readonly Cents[]): Cents {
  let total = 0
  for (const value of values) total += value
  return total
}

/**
 * Percentual inteiro de `part` sobre `total`, protegido contra divisão por zero.
 * Não satura em 100 — estourar o orçamento precisa ser visível como 130%.
 */
export function percentOf(part: Cents, total: Cents): number {
  if (total === 0) return 0
  return Math.round((part / total) * 100)
}
