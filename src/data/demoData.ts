import type { FinanceData, Transaction, TransactionKind } from '@/domain/types'
import { currentMonth, shiftMonth } from '@/lib/date'
import { createId } from '@/lib/id'
import { createEmptyData } from './defaults'

/**
 * Dados de demonstração.
 *
 * Existem por um motivo específico: o projeto é público, e quem abre o link
 * pela primeira vez chega a um aplicativo sem nenhum dado. Um painel financeiro
 * vazio não mostra nada do que sabe fazer.
 *
 * São inteiramente fictícios e nada aqui descreve as finanças de ninguém. São
 * gerados a partir do mês atual, para que a demonstração nunca pareça
 * abandonada, e de forma determinística, para que a tela seja a mesma para
 * qualquer visitante.
 */

interface Entry {
  day: number
  kind: TransactionKind
  description: string
  /** Em reais, convertido para centavos na montagem. */
  amount: number
  categoryId: string
  /** Índice na lista de metas, para aportes. */
  goalIndex?: number
  account?: 'corrente' | 'cartao'
}

/** Um mês típico. As variações por mês entram em `MONTHLY_VARIATION`. */
const BASE_MONTH: Entry[] = [
  { day: 5, kind: 'income', description: 'Salário', amount: 6200, categoryId: 'salario', account: 'corrente' },
  { day: 5, kind: 'expense', description: 'Aluguel', amount: 1850, categoryId: 'moradia', account: 'corrente' },
  { day: 8, kind: 'expense', description: 'Supermercado', amount: 642.9, categoryId: 'alimentacao', account: 'cartao' },
  { day: 9, kind: 'expense', description: 'Internet e telefone', amount: 149.9, categoryId: 'moradia', account: 'cartao' },
  { day: 10, kind: 'expense', description: 'Conta de luz', amount: 187.4, categoryId: 'moradia', account: 'corrente' },
  { day: 12, kind: 'expense', description: 'Combustível', amount: 260, categoryId: 'transporte', account: 'cartao' },
  { day: 14, kind: 'expense', description: 'Almoço no trabalho', amount: 218.5, categoryId: 'alimentacao', account: 'cartao' },
  { day: 15, kind: 'contribution', description: '', amount: 700, categoryId: 'meta', goalIndex: 0 },
  { day: 16, kind: 'expense', description: 'Academia', amount: 129.9, categoryId: 'saude', account: 'cartao' },
  { day: 18, kind: 'expense', description: 'Streaming', amount: 55.8, categoryId: 'assinaturas', account: 'cartao' },
  { day: 20, kind: 'expense', description: 'Farmácia', amount: 96.3, categoryId: 'saude', account: 'cartao' },
  { day: 22, kind: 'expense', description: 'Cinema e jantar', amount: 178, categoryId: 'lazer', account: 'cartao' },
  { day: 24, kind: 'expense', description: 'Supermercado', amount: 398.2, categoryId: 'alimentacao', account: 'cartao' },
  { day: 25, kind: 'contribution', description: '', amount: 400, categoryId: 'meta', goalIndex: 1 },
  { day: 27, kind: 'expense', description: 'Transporte por app', amount: 143.6, categoryId: 'transporte', account: 'cartao' },
]

/**
 * O que muda em cada mês, contando do mais antigo para o atual.
 *
 * São seis meses porque o gráfico de fluxo mostra seis: com três, metade do
 * gráfico ficava vazia e a demonstração parecia quebrada. O mês corrente é o
 * mais folgado de propósito — quem abre o link precisa ver o painel no estado
 * que o produto busca, com o alerta de orçamento ainda visível ao lado.
 */
const MONTHLY_VARIATION: { factor: number; extra: Entry[] }[] = [
  {
    // Um mês no vermelho logo no começo da série, por uma despesa anual que
    // caiu de uma vez. Sem ele a faixa do ano só teria barras para cima, e a
    // codificação de resultado negativo nunca apareceria na demonstração.
    factor: 1,
    extra: [
      { day: 12, kind: 'expense', description: 'IPVA e seguro do carro', amount: 1900, categoryId: 'transporte', account: 'corrente' },
      { day: 19, kind: 'expense', description: 'Presente de aniversário', amount: 240, categoryId: 'compras', account: 'cartao' },
    ],
  },
  {
    factor: 0.97,
    extra: [
      { day: 13, kind: 'expense', description: 'Consulta médica', amount: 320, categoryId: 'saude', account: 'cartao' },
    ],
  },
  {
    factor: 1.05,
    extra: [
      { day: 11, kind: 'income', description: 'Projeto freelance', amount: 1500, categoryId: 'freelance', account: 'corrente' },
      { day: 21, kind: 'expense', description: 'Manutenção do carro', amount: 680, categoryId: 'transporte', account: 'cartao' },
    ],
  },
  {
    factor: 0.92,
    extra: [
      { day: 6, kind: 'expense', description: 'Curso de inglês', amount: 320, categoryId: 'educacao', account: 'cartao' },
    ],
  },
  {
    factor: 1.03,
    extra: [
      { day: 9, kind: 'income', description: 'Venda de usados', amount: 620, categoryId: 'outros', account: 'corrente' },
      { day: 23, kind: 'expense', description: 'Passagem aérea', amount: 890, categoryId: 'lazer', account: 'cartao' },
    ],
  },
  {
    factor: 0.86,
    extra: [
      { day: 7, kind: 'income', description: 'Rendimento da reserva', amount: 210, categoryId: 'investimentos', account: 'corrente' },
      { day: 17, kind: 'expense', description: 'Cadeira de escritório (1/6)', amount: 265, categoryId: 'compras', account: 'cartao' },
    ],
  },
]

export function createDemoData(): FinanceData {
  const base = createEmptyData()
  const now = Date.now()
  const thisMonth = currentMonth()

  const accounts: FinanceData['accounts'] = [
    {
      id: createId('acc'),
      name: 'Conta corrente',
      kind: 'checking',
      institution: 'Banco exemplo',
      last4: null,
      creditCard: null,
      sync: null,
      archived: false,
      createdAt: now,
    },
    {
      id: createId('acc'),
      name: 'Cartão de crédito',
      kind: 'credit_card',
      institution: 'Banco exemplo',
      last4: '4821',
      creditCard: { closingDay: 28, dueDay: 8, limitCents: 800000 },
      sync: null,
      archived: false,
      createdAt: now,
    },
  ]

  const goals: FinanceData['goals'] = [
    {
      id: createId('goal'),
      name: 'Reserva de emergência',
      icon: 'shield-alert',
      targetCents: 2000000,
      deadline: null,
      archived: false,
      createdAt: now,
    },
    {
      id: createId('goal'),
      name: 'Viagem',
      icon: 'plane',
      targetCents: 800000,
      deadline: null,
      archived: false,
      createdAt: now,
    },
  ]

  const accountByKey = { corrente: accounts[0].id, cartao: accounts[1].id }
  const transactions: Transaction[] = []
  let sequence = 0

  MONTHLY_VARIATION.forEach((variation, index) => {
    const month = shiftMonth(thisMonth, index - (MONTHLY_VARIATION.length - 1))

    for (const entry of [...BASE_MONTH, ...variation.extra]) {
      // Receita e aporte ficam estáveis; só a despesa oscila mês a mês, que é
      // como um orçamento real se comporta.
      const factor = entry.kind === 'expense' ? variation.factor : 1
      const amountCents = Math.round(entry.amount * factor * 100)
      const goal = entry.goalIndex !== undefined ? goals[entry.goalIndex] : undefined

      transactions.push({
        id: createId('tx'),
        kind: entry.kind,
        description: goal ? `Aporte · ${goal.name}` : entry.description,
        amountCents,
        date: `${month}-${String(entry.day).padStart(2, '0')}`,
        categoryId: entry.categoryId,
        goalId: goal?.id ?? null,
        accountId: entry.account ? accountByKey[entry.account] : null,
        source: 'manual',
        externalId: null,
        seriesId: null,
        installment: null,
        notes: null,
        createdAt: now + sequence,
        updatedAt: now + sequence,
      })
      sequence += 1
    }
  })

  return {
    ...base,
    profile: createEmptyData().profile,
    accounts,
    goals,
    transactions,
    /*
     * Os limites são calibrados para o mês corrente exibir os três estados de
     * uma vez: alimentação estourada, moradia no limite e o resto folgado. Um
     * painel de demonstração onde tudo está verde não mostra o alerta, que é
     * justamente a razão de existir do orçamento.
     */
    budgets: {
      [thisMonth]: {
        alimentacao: 100000,
        moradia: 200000,
        transporte: 50000,
        lazer: 30000,
        saude: 25000,
        compras: 60000,
      },
      [shiftMonth(thisMonth, -1)]: {
        alimentacao: 120000,
        moradia: 230000,
        transporte: 50000,
        lazer: 30000,
      },
    },
  }
}
