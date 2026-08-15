import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from './categories'
import { activeSubscriptions, monthlySubscriptionCost } from './subscriptions'
import type { Transaction } from './types'

function tx(
  partial: Partial<Transaction> & Pick<Transaction, 'kind' | 'amountCents' | 'date'>,
): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    description: 'x',
    categoryId: 'assinaturas',
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

/** Uma série mensal a partir de uma data, como `expandRecurrence` produz. */
function serie(
  seriesId: string,
  description: string,
  amountCents: number,
  meses: string[],
  dia = '10',
): Transaction[] {
  return meses.map((mes, index) =>
    tx({
      kind: 'expense',
      amountCents,
      date: `${mes}-${dia}`,
      description: `${description} (${index + 1}/${meses.length})`,
      seriesId,
      installment: { index: index + 1, total: meses.length },
    }),
  )
}

const HOJE = '2026-08-14'

describe('activeSubscriptions', () => {
  it('reúne as ocorrências de uma série e devolve a próxima cobrança', () => {
    const transactions = serie('s1', 'Claude Pro', 11000, ['2026-06', '2026-07', '2026-08', '2026-09'], '20')

    const [assinatura] = activeSubscriptions(transactions, DEFAULT_CATEGORIES, HOJE)

    expect(assinatura.label).toBe('Claude Pro')
    expect(assinatura.next).toBe('2026-08-20')
    expect(assinatura.amountCents).toBe(11000)
    expect(assinatura.cadence).toBe('monthly')
    expect(assinatura.remaining).toBe(2)
  })

  it('descarta a série que já terminou', () => {
    const transactions = serie('s1', 'Curso', 9900, ['2026-04', '2026-05', '2026-06'])

    expect(activeSubscriptions(transactions, DEFAULT_CATEGORIES, HOJE)).toEqual([])
  })

  it('descarta lançamento avulso e série de uma ocorrência só', () => {
    const transactions = [
      tx({ kind: 'expense', amountCents: 5000, date: '2026-09-01' }),
      tx({ kind: 'expense', amountCents: 5000, date: '2026-09-02', seriesId: 'orfa' }),
    ]

    expect(activeSubscriptions(transactions, DEFAULT_CATEGORIES, HOJE)).toEqual([])
  })

  it('ignora receita mesmo quando ela é recorrente', () => {
    const transactions = serie('s1', 'Salário', 620000, ['2026-08', '2026-09']).map((item) => ({
      ...item,
      kind: 'income' as const,
    }))

    expect(activeSubscriptions(transactions, DEFAULT_CATEGORIES, HOJE)).toEqual([])
  })

  it('usa o valor da próxima cobrança, e não o da primeira', () => {
    const transactions = serie('s1', 'Internet', 10000, ['2026-07', '2026-08', '2026-09'], '20')
    // A cobrança de agosto reajustou; a de julho já passou e não manda mais.
    transactions[1] = { ...transactions[1], amountCents: 12990 }

    const [assinatura] = activeSubscriptions(transactions, DEFAULT_CATEGORIES, HOJE)

    expect(assinatura.amountCents).toBe(12990)
  })

  it('leva semanal e anual para o custo de um mês', () => {
    const semanal = serie('sem', 'Faxina', 12000, [], '01').concat(
      ['2026-08-15', '2026-08-22', '2026-08-29'].map((date) =>
        tx({ kind: 'expense', amountCents: 12000, date, description: 'Faxina', seriesId: 'sem' }),
      ),
    )
    const anual = ['2025-09-01', '2026-09-01', '2027-09-01'].map((date) =>
      tx({ kind: 'expense', amountCents: 24000, date, description: 'Domínio', seriesId: 'ano' }),
    )

    const [faxina] = activeSubscriptions(semanal, DEFAULT_CATEGORIES, HOJE)
    const [dominio] = activeSubscriptions(anual, DEFAULT_CATEGORIES, HOJE)

    expect(faxina.cadence).toBe('weekly')
    expect(faxina.monthlyCents).toBe(52000)
    expect(dominio.cadence).toBe('yearly')
    expect(dominio.monthlyCents).toBe(2000)
  })

  it('mede a cadência pela mediana, para mês curto não virar semanal', () => {
    const transactions = ['2026-07-31', '2026-08-31', '2026-09-30', '2026-10-31'].map((date) =>
      tx({ kind: 'expense', amountCents: 3800, date, description: 'Vivo', seriesId: 's1' }),
    )

    expect(activeSubscriptions(transactions, DEFAULT_CATEGORIES, HOJE)[0].cadence).toBe('monthly')
  })

  it('ordena pela mordida mensal, não pelo valor da cobrança', () => {
    const mensal = serie('mensal', 'Streaming', 5000, ['2026-08', '2026-09'], '20')
    const anual = ['2026-08-20', '2027-08-20'].map((date) =>
      tx({ kind: 'expense', amountCents: 30000, date, description: 'Seguro', seriesId: 'anual' }),
    )

    const ordem = activeSubscriptions([...anual, ...mensal], DEFAULT_CATEGORIES, HOJE).map(
      (item) => item.label,
    )

    // O seguro cobra 6x mais de uma vez, mas ocupa metade do mês do streaming.
    expect(ordem).toEqual(['Streaming', 'Seguro'])
  })

  it('soma o custo mensal das ativas', () => {
    const a = serie('a', 'Claude Pro', 11000, ['2026-08', '2026-09'], '20')
    const b = serie('b', 'Prime Video', 1990, ['2026-08', '2026-09'], '25')

    const total = monthlySubscriptionCost(activeSubscriptions([...a, ...b], DEFAULT_CATEGORIES, HOJE))

    expect(total).toBe(12990)
  })
})
