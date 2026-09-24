import { describe, expect, it } from 'vitest'
import { buildAlerts } from './alerts'
import type { Goal, Transaction } from './types'
import { shiftDate, todayIso } from '@/lib/date'

const MES = todayIso().slice(0, 7)

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

const META: Goal = {
  id: 'g1',
  name: 'Reserva',
  icon: 'target',
  targetCents: 100000,
  deadline: null,
  archived: false,
  createdAt: 0,
}

function construir(over: Partial<Parameters<typeof buildAlerts>[0]> = {}) {
  return buildAlerts({
    transactions: [],
    goals: [],
    month: MES,
    formatValue: (cents) => `R$ ${(cents / 100).toFixed(2)}`,
    ...over,
  })
}

/**
 * Os avisos são leitura dos dados, nunca invenção. Estes testes existem para
 * garantir que a lista fique vazia quando não há nada de fato pendente — um
 * sino que sempre tem algo aceso é um sino que ninguém mais lê.
 */
describe('buildAlerts', () => {
  it('não inventa aviso quando não há nada pendente', () => {
    expect(construir()).toEqual([])
  })

  it('avisa quando o mês fecha negativo', () => {
    const alerts = construir({
      transactions: [
        tx({ kind: 'income', amountCents: 10000, date: `${MES}-01` }),
        tx({ kind: 'expense', amountCents: 40000, date: `${MES}-02` }),
      ],
    })

    expect(alerts.some((a) => a.id.startsWith('negative-'))).toBe(true)
  })

  it('não avisa de mês negativo quando o resultado é positivo', () => {
    const alerts = construir({
      transactions: [tx({ kind: 'income', amountCents: 50000, date: `${MES}-01` })],
    })

    expect(alerts.some((a) => a.id.startsWith('negative-'))).toBe(false)
  })

  it('celebra meta concluída, mas com a menor prioridade', () => {
    const alerts = construir({
      goals: [META],
      transactions: [tx({ kind: 'contribution', amountCents: 120000, date: `${MES}-10`, goalId: 'g1' })],
    })

    expect(alerts.find((a) => a.id === 'goal-reached-g1')?.severity).toBe('low')
  })

  it('conta parcelas que ainda vencem no mês, e ignora as que já passaram', () => {
    const futura = shiftDate(todayIso(), 3, 'day')
    const passada = shiftDate(todayIso(), -3, 'day')

    const alerts = construir({
      transactions: [
        tx({ kind: 'expense', amountCents: 20000, date: futura, installment: { index: 2, total: 6 } }),
        tx({ kind: 'expense', amountCents: 90000, date: passada, installment: { index: 1, total: 6 } }),
      ],
    })

    const aVencer = alerts.find((a) => a.id.startsWith('upcoming-'))
    // Só a parcela futura entra: a que já venceu não é pendência, é histórico.
    expect(aVencer?.title).toContain('1 parcela')
    expect(aVencer?.description).toContain('R$ 200.00')
  })

  it('ordena do mais grave para o menos grave', () => {
    const alerts = construir({
      goals: [META],
      transactions: [
        tx({ kind: 'contribution', amountCents: 120000, date: `${MES}-10`, goalId: 'g1' }),
        tx({ kind: 'expense', amountCents: 90000, date: `${MES}-05`, categoryId: 'lazer' }),
        tx({ kind: 'expense', amountCents: 130000, date: `${MES}-06`, categoryId: 'alimentacao' }),
      ],
    })

    // Comparar pelo peso, e não em ordem alfabética: 'low' vem antes de
    // 'medium' no alfabeto e depois dele na gravidade.
    const peso = { high: 0, medium: 1, low: 2 }
    const pesos = alerts.map((a) => peso[a.severity])

    expect(pesos).toEqual([...pesos].sort((a, b) => a - b))
    expect(alerts[0].severity).toBe('high')
    expect(alerts.at(-1)?.severity).toBe('low')
  })
})
