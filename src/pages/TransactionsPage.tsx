import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Icon, type IconName } from '@/components/Icon'
import { Button, IconButton } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/Field'
import { Money } from '@/components/ui/Money'
import { Select, type SelectOption } from '@/components/ui/Select'
import { exportTransactionsCsv } from '@/features/settings/exportCsv'
import { CategoryFilter } from '@/features/transactions/CategoryFilter'
import { TransactionDetails } from '@/features/transactions/TransactionDetails'
import { TransactionForm } from '@/features/transactions/TransactionForm'
import { TransactionList } from '@/features/transactions/TransactionList'
import {
  EMPTY_FILTERS,
  filterTransactions,
  monthsWithActivity,
  sortTransactions,
  totalsFor,
  type TransactionFilters,
  type TransactionOrder,
} from '@/domain/selectors'
import type { CategoryId, Transaction, TransactionKind } from '@/domain/types'
import { cn } from '@/lib/cn'
import {
  currentMonth,
  formatDayMonth,
  formatMonthLong,
  isValidIsoDate,
  monthOf,
  shiftMonth,
  formatWeekdayLong,
  type MonthKey,
} from '@/lib/date'
import { useFinanceStore } from '@/store/financeStore'
import {
  useAccounts,
  useCategories,
  useGoals,
  useSelectedMonth,
  useTransactions,
} from '@/store/hooks'

/** Valor do seletor de período que desliga o recorte mensal. */
const TODO_O_HISTORICO = 'all'

const KIND_OPTIONS: readonly SelectOption[] = [
  { value: 'all', label: 'Todas as transações' },
  { value: 'expense', label: 'Despesas' },
  { value: 'income', label: 'Receitas' },
  { value: 'contribution', label: 'Aportes' },
]

const ORDER_OPTIONS: readonly { value: TransactionOrder; label: string }[] = [
  { value: 'date-desc', label: 'Data (mais recentes)' },
  { value: 'date-asc', label: 'Data (mais antigas)' },
  { value: 'amount-desc', label: 'Valor (maior primeiro)' },
  { value: 'amount-asc', label: 'Valor (menor primeiro)' },
]

/**
 * Transações: filtros no alto, o resumo do recorte, e a tabela.
 *
 * A tela segue o produto de referência na forma: uma fileira de filtros em
 * pílula, quatro números em grade, e a tabela na largura inteira. O formulário
 * fixo na lateral saiu — "Nova transação" abre uma janela, como no painel.
 * O formulário lateral custava um terço da largura da tabela o tempo todo, para
 * uma ação que acontece algumas vezes por semana; a tabela é o que se lê todo
 * dia, e é ela que ganha o espaço.
 */
export function TransactionsPage() {
  const month = useSelectedMonth()
  const transactions = useTransactions()
  const categories = useCategories()
  const goals = useGoals()
  const accounts = useAccounts()

  const setSelectedMonth = useFinanceStore((state) => state.setSelectedMonth)
  const addTransaction = useFinanceStore((state) => state.addTransaction)
  const updateTransaction = useFinanceStore((state) => state.updateTransaction)
  const deleteTransaction = useFinanceStore((state) => state.deleteTransaction)

  /*
   * A tela abre filtrada quando o endereço pede.
   *
   * `?conta=<id>` é o destino do "Ver todas" da fatura de um cartão, e vem com
   * todo o histórico: a fatura atravessa dois meses do calendário, e o recorte
   * mensal cortaria metade dela.
   *
   * `?dia=<iso>` é o destino de uma célula do mapa de calor, e vem com o mês
   * daquele dia. `?tipo=` acompanha porque o mapa fala de despesa: sem ele, um
   * salário que caiu no mesmo dia entraria na lista e o total da tela não
   * bateria com o número que estava na célula clicada.
   *
   * Os parâmetros só valem na chegada — depois, os filtros são da pessoa.
   */
  const [params] = useSearchParams()
  const contaInicial = params.get('conta')
  const chegouPorConta = Boolean(contaInicial && accounts.some((item) => item.id === contaInicial))

  const diaInicial = params.get('dia')
  const chegouPorDia = isValidIsoDate(diaInicial)
  const tipoInicial = params.get('tipo')
  const tipoValido = KIND_OPTIONS.some((opcao) => opcao.value === tipoInicial)

  const [allTime, setAllTime] = useState(chegouPorConta)
  const [filters, setFilters] = useState<TransactionFilters>(() => {
    if (chegouPorConta) return { ...EMPTY_FILTERS, accountId: contaInicial! }
    if (chegouPorDia) {
      return {
        ...EMPTY_FILTERS,
        day: diaInicial,
        kind: tipoValido ? (tipoInicial as TransactionKind | 'all') : 'all',
      }
    }
    return EMPTY_FILTERS
  })

  /*
   * O mês global segue o dia que chegou pelo endereço.
   *
   * Sem isto, um link para 12 de setembro aberto com outubro selecionado
   * mostraria uma tabela vazia: os dois recortes se cruzam, e o de mês venceria.
   * Efeito, e não cálculo no corpo: trocar o mês global é escrever no store, e
   * escrever durante a renderização de outra tela é o que o React proíbe.
   */
  useEffect(() => {
    if (chegouPorDia && monthOf(diaInicial) !== month) setSelectedMonth(monthOf(diaInicial))
    // Só na chegada: depois disso o mês é da pessoa.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [order, setOrder] = useState<TransactionOrder>('date-desc')
  const [composing, setComposing] = useState(false)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [removing, setRemoving] = useState<Transaction | null>(null)
  // O detalhe guarda o id, e não uma cópia: lido do histórico a cada
  // renderização, ele mostra a versão editada e fecha sozinho se a transação
  // for excluída por outro caminho.
  const [viewingId, setViewingId] = useState<string | null>(null)
  const viewing = viewingId ? (transactions.find((item) => item.id === viewingId) ?? null) : null

  const periodo = allTime ? null : month

  // O período recorta antes de tudo: a contagem de cada categoria no filtro
  // e o resumo falam do mesmo pedaço do histórico que a tabela mostra. O dia
  // entra aqui junto com o mês porque também é período — com um dia
  // escolhido, o filtro de categoria conta as categorias **daquele dia**.
  const doPeriodo = useMemo(
    () => filterTransactions(transactions, { ...EMPTY_FILTERS, month: periodo, day: filters.day }),
    [transactions, periodo, filters.day],
  )

  const visible = useMemo(
    () => sortTransactions(filterTransactions(doPeriodo, filters), order),
    [doPeriodo, filters, order],
  )

  const totals = useMemo(() => totalsFor(visible), [visible])

  const porCategoria = useMemo(() => {
    const contagem = new Map<CategoryId, number>()
    for (const t of doPeriodo) contagem.set(t.categoryId, (contagem.get(t.categoryId) ?? 0) + 1)
    return contagem
  }, [doPeriodo])

  const periodOptions = useMemo(() => periodOptionsFor(transactions, month), [transactions, month])

  const hasAnyTransaction = transactions.length > 0
  const isFiltered =
    filters.search !== '' ||
    filters.kind !== 'all' ||
    filters.accountId !== 'all' ||
    filters.day !== null ||
    filters.categoryIds.length > 0

  const rotuloDoPeriodo = filters.day
    ? `em ${formatDayMonth(filters.day)}`
    : allTime
      ? 'em todo o histórico'
      : `em ${formatMonthLong(month).toLowerCase()}`

  const quantasDespesas = visible.filter((t) => t.kind === 'expense').length
  const quantasReceitas = visible.filter((t) => t.kind === 'income').length

  return (
    <>
      {/*
        Sem cabeçalho visível, como na referência: a aba de seção logo acima já
        diz "Transações". O título continua existindo para quem navega por
        cabeçalhos, que é o atalho mais usado de leitor de tela.
      */}
      <h1 className="sr-only">Transações</h1>

      <div role="group" aria-label="Filtros" className="mb-5 flex flex-wrap items-center gap-2">
        <Select
          size="sm"
          icon="calendar"
          aria-label="Período"
          value={allTime ? TODO_O_HISTORICO : month}
          onChange={(value) => {
            if (value === TODO_O_HISTORICO) {
              setAllTime(true)
              return
            }
            // O período daqui é o mesmo mês global do produto. Escolher agosto
            // em Transações e voltar ao painel mostra agosto lá também — dois
            // meses diferentes em duas abas seria a pessoa comparando números
            // que não falam do mesmo período sem saber.
            setAllTime(false)
            setSelectedMonth(value)
            // Trocar de mês com um dia filtrado daria uma tabela vazia: os dois
            // recortes se contradizem, e quem acabou de escolher o mês quis o
            // mês.
            setFilters((atual) => (atual.day ? { ...atual, day: null } : atual))
          }}
          options={periodOptions}
        />

        {accounts.length > 0 ? (
          <Select
            size="sm"
            aria-label="Conta"
            value={filters.accountId}
            onChange={(value) => setFilters((atual) => ({ ...atual, accountId: value }))}
            options={[
              { value: 'all', label: 'Todas as contas' },
              ...accounts.map((account) => ({ value: account.id, label: account.name })),
            ]}
          />
        ) : null}

        <Select
          size="sm"
          aria-label="Tipo de transação"
          value={filters.kind}
          onChange={(value) =>
            setFilters((atual) => ({ ...atual, kind: value as TransactionKind | 'all' }))
          }
          options={KIND_OPTIONS}
        />

        <Select
          size="sm"
          aria-label="Ordenar por"
          value={order}
          onChange={(value) => setOrder(value as TransactionOrder)}
          options={ORDER_OPTIONS}
        />

        <CategoryFilter
          categories={categories}
          value={filters.categoryIds}
          counts={porCategoria}
          onChange={(categoryIds) => setFilters((atual) => ({ ...atual, categoryIds }))}
        />

        {/*
          O dia vira uma pastilha em vez de um seletor: ele não é uma escolha
          que se faz aqui, é uma que chegou de outra tela. A pastilha diz qual
          dia está valendo — e some sozinha ao ser dispensada, porque um
          controle que só tem um estado não precisa continuar ocupando a fila.
        */}
        {filters.day ? (
          <button
            type="button"
            onClick={() => setFilters((atual) => ({ ...atual, day: null }))}
            className="inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3.5 py-2 text-[0.8125rem] font-medium text-accent transition-colors duration-150 hover:bg-accent/20"
          >
            <Icon name="calendar" size={14} className="shrink-0" />
            {capitalizar(formatWeekdayLong(filters.day))}, {formatDayMonth(filters.day)}
            <Icon name="x" size={14} className="shrink-0" />
            <span className="sr-only">Remover o filtro de dia</span>
          </button>
        ) : null}

        {isFiltered ? (
          <Button size="sm" variant="ghost" icon="x" onClick={() => setFilters(EMPTY_FILTERS)}>
            Limpar filtros
          </Button>
        ) : null}
      </div>

      {/*
        O resumo do recorte, respondendo aos filtros em tempo real: lê de
        `totals`, que sai de `visible`.

        Aparece mesmo quando o filtro não acha nada — zero é o que aquele
        recorte soma, e sumir com a grade faria a tabela pular de lugar a cada
        tecla da busca. Só não aparece para quem nunca lançou nada: ali os
        quatro zeros não resumem coisa nenhuma.

        Aportes não têm quadro próprio, como na referência, que tem quatro. Eles
        não somem da conta: o saldo os desconta e diz quanto descontou.

        Dois por linha também no celular. Empilhados, os quatro ocupavam a
        primeira tela inteira e a tabela — que é o motivo de abrir esta aba —
        começava abaixo da dobra.
      */}
      {hasAnyTransaction ? (
        <div className="mb-5 grid grid-cols-2 gap-3 sm:gap-4">
          <StatCard
            label="Total"
            icon="hash"
            value={<span className="tnum text-ink">{visible.length}</span>}
            caption={`${visible.length === 1 ? 'transação' : 'transações'} ${rotuloDoPeriodo}`}
          />
          <StatCard
            label="Despesas"
            icon="trending-down"
            iconClass="text-expense"
            value={<Money cents={totals.expense} className="text-expense" />}
            caption={`${quantasDespesas} ${quantasDespesas === 1 ? 'saída' : 'saídas'}`}
          />
          <StatCard
            label="Receitas"
            icon="trending-up"
            iconClass="text-income"
            value={<Money cents={totals.income} className="text-income" />}
            caption={`${quantasReceitas} ${quantasReceitas === 1 ? 'entrada' : 'entradas'}`}
          />
          <StatCard
            label="Saldo"
            icon="arrow-left-right"
            iconClass={totals.net < 0 ? 'text-expense' : 'text-income'}
            value={
              <Money
                cents={totals.net}
                signed
                className={totals.net < 0 ? 'text-expense' : 'text-income'}
              />
            }
            caption={
              totals.contribution > 0 ? (
                <>
                  receitas menos despesas e{' '}
                  <Money cents={totals.contribution} className="text-muted" /> em aportes
                </>
              ) : (
                'receitas menos despesas'
              )
            }
          />
        </div>
      ) : null}

      <Card className="p-4 sm:p-6">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="sm:w-80">
            <SearchInput
              label="Buscar transações"
              placeholder="Buscar transações…"
              value={filters.search}
              onChange={(event) =>
                setFilters((atual) => ({ ...atual, search: event.target.value }))
              }
              className="h-11"
            />
          </div>
          <div className="flex items-center gap-2">
            {/*
              A exportação fica, discreta, porque exporta o recorte: é a única
              forma de levar para a planilha "as despesas de mercado de agosto"
              sem filtrar de novo lá. Ajustes exporta o histórico inteiro.
            */}
            <IconButton
              icon="download"
              label="Exportar o recorte em CSV"
              onClick={() => exportTransactionsCsv(visible, categories, goals)}
              disabled={visible.length === 0}
            />
            <Button
              variant="outline"
              icon="plus"
              data-tour="new-transaction"
              onClick={() => setComposing(true)}
              className="flex-1 sm:flex-none"
            >
              Nova transação
            </Button>
          </div>
        </div>

        {/*
          Filtrar não muda o foco nem dispara navegação, então quem usa leitor
          de tela não recebe nenhum sinal de que a lista encolheu. Esta região
          anuncia só a contagem — incluir os valores faria o leitor recitar a
          tabela inteira a cada tecla digitada na busca.
        */}
        <p aria-live="polite" className="sr-only">
          {visible.length === 0
            ? 'Nenhuma transação encontrada.'
            : `${visible.length} ${visible.length === 1 ? 'transação encontrada' : 'transações encontradas'}.`}
        </p>

        {visible.length === 0 ? (
          hasAnyTransaction ? (
            <EmptyState
              icon="list-filter"
              title="Nenhuma transação com esses filtros"
              description={
                allTime
                  ? 'Nada corresponde aos filtros em todo o histórico.'
                  : `Nada corresponde aos filtros ${rotuloDoPeriodo}. Tente outro período, ou veja todo o histórico.`
              }
              action={
                isFiltered ? (
                  <Button size="sm" variant="quiet" onClick={() => setFilters(EMPTY_FILTERS)}>
                    Limpar filtros
                  </Button>
                ) : (
                  <Button size="sm" variant="quiet" onClick={() => setAllTime(true)}>
                    Ver todo o histórico
                  </Button>
                )
              }
            />
          ) : (
            <EmptyState
              icon="arrow-left-right"
              title="Nenhuma transação ainda"
              description="Registre a primeira em “Nova transação”. Ela aparece aqui e alimenta a visão geral na mesma hora."
            />
          )
        ) : (
          <TransactionList
            transactions={visible}
            categories={categories}
            goals={goals}
            accounts={accounts}
            onEdit={setEditing}
            onDelete={setRemoving}
            onOpen={(transaction) => setViewingId(transaction.id)}
          />
        )}
      </Card>

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

      <Dialog open={composing} onClose={() => setComposing(false)} title="Nova transação">
        <TransactionForm
          categories={categories}
          goals={goals}
          accounts={accounts}
          onCancel={() => setComposing(false)}
          onSubmit={(draft, recurrence) => {
            addTransaction(draft, recurrence)
            setComposing(false)
          }}
        />
      </Dialog>

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

      <ConfirmDialog
        open={removing !== null}
        onClose={() => setRemoving(null)}
        onConfirm={() => {
          if (removing) deleteTransaction(removing.id)
        }}
        title="Excluir transação"
        message={
          removing
            ? `"${removing.description}" será removida do histórico e dos totais. Não dá para desfazer.`
            : ''
        }
        confirmLabel="Excluir"
      />
    </>
  )
}

/**
 * Um dos quatro números do resumo.
 *
 * O ícone repete a direção que o rótulo já diz, na cor dela, como na
 * referência — é enfeite com função: acha-se "despesas" pela seta antes de
 * ler a palavra. O número é que carrega a leitura, e ele não depende do
 * ícone: o rótulo está escrito, e o saldo leva sinal.
 */
function StatCard({
  label,
  icon,
  iconClass = 'text-muted',
  value,
  caption,
}: {
  label: string
  icon: IconName
  iconClass?: string
  value: ReactNode
  caption: ReactNode
}) {
  return (
    <Card className="flex min-w-0 flex-col gap-2 p-4 sm:gap-3 sm:p-5">
      <div className="flex items-center justify-between gap-3">
        <span className="text-xs font-medium tracking-[0.06em] text-muted uppercase">{label}</span>
        <Icon name={icon} size={16} className={cn('shrink-0', iconClass)} />
      </div>
      <p className="truncate text-xl leading-none font-bold tracking-tight sm:text-[1.75rem]">{value}</p>
      <p className="text-xs text-muted">{caption}</p>
    </Card>
  )
}

/**
 * Os períodos que o seletor oferece: os meses com lançamento, mais o mês
 * corrente e o escolhido agora, mesmo vazios — "Este mês" precisa existir no
 * primeiro dia do mês, antes do primeiro lançamento dele.
 */
function periodOptionsFor(transactions: readonly Transaction[], selecionado: MonthKey): SelectOption[] {
  const hoje = currentMonth()
  const passado = shiftMonth(hoje, -1)
  const meses = new Set<MonthKey>([hoje, selecionado, ...monthsWithActivity(transactions)])

  const rotulo = (m: MonthKey) =>
    m === hoje ? 'Este mês' : m === passado ? 'Mês passado' : formatMonthLong(m)

  return [
    ...[...meses].sort().reverse().map((m) => ({ value: m, label: rotulo(m) })),
    { value: TODO_O_HISTORICO, label: 'Todo o histórico' },
  ]
}

/** "sábado" vira "Sábado": a pastilha começa com maiúscula. */
function capitalizar(valor: string): string {
  return valor.charAt(0).toUpperCase() + valor.slice(1)
}
