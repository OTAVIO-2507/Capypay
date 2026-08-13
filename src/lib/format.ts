import type { Cents } from './money'
import { toReais } from './money'

const BRL = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const BRL_COMPACT = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
  notation: 'compact',
  maximumFractionDigits: 1,
})

const PERCENT = new Intl.NumberFormat('pt-BR', {
  style: 'percent',
  maximumFractionDigits: 0,
})

/**
 * Máscara do modo privacidade. Usa o mesmo número de glifos sempre, para que
 * ligar o modo não reordene a tabela nem mude a largura das colunas.
 */
export const MASKED = 'R$ ••••'

export interface FormatOptions {
  /** Substitui o valor pela máscara. Ligado pelo modo privacidade. */
  masked?: boolean
  /** Prefixa `+` em valores positivos. Usado em variações e receitas. */
  signed?: boolean
}

export function formatCurrency(cents: Cents, options: FormatOptions = {}): string {
  if (options.masked) return MASKED
  const formatted = BRL.format(toReais(cents))
  if (options.signed && cents > 0) return `+${formatted}`
  return formatted
}

/** "R$ 1,5 mil" — eixos de gráfico e rótulos apertados. */
export function formatCurrencyCompact(cents: Cents, options: FormatOptions = {}): string {
  if (options.masked) return MASKED
  return BRL_COMPACT.format(toReais(cents))
}

export function formatPercent(ratio: number, options: FormatOptions = {}): string {
  if (options.masked) return '••%'
  return PERCENT.format(ratio)
}

/** Percentual já inteiro (72 → "72%"), como vem de `percentOf`. */
export function formatPercentPoints(points: number, options: FormatOptions = {}): string {
  if (options.masked) return '••%'
  return `${points}%`
}

/**
 * Rótulo textual do sinal de um valor, para leitores de tela e para a regra do
 * sinal duplo: a diferença entre entrada e saída nunca fica só na cor.
 */
export function signWord(cents: Cents): 'entrada' | 'saída' | 'neutro' {
  if (cents > 0) return 'entrada'
  if (cents < 0) return 'saída'
  return 'neutro'
}
