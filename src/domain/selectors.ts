import { monthOf, monthsOfYear, shiftMonth, type IsoDate, type MonthKey } from '@/lib/date'
import { percentOf, type Cents } from '@/lib/money'
import type {
  BudgetsByMonth,
  Category,
  CategoryId,
  Goal,
  GoalId,
  Transaction,
  TransactionKind,
} from './types'

/**
 * Todo cálculo derivado vive aqui, em funções puras sobre os dados brutos.
 *
 * A versão anterior gravava valores derivados no estado — `goal.current` era
 * persistido e recalculado a cada render — o que abre espaço para o dado salvo
 * discordar do dado calculado. Aqui nada derivado é persistido: o progresso de
 * uma meta é sempre a soma dos aportes vinculados a ela, ponto.
 */

export interface PeriodTotals {
  income: Cents
  expense: Cents
  contribution: Cents
  /** Receitas menos despesas menos aportes. O que sobrou no período. */
  net: Cents
}

const EMPTY_TOTALS: PeriodTotals = { income: 0, expense: 0, contribution: 0, net: 0 }

export function totalsFor(transactions: readonly Transaction[]): PeriodTotals {
  let income = 0
  let expense = 0
  let contribution = 0

  for (const transaction of transactions) {
    if (transaction.kind === 'income') income += transaction.amountCents
    else if (transaction.kind === 'expense') expense += transaction.amountCents
    else contribution += transaction.amountCents
  }

  return { income, expense, contribution, net: income - expense - contribution }
}

export function transactionsInMonth(
  transactions: readonly Transaction[],
  month: MonthKey,
): Transaction[] {
  return transactions.filter((transaction) => monthOf(transaction.date) === month)
}

export function totalsForMonth(
  transactions: readonly Transaction[],
  month: MonthKey,
): PeriodTotals {
  return totalsFor(transactionsInMonth(transactions, month))
}

/**
 * Saldo acumulado até o fim de um mês — o que efetivamente está disponível,
 * somando todo o histórico anterior. Diferente do resultado do mês.
 */
export function cumulativeBalanceThrough(
  transactions: readonly Transaction[],
  month: MonthKey,
): Cents {
  const upToMonth = transactions.filter((transaction) => monthOf(transaction.date) <= month)
  return totalsFor(upToMonth).net
}

export interface MonthComparison {
  current: PeriodTotals
  previous: PeriodTotals
  /** Diferença absoluta do resultado contra o mês anterior. */
  netDelta: Cents
  /**
   * Variação relativa do resultado. `null` quando o mês anterior é zero — nesse
   * caso não existe percentual honesto, e exibir "+100%" seria invenção.
   */
  netRatio: number | null
}

export function compareWithPreviousMonth(
  transactions: readonly Transaction[],
  month: MonthKey,
): MonthComparison {
  const current = totalsForMonth(transactions, month)
  const previous = totalsForMonth(transactions, shiftMonth(month, -1))
  const netDelta = current.net - previous.net

  return {
    current,
    previous,
    netDelta,
    netRatio: previous.net === 0 ? null : netDelta / Math.abs(previous.net),
  }
}

export interface CategorySpend {
  categoryId: CategoryId
  label: string
  icon: string
  amount: Cents
  /** Fatia do total de despesas do período, de 0 a 1. */
  share: number
}

/** Gastos do mês agrupados por categoria, do maior para o menor. */
export function spendingByCategory(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  month: MonthKey,
): CategorySpend[] {
  const totals = new Map<CategoryId, Cents>()

  for (const transaction of transactionsInMonth(transactions, month)) {
    if (transaction.kind !== 'expense') continue
    totals.set(
      transaction.categoryId,
      (totals.get(transaction.categoryId) ?? 0) + transaction.amountCents,
    )
  }

  const grandTotal = [...totals.values()].reduce((sum, value) => sum + value, 0)

  return [...totals.entries()]
    .map(([categoryId, amount]) => {
      const category = categories.find((item) => item.id === categoryId)
      return {
        categoryId,
        label: category?.label ?? 'Sem categoria',
        icon: category?.icon ?? 'circle-dashed',
        amount,
        share: grandTotal === 0 ? 0 : amount / grandTotal,
      }
    })
    .sort((a, b) => b.amount - a.amount)
}

export interface MonthlyFlowPoint {
  month: MonthKey
  income: Cents
  expense: Cents
  contribution: Cents
  net: Cents
}

/** Série de fluxo para os N meses que terminam em `month`, inclusive. */
export function monthlyFlow(
  transactions: readonly Transaction[],
  month: MonthKey,
  length = 6,
): MonthlyFlowPoint[] {
  return Array.from({ length }, (_, index) => {
    const key = shiftMonth(month, index - (length - 1))
    const totals = totalsForMonth(transactions, key)
    return { month: key, ...totals }
  })
}

/** Resultado de cada mês de um ano, para a faixa de tendência anual. */
export function yearlyNet(
  transactions: readonly Transaction[],
  year: number,
): { month: MonthKey; net: Cents }[] {
  return monthsOfYear(year).map((month) => ({
    month,
    net: totalsForMonth(transactions, month).net,
  }))
}

export interface GoalProgress {
  goal: Goal
  savedCents: Cents
  remainingCents: Cents
  /** Percentual inteiro, saturado em 100 para largura de barra. */
  percent: number
  /** Percentual inteiro real, que pode ultrapassar 100. */
  rawPercent: number
  reached: boolean
}

/**
 * Progresso das metas, sempre derivado dos aportes — nunca lido de um campo
 * salvo. Excluir um aporte reduz o progresso automaticamente.
 */
export function goalProgress(
  goals: readonly Goal[],
  transactions: readonly Transaction[],
): GoalProgress[] {
  const saved = new Map<GoalId, Cents>()

  for (const transaction of transactions) {
    if (transaction.kind !== 'contribution' || !transaction.goalId) continue
    saved.set(transaction.goalId, (saved.get(transaction.goalId) ?? 0) + transaction.amountCents)
  }

  return goals
    .filter((goal) => !goal.archived)
    .map((goal) => {
      const savedCents = saved.get(goal.id) ?? 0
      const rawPercent = percentOf(savedCents, goal.targetCents)
      return {
        goal,
        savedCents,
        remainingCents: Math.max(goal.targetCents - savedCents, 0),
        percent: Math.min(rawPercent, 100),
        rawPercent,
        reached: savedCents >= goal.targetCents,
      }
    })
}

export type BudgetState = 'safe' | 'warning' | 'exceeded'

export interface BudgetStatus {
  categoryId: CategoryId
  label: string
  icon: string
  limitCents: Cents
  spentCents: Cents
  remainingCents: Cents
  percent: number
  /** Saturado em 100 para largura de barra. */
  barPercent: number
  state: BudgetState
}

export function budgetStatuses(
  budgets: BudgetsByMonth,
  transactions: readonly Transaction[],
  categories: readonly Category[],
  month: MonthKey,
): BudgetStatus[] {
  const limits = budgets[month] ?? {}
  const monthTransactions = transactionsInMonth(transactions, month)

  return Object.entries(limits)
    .filter(([, limit]) => limit > 0)
    .map(([categoryId, limitCents]) => {
      const spentCents = monthTransactions
        .filter((item) => item.kind === 'expense' && item.categoryId === categoryId)
        .reduce((sum, item) => sum + item.amountCents, 0)

      const percent = percentOf(spentCents, limitCents)
      const category = categories.find((item) => item.id === categoryId)

      return {
        categoryId,
        label: category?.label ?? categoryId,
        icon: category?.icon ?? 'circle-dashed',
        limitCents,
        spentCents,
        remainingCents: limitCents - spentCents,
        percent,
        barPercent: Math.min(percent, 100),
        state: percent > 100 ? 'exceeded' : percent >= 85 ? 'warning' : 'safe',
      } satisfies BudgetStatus
    })
    .sort((a, b) => b.percent - a.percent)
}

/** Meses que possuem ao menos um lançamento, do mais recente para o mais antigo. */
export function monthsWithActivity(transactions: readonly Transaction[]): MonthKey[] {
  const months = new Set<MonthKey>()
  for (const transaction of transactions) months.add(monthOf(transaction.date))
  return [...months].sort().reverse()
}

export interface TransactionFilters {
  search: string
  kind: TransactionKind | 'all'
  categoryId: CategoryId | 'all'
  accountId: string | 'all'
  /** `null` desativa o recorte mensal e mostra o histórico inteiro. */
  month: MonthKey | null
}

export const EMPTY_FILTERS: TransactionFilters = {
  search: '',
  kind: 'all',
  categoryId: 'all',
  accountId: 'all',
  month: null,
}

export function filterTransactions(
  transactions: readonly Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  const search = filters.search.trim().toLowerCase()

  return transactions.filter((transaction) => {
    if (filters.month && monthOf(transaction.date) !== filters.month) return false
    if (filters.kind !== 'all' && transaction.kind !== filters.kind) return false
    if (filters.categoryId !== 'all' && transaction.categoryId !== filters.categoryId) return false
    if (filters.accountId !== 'all' && transaction.accountId !== filters.accountId) return false
    if (search && !transaction.description.toLowerCase().includes(search)) return false
    return true
  })
}

/** Ordena por data decrescente e, no empate, pelo lançamento mais recente. */
export function sortByDateDesc(transactions: readonly Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return b.createdAt - a.createdAt
  })
}

/** Agrupa lançamentos por dia, preservando a ordem já aplicada. */
export function groupByDate(
  transactions: readonly Transaction[],
): { date: IsoDate; items: Transaction[]; net: Cents }[] {
  const groups = new Map<IsoDate, Transaction[]>()

  for (const transaction of transactions) {
    const bucket = groups.get(transaction.date)
    if (bucket) bucket.push(transaction)
    else groups.set(transaction.date, [transaction])
  }

  return [...groups.entries()].map(([date, items]) => ({
    date,
    items,
    net: totalsFor(items).net,
  }))
}

export { EMPTY_TOTALS }
