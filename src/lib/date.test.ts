import { describe, expect, it } from 'vitest'
import {
  formatDayMonth,
  formatDayNumber,
  formatFullDate,
  formatMonthLong,
  formatMonthShort,
  formatWeekdayShort,
  fromIsoDate,
  isValidIsoDate,
  isValidMonthKey,
  monthOf,
  monthsOfYear,
  shiftDate,
  shiftMonth,
  yearOf,
  INVALID_DATE_LABEL,
} from './date'

describe('fromIsoDate', () => {
  it('interpreta a data no fuso local, não em UTC', () => {
    // `new Date('2024-03-15')` seria meia-noite UTC e, em fuso negativo como o
    // brasileiro, exibiria o dia 14. Este é o bug que a versão original
    // contornava concatenando 'T00:00:00' em cada chamada.
    const date = fromIsoDate('2024-03-15')
    expect(date?.getDate()).toBe(15)
    expect(date?.getMonth()).toBe(2)
    expect(date?.getFullYear()).toBe(2024)
  })

  it('devolve null em vez de uma Date inválida', () => {
    expect(fromIsoDate('')).toBeNull()
    expect(fromIsoDate('não é data')).toBeNull()
    expect(fromIsoDate('NaN-NaN-NaN')).toBeNull()
    expect(fromIsoDate('2024-3-5')).toBeNull()
  })
})

describe('isValidIsoDate', () => {
  it('aceita apenas o formato AAAA-MM-DD completo', () => {
    expect(isValidIsoDate('2024-03-15')).toBe(true)
    expect(isValidIsoDate('2024-3-15')).toBe(false)
    expect(isValidIsoDate('')).toBe(false)
    expect(isValidIsoDate(undefined)).toBe(false)
    expect(isValidIsoDate(null)).toBe(false)
    expect(isValidIsoDate(20240315)).toBe(false)
  })

  it('rejeita data que não existe no calendário', () => {
    // O construtor de Date transborda em silêncio: 31 de fevereiro vira 2 de
    // março. Só a ida e volta pela string prova que a data é real.
    expect(isValidIsoDate('2024-02-31')).toBe(false)
    expect(isValidIsoDate('2023-02-29')).toBe(false)
    expect(isValidIsoDate('2024-02-29')).toBe(true)
    expect(isValidIsoDate('2024-13-01')).toBe(false)
  })
})

describe('isValidMonthKey', () => {
  it('aceita apenas AAAA-MM com mês real', () => {
    expect(isValidMonthKey('2024-03')).toBe(true)
    expect(isValidMonthKey('2024-13')).toBe(false)
    expect(isValidMonthKey('2024-00')).toBe(false)
    expect(isValidMonthKey('NaN-01')).toBe(false)
    expect(isValidMonthKey('')).toBe(false)
  })
})

/**
 * O grupo que existe por causa de um incidente: um lançamento com data
 * corrompida chegava ao `Intl.DateTimeFormat`, que responde a uma `Date`
 * inválida com `RangeError: Invalid time value`. Como a formatação acontece
 * durante a renderização, o erro subia até a raiz e derrubava a aplicação
 * inteira — a pessoa não conseguia nem abrir o painel.
 */
describe('formatadores nunca lançam', () => {
  const lixo = ['', 'não é data', 'NaN-NaN-NaN', '2024-13-45', '2024-02-31', 'undefined']

  it.each(lixo)('formatDayMonth(%j) devolve rótulo em vez de lançar', (entrada) => {
    expect(() => formatDayMonth(entrada)).not.toThrow()
    expect(formatDayMonth(entrada)).toBe(INVALID_DATE_LABEL)
  })

  it.each(lixo)('formatFullDate(%j) devolve rótulo em vez de lançar', (entrada) => {
    expect(() => formatFullDate(entrada)).not.toThrow()
    expect(formatFullDate(entrada)).toBe(INVALID_DATE_LABEL)
  })

  it.each(['', 'NaN-01', '2024-13', 'qualquer coisa'])(
    'formatMonthLong(%j) devolve rótulo em vez de lançar',
    (entrada) => {
      expect(() => formatMonthLong(entrada)).not.toThrow()
      expect(formatMonthLong(entrada)).toBe(INVALID_DATE_LABEL)
    },
  )

  it.each(['', 'NaN-01', '2024-13'])('formatMonthShort(%j) não lança', (entrada) => {
    expect(() => formatMonthShort(entrada)).not.toThrow()
    expect(formatMonthShort(entrada)).toBe('—')
  })

  it.each(lixo)('formatWeekdayShort(%j) devolve traço em vez de lançar', (entrada) => {
    expect(() => formatWeekdayShort(entrada)).not.toThrow()
    expect(formatWeekdayShort(entrada)).toBe('—')
  })

  it.each(lixo)('formatDayNumber(%j) devolve traços em vez de lançar', (entrada) => {
    expect(() => formatDayNumber(entrada)).not.toThrow()
    expect(formatDayNumber(entrada)).toBe('--')
  })

  it('formata normalmente quando a entrada é válida', () => {
    expect(formatMonthLong('2024-03')).toBe('Março de 2024')
    expect(formatMonthShort('2024-03')).toBe('Mar')
    expect(formatDayMonth('2024-03-15')).toBe('15 de mar')
    // 15/03/2024 foi uma sexta-feira. O ponto da abreviação sai fora, e o zero
    // à esquerda entra: a folha de calendário tem largura fixa.
    expect(formatWeekdayShort('2024-03-15')).toBe('sex')
    expect(formatDayNumber('2024-03-15')).toBe('15')
    expect(formatDayNumber('2024-03-05')).toBe('05')
  })
})

describe('shiftMonth', () => {
  it('atravessa a virada de ano nos dois sentidos', () => {
    expect(shiftMonth('2024-12', 1)).toBe('2025-01')
    expect(shiftMonth('2024-01', -1)).toBe('2023-12')
  })

  it('cai no mês atual em vez de propagar entrada inválida', () => {
    expect(shiftMonth('NaN-01', 1)).toMatch(/^\d{4}-\d{2}$/)
    expect(shiftMonth('', 1)).toMatch(/^\d{4}-\d{2}$/)
  })
})

describe('shiftDate', () => {
  it('não transborda para o mês seguinte quando o dia não existe no destino', () => {
    // `setMonth` sozinho levaria 31 de janeiro para 2 ou 3 de março.
    expect(shiftDate('2024-01-31', 1, 'month')).toBe('2024-02-29')
    expect(shiftDate('2023-01-31', 1, 'month')).toBe('2023-02-28')
  })

  it('preserva o dia quando ele existe no mês de destino', () => {
    expect(shiftDate('2024-01-15', 3, 'month')).toBe('2024-04-15')
  })

  it('desloca em semanas e em anos', () => {
    expect(shiftDate('2024-03-01', 2, 'week')).toBe('2024-03-15')
    expect(shiftDate('2024-03-01', 1, 'year')).toBe('2025-03-01')
  })

  it('trata 29 de fevereiro ao avançar um ano não bissexto', () => {
    expect(shiftDate('2024-02-29', 1, 'year')).toBe('2025-02-28')
  })

  it('devolve a entrada intacta quando ela é inválida, sem gerar "NaN-NaN-NaN"', () => {
    // Gerar uma data-lixo aqui espalharia a corrupção para todas as parcelas
    // de uma recorrência, e não só para o lançamento de origem.
    expect(shiftDate('', 1, 'month')).toBe('')
    expect(shiftDate('não é data', 3, 'month')).toBe('não é data')
  })
})

describe('monthOf e yearOf', () => {
  it('extraem o recorte sem quebrar com entrada ruim', () => {
    expect(monthOf('2024-03-15')).toBe('2024-03')
    expect(monthOf('')).toBe('')
    expect(yearOf('2024-03')).toBe(2024)
    expect(yearOf('')).toBe(new Date().getFullYear())
    expect(yearOf('NaN-03')).toBe(new Date().getFullYear())
  })
})

describe('monthsOfYear', () => {
  it('gera doze chaves válidas', () => {
    const meses = monthsOfYear(2024)
    expect(meses).toHaveLength(12)
    expect(meses[0]).toBe('2024-01')
    expect(meses[11]).toBe('2024-12')
  })

  it('cai no ano atual quando o ano não é um número', () => {
    // Sem isto, um ano NaN gerava "NaN-01" e cada rótulo do eixo lançava.
    expect(monthsOfYear(Number.NaN).every(isValidMonthKey)).toBe(true)
  })
})
