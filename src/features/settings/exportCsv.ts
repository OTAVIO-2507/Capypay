import { categoryLabel } from '@/domain/categories'
import { buildCsv, downloadCsv } from '@/lib/csv'
import type { Category, Goal, Transaction } from '@/domain/types'
import { todayIso } from '@/lib/date'
import { toReais } from '@/lib/money'

const KIND_LABEL: Record<Transaction['kind'], string> = {
  income: 'Receita',
  expense: 'Despesa',
  contribution: 'Aporte',
}

/**
 * Exportação dos lançamentos.
 *
 * A mecânica do formato (separador, escape, BOM) mora em `lib/csv.ts`, que é
 * compartilhada com a exportação de contas do painel de administração.
 */
export function exportTransactionsCsv(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  goals: readonly Goal[],
): void {
  if (transactions.length === 0) return

  const header = ['Data', 'Descrição', 'Tipo', 'Categoria', 'Meta', 'Valor (R$)', 'Origem']
  const rows = transactions.map((transaction) => {
    const goal = goals.find((item) => item.id === transaction.goalId)
    return [
      transaction.date,
      transaction.description,
      KIND_LABEL[transaction.kind],
      transaction.kind === 'contribution' ? '' : categoryLabel(categories, transaction.categoryId),
      goal?.name ?? '',
      toReais(transaction.amountCents).toFixed(2).replace('.', ','),
      transaction.source === 'manual' ? 'Manual' : 'Recorrente',
    ]
  })

  downloadCsv(buildCsv(header, rows), `capypay-${todayIso()}.csv`)
}
