import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardFooter, CardHeader, CardLink } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { DeltaBadge, Figure, Money } from '@/components/ui/Money'
import {
  sortByDateDesc,
  categoryComparison,
  monthInsight,
  dailySpending,
  spendingPace,
  transactionsInMonth,
} from '@/domain/selectors'
import { cardSummary } from '@/domain/invoices'
import { activeSubscriptions } from '@/domain/subscriptions'
import { SpendingPaceChart } from '@/features/charts/LazyCharts'
import { CategoryBreakdown } from '@/features/charts/CategoryBreakdown'
import { HeatmapLegend, SpendingHeatmap } from '@/features/charts/SpendingHeatmap'
import { AccountsPanel } from '@/features/dashboard/AccountsPanel'
import { findBankBrand } from '@/features/dashboard/bankBrand'
import { callNameOf, dueTodayText, useGreeting } from '@/features/dashboard/Greeting'
import { TodayLeaf } from '@/features/dashboard/TodayLeaf'
import { SubscriptionsPanel } from '@/features/dashboard/SubscriptionsPanel'
import { CreditLimitPanel } from '@/features/dashboard/CreditLimitPanel'
import { InsightPanel } from '@/features/dashboard/InsightPanel'
import { useEntrance } from '@/features/motion/useEntrance'
import { WelcomePanel } from '@/features/dashboard/WelcomePanel'
import { SubscriptionDetails } from '@/features/subscriptions/SubscriptionDetails'
import { TransactionDetails } from '@/features/transactions/TransactionDetails'
import { TransactionForm } from '@/features/transactions/TransactionForm'
import { TransactionList } from '@/features/transactions/TransactionList'
import type { Transaction } from '@/domain/types'
import { formatMonthLong, todayIso } from '@/lib/date'
import { useFinanceStore } from '@/store/financeStore'
import {
  useAccounts,
  useCategories,
  useGoals,
  useIsEmpty,
  useProfile,
  useSelectedMonth,
  useTransactions,
} from '@/store/hooks'

export function DashboardPage() {
  const month = useSelectedMonth()
  const transactions = useTransactions()
  const categories = useCategories()
  const goals = useGoals()
  const accounts = useAccounts()
  const profile = useProfile()
  const isEmpty = useIsEmpty()
  const addTransaction = useFinanceStore((state) => state.addTransaction)
  const updateTransaction = useFinanceStore((state) => state.updateTransaction)
  const navigate = useNavigate()

  const [composing, setComposing] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  // Os três detalhes que abrem desta tela. Todos guardam o identificador, e
  // não uma cópia: lidos do histórico a cada renderização, mostram a versão
  // editada e se fecham sozinhos se o que abriram deixar de existir.
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [viewingSeries, setViewingSeries] = useState<string | null>(null)

  const categorySpend = useMemo(
    () => categoryComparison(transactions, categories, month),
    [transactions, categories, month],
  )
  // Sem `month`: assinatura fala do presente para a frente, e não do mês
  // que a página está mostrando.
  const subscriptions = useMemo(
    () => activeSubscriptions(transactions, categories),
    [transactions, categories],
  )
  const pace = useMemo(() => spendingPace(transactions, month), [transactions, month])
  const diario = useMemo(() => dailySpending(transactions, month), [transactions, month])
  // Hook no corpo do componente, e não dentro do JSX: chamar hook numa
  // expressão de render funciona hoje e quebra no dia em que alguém envolver
  // a linha num condicional.
  const chamada = `${useGreeting()}, que tal dar uma olhada no seu mês?`
  const insight = useMemo(
    () => monthInsight(transactions, categories, month, callNameOf(profile)),
    [transactions, categories, month, profile],
  )
  // Cinco, como no produto de referência. Com os lançamentos agrupados por
  // dia, cada dia diferente acrescenta um cabeçalho, e seis linhas em seis dias
  // faziam o painel ficar bem mais alto que o de assinaturas ao lado dele.
  const recent = useMemo(
    () => sortByDateDesc(transactionsInMonth(transactions, month)).slice(0, 5),
    [transactions, month],
  )

  // Os painéis entram uma vez, quando a tela abre e quando o mês troca — que
  // é quando todos eles mudam de conteúdo ao mesmo tempo.
  const grade = useEntrance<HTMLDivElement>(month)

  const hoje = todayIso()
  const briefing = useMemo(() => dueTodayText(transactions, hoje), [transactions, hoje])

  const viewing = viewingId ? (transactions.find((item) => item.id === viewingId) ?? null) : null
  const viewingSubscription = viewingSeries
    ? (subscriptions.find((item) => item.seriesId === viewingSeries) ?? null)
    : null

  // O mesmo resumo de cartão da tela de Contas, para as duas telas dizerem o
  // mesmo disponível sobre o mesmo cartão.
  const resumosDeCartao = useMemo(
    () =>
      accounts
        .filter((account) => !account.archived && account.kind === 'credit_card')
        .map((account) => cardSummary(account, transactions, hoje)),
    [accounts, transactions, hoje],
  )
  const bancoDasContas = useMemo(
    () => accounts.map((account) => findBankBrand(account.name, account.institution)).find(Boolean) ?? null,
    [accounts],
  )

  if (isEmpty) return <WelcomePanel />

  return (
    <>
      {/*
        A saudação saiu daqui e foi para dentro do painel de insight, que é
        onde ela conversa com alguma coisa: solta no topo ela era uma linha
        sem função acima de uma tela cheia de painéis. O que fica é o nome da
        rota e o seletor de mês, que governa tudo abaixo.
      */}
      <PageHeader
        title="Visão geral"
        leading={<TodayLeaf date={hoje} />}
        description={briefing}
        showMonth
        actions={
          <Button icon="plus" data-tour="new-transaction" onClick={() => setComposing(true)}>
            Nova transação
          </Button>
        }
      />

      {/*
        As colunas se esticam até a altura da linha, e o último painel de cada
        uma cresce para preencher. Sem isso, a coluna que termina antes deixa
        uma sobra aberta no meio da tela — e sobra entre painéis lê como falha,
        enquanto um painel um pouco mais alto lê como respiro.
      */}
      {/*
        Quatro linhas, na ordem e na proporção do produto de referência:
        leitura e ritmo; contas e limite; mapa e categorias; transações e
        assinaturas.

        Resultado do mês, meta em foco e orçamento do mês já estiveram aqui e
        saíram por decisão explícita, para a tela seguir a referência. Nenhum
        dos três se perdeu: o resultado está no resumo de Transações, e meta e
        orçamento têm aba própria. O gráfico de fluxo dos últimos seis meses
        saiu junto e não tem outra casa ainda — o componente continua em
        `features/charts/FlowChart.tsx`.

        Cada linha junta painéis de altura parecida. A grade já foi duas colunas
        de alturas livres, e o painel da esquerda esticava até a altura da pilha
        da direita: a leitura do mês ficava com um vazio de meia tela no meio.
      */}
      <div ref={grade} className="grid gap-5 lg:grid-cols-12">
        <InsightPanel
          insight={insight}
          today={hoje}
          chamada={chamada}
          className="lg:col-span-6"
        />

        {/*
          O ritmo sozinho, no formato do produto de referência: o quanto o mês
          está acima ou abaixo do anterior no mesmo dia, a variação em pastilha,
          e a curva. Ele já dividia o painel com o resultado do mês, e os dois
          juntos faziam um painel alto demais para ficar ao lado da leitura.
        */}
        <Card className="flex flex-col lg:col-span-6">
          <CardHeader
            title="Ritmo de gastos"
            action={<CardLink to="/transacoes">ver todas</CardLink>}
          />
          <Figure
            cents={Math.abs(pace.deltaCents)}
            size="sm"
            suffix={
              pace.deltaCents === 0 ? 'no mesmo ritmo' : pace.deltaCents > 0 ? 'acima' : 'abaixo'
            }
          />
          <div className="mt-3 flex flex-wrap items-center gap-2.5">
            {/* Sem pastilha quando a variação é zero: "−0%" é um sinal sem
                número. Sem mês anterior também não há variação a mostrar. */}
            {pace.ratio !== null && pace.ratio !== 0 ? (
              <DeltaBadge percent={pace.ratio * 100} tone={pace.ratio > 0 ? 'bad' : 'good'} />
            ) : null}
            <span className="text-xs text-muted">
              vs <Money cents={pace.previousCents} className="text-xs text-muted" /> no mesmo dia
              do mês anterior
            </span>
          </div>

          <div className="mt-5 flex-1">
            <SpendingPaceChart pace={pace} />
          </div>

          {/*
            A legenda desce para baixo da curva, como no produto de referência.
            Ela ficava no cabeçalho com o argumento de que saber qual linha é
            qual é pré-requisito para ler — e continua sendo: por isso as
            marcas repetem o traço exato de cada linha, sólido e tracejado, e
            não um quadradinho de cor que exigiria consultar a legenda.
          */}
          <dl className="mt-4 flex items-center gap-5 text-xs text-muted">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="h-0.5 w-5 rounded-full bg-ink" />
              <dt>Este mês</dt>
            </div>
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className="h-0.5 w-5 rounded-full border-t border-dashed border-faint"
              />
              <dt>Mês passado</dt>
            </div>
          </dl>
        </Card>

        <div className="flex lg:col-span-6">
          <AccountsPanel accounts={accounts} />
        </div>

        <div className="flex lg:col-span-6">
          <CreditLimitPanel resumos={resumosDeCartao} fallbackBank={bancoDasContas} className="flex-1" />
        </div>

        <Card className="flex flex-col lg:col-span-5">
          <CardHeader
            title="Mapa de calor"
            description={`Gasto por dia em ${formatMonthLong(month).toLowerCase()}`}
          />
          {diario.peak === null ? (
            <EmptyState
              icon="calendar"
              size="sm"
              title="Nenhuma despesa neste mês"
              description="Assim que houver gastos lançados, o mapa mostra em que dias eles se concentraram."
            />
          ) : (
            <>
              <p className="text-xs text-muted">
                Média diária: <Money cents={diario.dailyAverageCents} emphasis="strong" />
              </p>
              <SpendingHeatmap
                dias={diario.days}
                month={month}
                primeiroDiaDaSemana={diario.firstWeekday}
                /*
                  O dia abre em Transações, filtrado. Já foi uma janela aqui
                  mesmo, e o motivo de sair é que a janela era um beco: listava
                  o dia e acabava ali, enquanto a tela de Transações lista o
                  mesmo dia e ainda deixa afrouxar o recorte, ordenar, buscar e
                  exportar. `tipo=expense` acompanha porque o mapa fala de
                  despesa — sem ele, uma receita do mesmo dia entraria na lista
                  e o total da tela não bateria com o da célula clicada.
                */
                onSelecionar={(dia) =>
                  navigate(
                    `/transacoes?dia=${month}-${String(dia.day).padStart(2, '0')}&tipo=expense`,
                  )
                }
                className="mt-5"
              />
              <HeatmapLegend className="mt-4" />
              <CardFooter>
                <span>Maior gasto</span>
                <span>
                  <Money cents={diario.peak.cents} emphasis="strong" className="text-expense" /> no dia{' '}
                  {diario.peak.day}
                </span>
              </CardFooter>
            </>
          )}
        </Card>

        {/*
          A tabela de categorias tem cinco colunas e precisa da largura. O mapa
          de calor ao lado responde "quando", que é a pergunta que nenhum outro
          painel responde.
        */}
        <Card className="flex flex-col lg:col-span-7">
          <CardHeader
            title="Principais categorias"
            description={`Onde você mais gastou em ${formatMonthLong(month).toLowerCase()}, e o que mudou`}
            action={<CardLink to="/categorias">ver todas</CardLink>}
          />
          <CategoryBreakdown data={categorySpend} limit={5} className="flex-1" />
        </Card>

        <Card className="lg:col-span-6">
          <CardHeader
            title="Transações recentes"
            action={<CardLink to="/transacoes">ver todas</CardLink>}
          />
          {recent.length === 0 ? (
            <EmptyState
              icon="arrow-left-right"
              size="sm"
              title="Nada lançado neste mês"
              description="Registre a primeira movimentação e ela aparece aqui, na composição por categoria e no resultado."
              action={
                <Button size="sm" variant="quiet" icon="plus" onClick={() => setComposing(true)}>
                  Nova transação
                </Button>
              }
            />
          ) : (
            <TransactionList
              transactions={recent}
              categories={categories}
              goals={goals}
              readOnly
              groupByDay
              onOpen={(transaction) => setViewingId(transaction.id)}
            />
          )}
        </Card>

        <div className="flex lg:col-span-6">
          <SubscriptionsPanel
            subscriptions={subscriptions}
            onAbrir={(subscription) => setViewingSeries(subscription.seriesId)}
          />
        </div>
      </div>

      <TransactionDetails
        transaction={viewing}
        transactions={transactions}
        categories={categories}
        goals={goals}
        accounts={accounts}
        onClose={() => setViewingId(null)}
        onOpen={(transaction) => setViewingId(transaction.id)}
        onEdit={(transaction) => {
          setViewingId(null)
          setEditing(transaction)
        }}
      />

      <SubscriptionDetails
        subscription={viewingSubscription}
        transactions={transactions}
        categories={categories}
        goals={goals}
        accounts={accounts}
        onClose={() => setViewingSeries(null)}
        /* Uma cobrança abre como lançamento, e o detalhe da assinatura fecha:
           dois modais empilhados deixam a pessoa sem saber o que o Esc fecha. */
        onOpenTransaction={(transaction) => {
          setViewingSeries(null)
          setViewingId(transaction.id)
        }}
      />

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Editar transação"
        description={
          editing?.installment
            ? `Parcela ${editing.installment.index} de ${editing.installment.total}. As demais não mudam.`
            : undefined
        }
      >
        {editing ? (
          <TransactionForm
            categories={categories}
            goals={goals}
            accounts={accounts}
            initial={editing}
            submitLabel="Salvar alterações"
            onCancel={() => setEditing(null)}
            onSubmit={(draft) => {
              updateTransaction(editing.id, draft)
              setEditing(null)
            }}
          />
        ) : null}
      </Dialog>

      <Dialog
        open={composing}
        onClose={() => setComposing(false)}
        title="Nova transação"
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
