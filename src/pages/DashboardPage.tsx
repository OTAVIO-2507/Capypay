import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Badge, Progress } from '@/components/ui/Controls'
import { Dialog } from '@/components/ui/Dialog'
import { Donut } from '@/components/ui/Donut'
import { EmptyState } from '@/components/ui/EmptyState'
import { Delta, Figure, FlowIndicator, Money } from '@/components/ui/Money'
import {
  budgetStatuses,
  compareWithPreviousMonth,
  cumulativeBalanceThrough,
  goalProgress,
  monthlyFlow,
  sortByDateDesc,
  spendingByCategory,
  transactionsInMonth,
  yearlyNet,
  type BudgetStatus,
  type GoalProgress,
} from '@/domain/selectors'
import type { TransactionKind } from '@/domain/types'
import { BalanceTrend, FlowChart } from '@/features/charts/LazyCharts'
import { CategoryBreakdown } from '@/features/charts/CategoryBreakdown'
import { dueTodayText, greetingTextFor } from '@/features/dashboard/Greeting'
import { TodayLeaf } from '@/features/dashboard/TodayLeaf'
import { UpcomingPanel } from '@/features/dashboard/UpcomingPanel'
import { PaymentCard } from '@/features/dashboard/PaymentCard'
import { WelcomePanel } from '@/features/dashboard/WelcomePanel'
import { TransactionForm } from '@/features/transactions/TransactionForm'
import { TransactionList } from '@/features/transactions/TransactionList'
import { formatMonthLong, todayIso, yearOf } from '@/lib/date'
import type { Cents } from '@/lib/money'
import { useFinanceStore } from '@/store/financeStore'
import {
  useAccounts,
  useBudgets,
  useCategories,
  useGoals,
  useIsEmpty,
  useProfile,
  useSelectedMonth,
  useTransactions,
} from '@/store/hooks'

export function DashboardPage() {
  const month = useSelectedMonth()
  const setMonth = useFinanceStore((state) => state.setSelectedMonth)
  const transactions = useTransactions()
  const categories = useCategories()
  const goals = useGoals()
  const accounts = useAccounts()
  const budgets = useBudgets()
  const profile = useProfile()
  const isEmpty = useIsEmpty()
  const addTransaction = useFinanceStore((state) => state.addTransaction)

  const [composing, setComposing] = useState(false)
  const [trendYear, setTrendYear] = useState(() => yearOf(month))

  const comparison = useMemo(
    () => compareWithPreviousMonth(transactions, month),
    [transactions, month],
  )
  const cumulative = useMemo(
    () => cumulativeBalanceThrough(transactions, month),
    [transactions, month],
  )
  const categorySpend = useMemo(
    () => spendingByCategory(transactions, categories, month),
    [transactions, categories, month],
  )
  const flow = useMemo(() => monthlyFlow(transactions, month, 6), [transactions, month])
  const yearData = useMemo(() => yearlyNet(transactions, trendYear), [transactions, trendYear])
  const budgetRows = useMemo(
    () => budgetStatuses(budgets, transactions, categories, month),
    [budgets, transactions, categories, month],
  )
  const goalRows = useMemo(() => goalProgress(goals, transactions), [goals, transactions])
  const recent = useMemo(
    () => sortByDateDesc(transactionsInMonth(transactions, month)).slice(0, 6),
    [transactions, month],
  )

  const primaryCard = accounts.find((account) => account.kind === 'credit_card' && !account.archived)
  const leadGoal = goalRows.find((row) => !row.reached) ?? goalRows[0]
  // A saudação toma o lugar do título. Desligada, o painel volta a se chamar
  // "Painel" — o cabeçalho nunca fica sem nome.
  const saudacao = greetingTextFor(profile, new Date().getHours())
  const hoje = todayIso()
  const briefing = useMemo(() => dueTodayText(transactions, hoje), [transactions, hoje])

  if (isEmpty) return <WelcomePanel />

  return (
    <>
      <PageHeader
        title={saudacao || 'Painel'}
        large
        /*
         * A folha de calendário à esquerda e o que hoje cobra embaixo.
         * Sozinha, a saudação era uma linha solta no topo de uma tela cheia de
         * painéis. O avatar já ocupou este lugar e saiu: ele vive na barra de
         * topo, e a mesma marca duas vezes na mesma tela não acrescenta nada.
         */
        leading={<TodayLeaf date={hoje} />}
        description={briefing}
        showMonth
        actions={
          <Button icon="plus" data-tour="new-transaction" onClick={() => setComposing(true)}>
            Novo lançamento
          </Button>
        }
      />

      {/*
        As colunas se esticam até a altura da linha, e o último painel de cada
        uma cresce para preencher. Sem isso, a coluna que termina antes deixa
        uma sobra aberta no meio da tela — e sobra entre painéis lê como falha,
        enquanto um painel um pouco mais alto lê como respiro.
      */}
      <div className="grid gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-4">
          <PaymentCard account={primaryCard} holder={profile.name} />
          <GoalSpotlight goal={leadGoal} />

          <Card className="flex flex-1 flex-col">
            <CardHeader
              title="Principais categorias"
              description={`Onde você mais gastou em ${formatMonthLong(month).toLowerCase()}`}
            />
            <CategoryBreakdown data={categorySpend} limit={5} className="flex-1" />
          </Card>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-8">
          <Card>
            <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
              <div>
                <p className="text-xs text-muted">Resultado de {formatMonthLong(month)}</p>
                <Figure cents={comparison.current.net} tone="auto" className="mt-2" />
                <Delta cents={comparison.netDelta} since="que o mês anterior" className="mt-3" />
              </div>

              <dl className="flex gap-7">
                <SummaryStat label="Receitas" cents={comparison.current.income} tone="income" />
                <SummaryStat label="Despesas" cents={comparison.current.expense} tone="expense" />
                <SummaryStat label="Acumulado" cents={cumulative} tone="auto" />
              </dl>
            </div>

            <BalanceTrend
              year={trendYear}
              data={yearData}
              selectedMonth={month}
              onSelectMonth={setMonth}
              onChangeYear={setTrendYear}
            />
          </Card>

          <Card>
            <CardHeader
              title="Orçamento do mês"
              description={
                budgetRows.length > 0
                  ? `${budgetRows.length} ${budgetRows.length === 1 ? 'limite definido' : 'limites definidos'}`
                  : undefined
              }
              action={<QuietLink to="/orcamento">Definir</QuietLink>}
            />
            <BudgetSummary rows={budgetRows} />
          </Card>

          <Card className="flex flex-1 flex-col">
            <CardHeader title="Entrou, saiu e guardou" description="Últimos seis meses" />
            <FlowChart data={flow} className="flex-1" />
          </Card>
        </div>

        {/*
          A linha de baixo fecha as duas colunas juntas. O que ainda vence fica
          ao lado do que já aconteceu — as duas metades da mesma pergunta — e a
          largura de cada um segue o peso: a lista é tabela, o vencimento é
          resumo.
        */}
        <div className="flex lg:col-span-4">
          <UpcomingPanel transactions={transactions} categories={categories} month={month} />
        </div>

        <Card className="lg:col-span-8">
          <CardHeader
            title="Últimos lançamentos"
            description={formatMonthLong(month)}
            action={<QuietLink to="/transacoes">Ver tudo</QuietLink>}
          />
          {recent.length === 0 ? (
            <EmptyState
              icon="arrow-left-right"
              size="sm"
              title="Nada lançado neste mês"
              description="Registre a primeira movimentação e ela aparece aqui, na composição por categoria e no resultado."
              action={
                <Button size="sm" variant="quiet" icon="plus" onClick={() => setComposing(true)}>
                  Novo lançamento
                </Button>
              }
            />
          ) : (
            <TransactionList
              transactions={recent}
              categories={categories}
              goals={goals}
              readOnly
            />
          )}
        </Card>
      </div>

      <Dialog
        open={composing}
        onClose={() => setComposing(false)}
        title="Novo lançamento"
        description="Some ao mês selecionado assim que você registrar."
      >
        <TransactionForm
          categories={categories}
          goals={goals}
          accounts={accounts}
          onSubmit={(draft, recurrence) => {
            addTransaction(draft, recurrence)
            setComposing(false)
          }}
          onCancel={() => setComposing(false)}
        />
      </Dialog>
    </>
  )
}

function QuietLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold text-muted transition-colors duration-150 hover:bg-sunken hover:text-ink"
    >
      {children}
      <Icon name="arrow-right" size={13} />
    </Link>
  )
}

/**
 * A pastilha de resumo. `tone="auto"` resolve pelo sinal, para o Acumulado —
 * que não é uma categoria de fluxo, é o saldo — carregar a mesma leitura
 * verde/terracota do Resultado, sem inventar uma quarta cor para isso.
 */
function SummaryStat({
  label,
  cents,
  tone,
}: {
  label: string
  cents: Cents
  tone: TransactionKind | 'auto'
}) {
  const dotTone = tone === 'auto' ? (cents >= 0 ? 'income' : 'expense') : tone

  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted">
        <FlowIndicator tone={dotTone} />
        {label}
      </dt>
      <dd className="mt-1.5">
        <Money cents={cents} className="text-base font-semibold" />
      </dd>
    </div>
  )
}

/**
 * A meta em destaque, em papel.
 *
 * Ela já foi um bloco de tinta. Com a barra lateral escura, a coluna esquerda
 * passou a empilhar barra, cartão e meta — três massas escuras seguidas, e a
 * tela inteira pendeu para um lado. A cota de tinta agora é gasta na barra e
 * no cartão; aqui o peso vem do anel, que é tinta cheia num painel claro.
 */
function GoalSpotlight({ goal }: { goal: GoalProgress | undefined }) {
  if (!goal) {
    return (
      <Card>
        <EmptyState
          icon="target"
          size="sm"
          title="Nenhuma meta ainda"
          description="Uma meta transforma sobra em objetivo: você separa um valor e acompanha o quanto falta."
          action={
            <Link to="/metas">
              <Button size="sm" variant="quiet" icon="plus">
                Criar meta
              </Button>
            </Link>
          }
        />
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader
        title="Meta em foco"
        description={goal.goal.name}
        action={
          <Link
            to="/metas"
            aria-label="Ver todas as metas"
            className="inline-flex size-9 items-center justify-center rounded-sm bg-sunken text-ink transition-colors duration-150 hover:bg-hairline"
          >
            <Icon name="arrow-right" size={15} />
          </Link>
        }
      />
      <div className="flex items-center gap-5">
        <Donut
          value={goal.percent}
          rawValue={goal.rawPercent}
          label={`${goal.goal.name}: ${goal.rawPercent}% da meta`}
          tone="income"
        />
        <div className="min-w-0">
          <p className="text-xs text-muted">Já guardado</p>
          <p className="mt-1.5 text-lg font-semibold">
            <Money cents={goal.savedCents} tabular={false} />
          </p>
          <p className="mt-3 text-xs text-muted">
            {goal.reached ? (
              'Meta atingida.'
            ) : (
              <>
                Faltam <Money cents={goal.remainingCents} emphasis="strong" />
              </>
            )}
          </p>
        </div>
      </div>
    </Card>
  )
}

/**
 * Resumo dos orçamentos. Mostra primeiro o que está mais perto de estourar,
 * porque a única pergunta que este painel responde é "onde eu preciso frear".
 */
function BudgetSummary({ rows }: { rows: BudgetStatus[] }) {
  if (rows.length === 0) {
    return (
      <EmptyState
        icon="wallet"
        size="sm"
        title="Sem limites definidos para este mês"
        description="Um limite por categoria transforma o gasto em algo que você acompanha durante o mês, e não descobre no fim dele."
        action={
          <Link to="/orcamento">
            <Button size="sm" variant="quiet" icon="plus">
              Definir limites
            </Button>
          </Link>
        }
      />
    )
  }

  return (
    <ul className="grid gap-5 sm:grid-cols-2">
      {rows.slice(0, 4).map((row) => (
        <li key={row.categoryId}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2.5">
              <Icon name={row.icon} size={15} className="shrink-0 text-faint" />
              <span className="truncate text-[0.8125rem] font-medium text-ink">{row.label}</span>
            </span>
            {row.state === 'exceeded' ? (
              <Badge tone="strong" icon="triangle-alert" className="shrink-0">
                Estourou
              </Badge>
            ) : row.state === 'warning' ? (
              <Badge tone="outline" icon="circle-alert" className="shrink-0">
                No limite
              </Badge>
            ) : (
              <span className="tnum shrink-0 text-xs text-muted">{row.percent}%</span>
            )}
          </div>
          <Progress
            value={row.barPercent}
            overflow={row.percent}
            label={`${row.label}: ${row.percent}% do limite usado`}
            tone={row.state === 'exceeded' ? 'expense' : 'income'}
          />
          <p className="mt-2 text-xs text-muted">
            <Money cents={row.spentCents} /> de{' '}
            <Money cents={row.limitCents} emphasis="muted" />
            {row.remainingCents < 0 ? (
              <>
                {' · '}
                <Money cents={Math.abs(row.remainingCents)} emphasis="strong" /> acima
              </>
            ) : null}
          </p>
        </li>
      ))}
    </ul>
  )
}
