import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from './categories'
import {
  budgetStatuses,
  compareWithPreviousMonth,
  cumulativeBalanceThrough,
  goalProgress,
  spendingByCategory,
  totalsFor,
  spendingPace,
} from './selectors'
import type { Goal, Transaction } from './types'

function tx(partial: Partial<Transaction> & Pick<Transaction, 'kind' | 'amountCents' | 'date'>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    description: 'x',
    categoryId: 'outros',
    goalId: null,
    accountId: null,
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

const GOALS: Goal[] = [
  { id: 'g1', name: 'Reserva', icon: 'target', targetCents: 100000, deadline: null, archived: false, createdAt: 0 },
  { id: 'g2', name: 'Arquivada', icon: 'target', targetCents: 50000, deadline: null, archived: true, createdAt: 0 },
]

describe('totalsFor', () => {
  it('trata aporte como saída do saldo, sem contá-lo como despesa', () => {
    const totals = totalsFor([
      tx({ kind: 'income', amountCents: 500000, date: '2024-03-05' }),
      tx({ kind: 'expense', amountCents: 200000, date: '2024-03-10' }),
      tx({ kind: 'contribution', amountCents: 100000, date: '2024-03-15', goalId: 'g1' }),
    ])

    expect(totals.income).toBe(500000)
    expect(totals.expense).toBe(200000)
    expect(totals.contribution).toBe(100000)
    expect(totals.net).toBe(200000)
  })
})

describe('cumulativeBalanceThrough', () => {
  it('acumula os meses anteriores e ignora os posteriores', () => {
    const transactions = [
      tx({ kind: 'income', amountCents: 100000, date: '2024-01-10' }),
      tx({ kind: 'income', amountCents: 100000, date: '2024-02-10' }),
      tx({ kind: 'income', amountCents: 999999, date: '2024-04-10' }),
    ]

    expect(cumulativeBalanceThrough(transactions, '2024-02')).toBe(200000)
  })
})

describe('compareWithPreviousMonth', () => {
  it('não inventa percentual quando o mês anterior é zero', () => {
    const comparison = compareWithPreviousMonth(
      [tx({ kind: 'income', amountCents: 100000, date: '2024-03-10' })],
      '2024-03',
    )

    expect(comparison.netDelta).toBe(100000)
    expect(comparison.netRatio).toBeNull()
  })
})

describe('goalProgress', () => {
  const transactions = [
    tx({ kind: 'contribution', amountCents: 30000, date: '2024-03-10', goalId: 'g1' }),
    tx({ kind: 'contribution', amountCents: 20000, date: '2024-04-10', goalId: 'g1' }),
    // Despesa comum não pode alimentar meta nenhuma.
    tx({ kind: 'expense', amountCents: 90000, date: '2024-04-11' }),
  ]

  it('deriva o progresso da soma dos aportes', () => {
    const [reserva] = goalProgress(GOALS, transactions)
    expect(reserva.savedCents).toBe(50000)
    expect(reserva.percent).toBe(50)
    expect(reserva.remainingCents).toBe(50000)
    expect(reserva.reached).toBe(false)
  })

  it('omite metas arquivadas', () => {
    expect(goalProgress(GOALS, transactions)).toHaveLength(1)
  })

  it('satura a barra em 100% mas preserva o percentual real', () => {
    const excedente = [tx({ kind: 'contribution', amountCents: 150000, date: '2024-03-10', goalId: 'g1' })]
    const [reserva] = goalProgress(GOALS, excedente)
    expect(reserva.percent).toBe(100)
    expect(reserva.rawPercent).toBe(150)
    expect(reserva.reached).toBe(true)
  })
})

describe('spendingByCategory', () => {
  it('agrupa despesas do mês e ordena da maior para a menor', () => {
    const transactions = [
      tx({ kind: 'expense', amountCents: 10000, date: '2024-03-01', categoryId: 'lazer' }),
      tx({ kind: 'expense', amountCents: 40000, date: '2024-03-02', categoryId: 'alimentacao' }),
      tx({ kind: 'expense', amountCents: 10000, date: '2024-03-03', categoryId: 'alimentacao' }),
      // Nem receita nem aporte entram na composição de gastos.
      tx({ kind: 'income', amountCents: 900000, date: '2024-03-04', categoryId: 'salario' }),
      tx({ kind: 'contribution', amountCents: 50000, date: '2024-03-05', goalId: 'g1', categoryId: 'meta' }),
      // Outro mês não entra.
      tx({ kind: 'expense', amountCents: 99999, date: '2024-04-01', categoryId: 'moradia' }),
    ]

    const result = spendingByCategory(transactions, DEFAULT_CATEGORIES, '2024-03')

    expect(result.map((r) => r.categoryId)).toEqual(['alimentacao', 'lazer'])
    expect(result[0].amount).toBe(50000)
    expect(result[0].share).toBeCloseTo(50000 / 60000)
  })
})

describe('budgetStatuses', () => {
  const budgets = { '2024-03': { alimentacao: 100000, transporte: 100000, lazer: 0 } }
  const transactions = [
    tx({ kind: 'expense', amountCents: 130000, date: '2024-03-05', categoryId: 'alimentacao' }),
    tx({ kind: 'expense', amountCents: 90000, date: '2024-03-06', categoryId: 'transporte' }),
  ]

  const result = budgetStatuses(budgets, transactions, DEFAULT_CATEGORIES, '2024-03')

  it('ignora limite zerado', () => {
    expect(result.map((r) => r.categoryId)).toEqual(['alimentacao', 'transporte'])
  })

  it('marca o estouro e informa o quanto passou', () => {
    const alimentacao = result[0]
    expect(alimentacao.state).toBe('exceeded')
    expect(alimentacao.percent).toBe(130)
    expect(alimentacao.remainingCents).toBe(-30000)
  })

  it('marca como atenção a partir de 85% do limite', () => {
    expect(result[1].state).toBe('warning')
  })

  it('ordena do mais crítico para o mais folgado', () => {
    expect(result[0].percent).toBeGreaterThan(result[1].percent)
  })
})

/**
 * O ritmo de gastos. Responde uma pergunta que o total do mês não responde:
 * estou gastando mais rápido que da última vez? O total fechado só chega no
 * fim, quando não há mais o que decidir.
 */
describe('spendingPace', () => {
  const gasto = (date: string, amountCents: number) =>
    tx({ kind: 'expense', amountCents, date })

  it('acumula dia a dia e para no dia de hoje', () => {
    const pace = spendingPace(
      [gasto('2026-08-02', 1000), gasto('2026-08-05', 2000), gasto('2026-08-09', 500)],
      '2026-08',
      '2026-08-06',
    )

    expect(pace.points[1].current).toBe(1000)
    expect(pace.points[4].current).toBe(3000)
    // O dia 9 ainda não aconteceu: a linha para, e não segue reta fingindo
    // que houve gasto zero num dia que não chegou.
    expect(pace.points[8].current).toBeNull()
    expect(pace.currentCents).toBe(3000)
  })

  /*
   * A comparação é dia contra dia, e não contra o mês fechado. No dia 10,
   * comparar dez dias contra trinta diria que se está gastando muito menos todo
   * início de mês, e a conclusão viraria elogio automático em vez de informação.
   */
  it('compara com o mesmo dia do mês anterior, não com o mês inteiro', () => {
    const pace = spendingPace(
      [
        gasto('2026-07-03', 5000),
        gasto('2026-07-20', 90000),
        gasto('2026-08-03', 4000),
      ],
      '2026-08',
      '2026-08-05',
    )

    expect(pace.previousCents).toBe(5000)
    expect(pace.currentCents).toBe(4000)
    expect(pace.deltaCents).toBe(-1000)
  })

  it('mostra o mês anterior inteiro, porque ele já aconteceu', () => {
    const pace = spendingPace([gasto('2026-07-28', 3000)], '2026-08', '2026-08-05')

    expect(pace.points[27].previous).toBe(3000)
    expect(pace.points[30].previous).toBe(3000)
  })

  it('ignora receita, que não é ritmo de gasto', () => {
    const pace = spendingPace(
      [gasto('2026-08-02', 1000), tx({ kind: 'income', amountCents: 500000, date: '2026-08-03' })],
      '2026-08',
      '2026-08-05',
    )

    expect(pace.currentCents).toBe(1000)
  })

  it('percorre o mês inteiro quando ele já passou', () => {
    const pace = spendingPace([gasto('2026-07-31', 1000)], '2026-07', '2026-08-05')

    expect(pace.dayCursor).toBe(31)
    expect(pace.points[30].current).toBe(1000)
  })

  it('devolve razão nula quando não há mês anterior com o que comparar', () => {
    const pace = spendingPace([gasto('2026-08-02', 1000)], '2026-08', '2026-08-05')

    expect(pace.ratio).toBeNull()
  })
})
