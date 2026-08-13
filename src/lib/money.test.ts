import { describe, expect, it } from 'vitest'
import { parseDecimalInput, percentOf, sumCents, toCents, toInputValue } from './money'

describe('parseDecimalInput', () => {
  it('aceita vírgula decimal, que é o que o teclado brasileiro produz', () => {
    expect(parseDecimalInput('1234,56')).toBe(1234.56)
  })

  it('aceita ponto decimal, que é o que o teclado numérico do celular produz', () => {
    expect(parseDecimalInput('1234.56')).toBe(1234.56)
  })

  it('descarta o separador de milhar quando há vírgula decimal', () => {
    expect(parseDecimalInput('1.234,56')).toBe(1234.56)
  })

  it('devolve NaN para entrada vazia, para a validação poder reclamar', () => {
    expect(Number.isNaN(parseDecimalInput('   '))).toBe(true)
  })
})

describe('toCents', () => {
  it('converte reais em centavos inteiros', () => {
    expect(toCents(1234.56)).toBe(123456)
  })

  it('arredonda a imprecisão do ponto flutuante em vez de truncar', () => {
    // 19.99 * 100 dá 1998.9999999999998 em ponto flutuante.
    expect(toCents(19.99)).toBe(1999)
  })
})

describe('sumCents', () => {
  it('soma sem o erro que o ponto flutuante introduziria', () => {
    // Em reais, 0.1 + 0.2 daria 0.30000000000000004.
    expect(sumCents([10, 20])).toBe(30)
  })
})

describe('percentOf', () => {
  it('não satura: estourar o orçamento precisa aparecer como mais de 100%', () => {
    expect(percentOf(13000, 10000)).toBe(130)
  })

  it('devolve zero quando o total é zero, em vez de Infinity', () => {
    expect(percentOf(500, 0)).toBe(0)
  })
})

describe('toInputValue', () => {
  it('sempre traz duas casas, para o campo não parecer um valor pela metade', () => {
    expect(toInputValue(100000)).toBe('1000,00')
    expect(toInputValue(50)).toBe('0,50')
  })
})
