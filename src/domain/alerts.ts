import type { IconName } from '@/components/Icon'
import { formatMonthLong, monthOf, todayIso, type MonthKey } from '@/lib/date'
import type { Cents } from '@/lib/money'
import { budgetStatuses, goalProgress, totalsForMonth } from './selectors'
import type { BudgetsByMonth, Category, Goal, Transaction } from './types'

/**
 * Avisos derivados dos dados.
 *
 * Nada aqui é inventado nem agendado: cada aviso é uma leitura do que já está
 * salvo. Um painel financeiro que mostra notificação fabricada ensina o usuário
 * a ignorar o sino — e aí o aviso que importava passa despercebido junto.
 *
 * Por isso também não existe estado de "lido": o aviso desaparece quando a
 * condição que o gerou deixa de valer, e não quando alguém o dispensa. Um
 * limite estourado continua estourado depois de fechar o menu.
 */
export type AlertSeverity = 'high' | 'medium' | 'low'

export interface Alert {
  id: string
  severity: AlertSeverity
  icon: IconName
  title: string
  description: string
  /** Rota para onde o aviso leva. */
  to: string
}

interface AlertInput {
  transactions: readonly Transaction[]
  categories: readonly Category[]
  goals: readonly Goal[]
  budgets: BudgetsByMonth
  month: MonthKey
  formatValue: (cents: Cents) => string
}

const ORDEM: Record<AlertSeverity, number> = { high: 0, medium: 1, low: 2 }

export function buildAlerts({
  transactions,
  categories,
  goals,
  budgets,
  month,
  formatValue,
}: AlertInput): Alert[] {
  const alerts: Alert[] = []
  const orcamentos = budgetStatuses(budgets, transactions, categories, month)

  for (const linha of orcamentos) {
    if (linha.state === 'exceeded') {
      alerts.push({
        id: `budget-exceeded-${linha.categoryId}`,
        severity: 'high',
        icon: 'triangle-alert',
        title: `${linha.label} passou do limite`,
        description: `${formatValue(Math.abs(linha.remainingCents))} acima do teto de ${formatValue(linha.limitCents)}.`,
        to: '/orcamento',
      })
    } else if (linha.state === 'warning') {
      alerts.push({
        id: `budget-warning-${linha.categoryId}`,
        severity: 'medium',
        icon: 'circle-alert',
        title: `${linha.label} está perto do limite`,
        description: `Restam ${formatValue(linha.remainingCents)} de ${formatValue(linha.limitCents)}.`,
        to: '/orcamento',
      })
    }
  }

  const totais = totalsForMonth(transactions, month)
  if (totais.net < 0) {
    alerts.push({
      id: `negative-${month}`,
      severity: 'high',
      icon: 'trending-up',
      title: `${formatMonthLong(month)} fechou no vermelho`,
      description: `Saiu ${formatValue(Math.abs(totais.net))} a mais do que entrou.`,
      to: '/transacoes',
    })
  }

  for (const meta of goalProgress(goals, transactions)) {
    if (meta.reached) {
      alerts.push({
        id: `goal-reached-${meta.goal.id}`,
        severity: 'low',
        icon: 'target',
        title: `Meta "${meta.goal.name}" concluída`,
        description: `Você juntou os ${formatValue(meta.goal.targetCents)} planejados.`,
        to: '/metas',
      })
    }
  }

  /*
   * Parcelas ainda por vir dentro do mês selecionado. Elas já estão lançadas —
   * o produto materializa a recorrência no cadastro — então isto não é previsão,
   * é o que falta acontecer de algo que já está no histórico.
   */
  const hoje = todayIso()
  const aVencer = transactions.filter(
    (item) =>
      item.kind === 'expense' &&
      monthOf(item.date) === month &&
      item.date > hoje &&
      item.installment !== null,
  )

  if (aVencer.length > 0) {
    const total = aVencer.reduce((soma, item) => soma + item.amountCents, 0)
    alerts.push({
      id: `upcoming-${month}`,
      severity: 'medium',
      icon: 'calendar',
      title: `${aVencer.length} ${aVencer.length === 1 ? 'parcela ainda vence' : 'parcelas ainda vencem'} este mês`,
      description: `${formatValue(total)} em lançamentos já registrados com data futura.`,
      to: '/transacoes',
    })
  }

  return alerts.sort((a, b) => ORDEM[a.severity] - ORDEM[b.severity])
}
