import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from './categories'
import { installmentPurchases, installmentSummary } from './installments'
import type { Transaction } from './types'

function tx(
  partial: Partial<Transaction> & Pick<Transaction, 'kind' | 'amountCents' | 'date'>,
): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    description: 'x',
    categoryId: 'compras',
    goalId: null,
    accountId: null,
    source: 'manual',
    externalId: null,
    seriesId: null,
    seriesKind: null,
    installment: null,
    notes: null,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  }
}

/** Uma compra parcelada, como `expandRecurrence` produz. */
function compra(
  seriesId: string,
  description: string,
  parcelaCents: number,
  meses: string[],
  dia = '10',
): Transaction[] {
  return meses.map((mes, index) =>
    tx({
      kind: 'expense',
      amountCents: parcelaCents,
      date: `${mes}-${dia}`,
      description: `${description} (${index + 1}/${meses.length})`,
      seriesId,
      seriesKind: 'installment',
      installment: { index: index + 1, total: meses.length },
    }),
  )
}

const HOJE = '2026-08-14'

describe('installmentPurchases', () => {
  it('soma o total, o pago e o que falta', () => {
    const transactions = compra('c1', 'Sofá', 32000, ['2026-06', '2026-07', '2026-08', '2026-09'])

    const [sofa] = installmentPurchases(transactions, DEFAULT_CATEGORIES, HOJE)

    expect(sofa.label).toBe('Sofá')
    expect(sofa.totalCents).toBe(128000)
    expect(sofa.paidCents).toBe(96000)
    expect(sofa.remainingCents).toBe(32000)
    expect(sofa.paidCount).toBe(3)
    expect(sofa.totalCount).toBe(4)
    expect(sofa.next).toBe('2026-09-10')
    expect(sofa.done).toBe(false)
  })

  it('marca como terminada a compra sem parcela em aberto', () => {
    const transactions = compra('c1', 'Notebook', 50000, ['2026-04', '2026-05', '2026-06'])

    const [notebook] = installmentPurchases(transactions, DEFAULT_CATEGORIES, HOJE)

    expect(notebook.done).toBe(true)
    expect(notebook.next).toBeNull()
    expect(notebook.remainingCents).toBe(0)
    expect(notebook.progress).toBe(1)
  })

  it('não confunde assinatura com parcelamento', () => {
    const assinatura = compra('a1', 'Streaming', 5000, ['2026-08', '2026-09']).map((item) => ({
      ...item,
      seriesKind: 'subscription' as const,
    }))

    expect(installmentPurchases(assinatura, DEFAULT_CATEGORIES, HOJE)).toEqual([])
  })

  it('mede o progresso pelo valor, e não pela contagem de parcelas', () => {
    // Entrada maior que as duas seguintes: 3 de 4 parcelas pagas seriam 75%,
    // mas em dinheiro já foram 90%.
    const transactions = compra('c1', 'Viagem', 10000, ['2026-06', '2026-07', '2026-08', '2026-09'])
    transactions[0] = { ...transactions[0], amountCents: 70000 }

    const [viagem] = installmentPurchases(transactions, DEFAULT_CATEGORIES, HOJE)

    expect(viagem.progress).toBeCloseTo(0.9, 5)
  })

  it('põe as em andamento antes das terminadas', () => {
    const andando = compra('c1', 'Sofá', 32000, ['2026-07', '2026-08', '2026-09'])
    const terminada = compra('c2', 'Notebook', 50000, ['2026-04', '2026-05'])

    const ordem = installmentPurchases(
      [...terminada, ...andando],
      DEFAULT_CATEGORIES,
      HOJE,
    ).map((item) => item.label)

    expect(ordem).toEqual(['Sofá', 'Notebook'])
  })
})

describe('installmentSummary', () => {
  it('conta só o que está em andamento', () => {
    const andando = compra('c1', 'Sofá', 32000, ['2026-07', '2026-08', '2026-09'])
    const terminada = compra('c2', 'Notebook', 50000, ['2026-04', '2026-05'])

    const resumo = installmentSummary(
      installmentPurchases([...andando, ...terminada], DEFAULT_CATEGORIES, HOJE),
    )

    expect(resumo.ongoing).toBe(1)
    expect(resumo.totalCents).toBe(96000)
    expect(resumo.paidCents).toBe(64000)
    expect(resumo.remainingCents).toBe(32000)
    expect(resumo.lastMonth).toBe('2026-09-10')
  })

  it('devolve zeros e nenhuma data quando nada está em andamento', () => {
    const terminada = compra('c2', 'Notebook', 50000, ['2026-04', '2026-05'])

    const resumo = installmentSummary(
      installmentPurchases(terminada, DEFAULT_CATEGORIES, HOJE),
    )

    expect(resumo).toEqual({
      ongoing: 0,
      totalCents: 0,
      paidCents: 0,
      remainingCents: 0,
      progress: 0,
      lastMonth: null,
    })
  })
})

describe('as parcelas de uma compra', () => {
  it('lista cada uma com posição, data, valor e se já passou', () => {
    const transactions = compra('c1', 'Sofá', 32000, ['2026-07', '2026-08', '2026-09'])

    const [sofa] = installmentPurchases(transactions, DEFAULT_CATEGORIES, HOJE)

    expect(sofa.parcels).toHaveLength(3)
    expect(sofa.parcels.map((p) => [p.index, p.date, p.paid])).toEqual([
      [1, '2026-07-10', true],
      [2, '2026-08-10', true],
      [3, '2026-09-10', false],
    ])
    expect(sofa.parcels[0].amountCents).toBe(32000)
  })

  it('numera pela ordem de data, e não pelo índice gravado', () => {
    // Uma parcela apagada deixa buraco em `installment.index`; a lista na tela
    // não pode herdar esse buraco.
    const transactions = compra('c1', 'Sofá', 32000, ['2026-07', '2026-08', '2026-09']).filter(
      (item) => item.installment?.index !== 2,
    )

    const [sofa] = installmentPurchases(transactions, DEFAULT_CATEGORIES, HOJE)

    expect(sofa.parcels.map((p) => p.index)).toEqual([1, 2])
  })

  it('usa o valor de cada lançamento, e não o total dividido', () => {
    const transactions = compra('c1', 'Viagem', 10000, ['2026-07', '2026-08', '2026-09'])
    transactions[0] = { ...transactions[0], amountCents: 50000 }

    const [viagem] = installmentPurchases(transactions, DEFAULT_CATEGORIES, HOJE)

    expect(viagem.parcels.map((p) => p.amountCents)).toEqual([50000, 10000, 10000])
  })
})
