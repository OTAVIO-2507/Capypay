import { describe, expect, it } from 'vitest'
import {
  cardSummary,
  currentInvoiceMonth,
  invoiceHistory,
  invoiceTotal,
  invoiceWindow,
} from './invoices'
import type { Account, Transaction } from './types'

function tx(partial: Partial<Transaction> & Pick<Transaction, 'amountCents' | 'date'>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    kind: 'expense',
    description: 'x',
    categoryId: 'outros',
    goalId: null,
    accountId: 'card',
    source: 'manual',
    externalId: null,
    seriesId: null,
    installment: null,
    notes: null,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  }
}

const CARTAO: Account = {
  id: 'card',
  name: 'Cartão',
  kind: 'credit_card',
  creditCard: { closingDay: 28, dueDay: 8, limitCents: 500000 },
  archived: false,
  createdAt: 0,
}

describe('invoiceWindow', () => {
  it('fecha no mês anterior quando o vencimento vem antes do fechamento', () => {
    // Fecha dia 28, vence dia 8: a fatura de outubro fecha em 28 de setembro.
    expect(invoiceWindow({ closingDay: 28, dueDay: 8 }, '2026-10')).toEqual({
      month: '2026-10',
      start: '2026-08-29',
      end: '2026-09-28',
      due: '2026-10-08',
    })
  })

  it('fecha no mesmo mês quando o vencimento vem depois', () => {
    expect(invoiceWindow({ closingDay: 3, dueDay: 10 }, '2026-10')).toEqual({
      month: '2026-10',
      start: '2026-09-04',
      end: '2026-10-03',
      due: '2026-10-10',
    })
  })

  it('usa o último dia quando o mês é mais curto que o fechamento', () => {
    // Fecha dia 31, vence dia 10: a fatura de março fecha em fevereiro, que não
    // tem dia 31 — fecha no 28, e começa no dia seguinte ao 31 de janeiro.
    const janela = invoiceWindow({ closingDay: 31, dueDay: 10 }, '2026-03')
    expect(janela.start).toBe('2026-02-01')
    expect(janela.end).toBe('2026-02-28')
  })

  it('sem fechamento conhecido, a fatura é o mês do calendário', () => {
    expect(invoiceWindow({ closingDay: null, dueDay: null }, '2026-09')).toEqual({
      month: '2026-09',
      start: '2026-09-01',
      end: '2026-09-30',
      due: null,
    })
    expect(invoiceWindow(null, '2026-02').end).toBe('2026-02-28')
  })
})

describe('currentInvoiceMonth', () => {
  const termos = { closingDay: 28, dueDay: 8 }

  it('antes do fechamento, a compra entra na fatura que vence no mês seguinte', () => {
    expect(currentInvoiceMonth(termos, '2026-09-19')).toBe('2026-10')
  })

  it('no dia do fechamento ainda entra; no dia seguinte, já é a próxima', () => {
    expect(currentInvoiceMonth(termos, '2026-09-28')).toBe('2026-10')
    expect(currentInvoiceMonth(termos, '2026-09-29')).toBe('2026-11')
  })

  it('sem fechamento, é o mês de hoje', () => {
    expect(currentInvoiceMonth(null, '2026-09-19')).toBe('2026-09')
  })
})

describe('invoiceTotal', () => {
  it('soma só as despesas do cartão dentro da janela', () => {
    const janela = invoiceWindow(CARTAO.creditCard, '2026-10')
    const lista = [
      tx({ amountCents: 1000, date: '2026-08-29' }),
      tx({ amountCents: 2000, date: '2026-09-28' }),
      tx({ amountCents: 9999, date: '2026-09-29' }), // próxima fatura
      tx({ amountCents: 5555, date: '2026-09-10', accountId: 'outra' }),
      tx({ amountCents: 7777, date: '2026-09-10', kind: 'income' }),
    ]
    expect(invoiceTotal(lista, 'card', janela)).toBe(3000)
  })
})

describe('cardSummary', () => {
  const lista = [
    tx({ amountCents: 10000, date: '2026-09-05' }),
    // parcela futura, já lançada: ocupa limite hoje
    tx({ amountCents: 20000, date: '2026-10-05', seriesKind: 'installment' }),
    // assinatura futura, já lançada: só ocupa quando for cobrada
    tx({ amountCents: 4000, date: '2026-11-05', seriesKind: 'subscription' }),
  ]

  it('estima a fatura aberta e o usado pelos lançamentos quando o banco não informa', () => {
    const resumo = cardSummary(CARTAO, lista, '2026-09-19')
    expect(resumo.window.month).toBe('2026-10')
    expect(resumo.invoiceCents).toBe(10000)
    expect(resumo.usedCents).toBe(30000)
    expect(resumo.usedFromBank).toBe(false)
    expect(resumo.lastTransactionDate).toBe('2026-09-05')
  })

  it('usa o disponível do banco quando ele existe', () => {
    const doBanco: Account = {
      ...CARTAO,
      creditCard: { ...CARTAO.creditCard!, availableCents: 420000 },
    }
    const resumo = cardSummary(doBanco, lista, '2026-09-19')
    expect(resumo.usedCents).toBe(80000)
    expect(resumo.usedFromBank).toBe(true)
  })

  it('sem limite, não há usado', () => {
    const semLimite: Account = { ...CARTAO, creditCard: { closingDay: 28, dueDay: 8, limitCents: null } }
    expect(cardSummary(semLimite, lista, '2026-09-19').usedCents).toBeNull()
  })
})

describe('invoiceHistory', () => {
  it('soma por mês de vencimento, terminando no mês pedido', () => {
    const lista = [
      tx({ amountCents: 1000, date: '2026-08-10' }), // fatura de setembro
      tx({ amountCents: 2000, date: '2026-09-10' }), // fatura de outubro
    ]
    const historico = invoiceHistory([CARTAO], lista, '2026-10', 3)
    expect(historico).toEqual([
      { month: '2026-08', cents: 0 },
      { month: '2026-09', cents: 1000 },
      { month: '2026-10', cents: 2000 },
    ])
  })
})
