import { useMemo, useState } from 'react'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader } from '@/components/ui/Card'
import { Segmented, type SegmentOption } from '@/components/ui/Controls'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { Figure, FlowIndicator, Money } from '@/components/ui/Money'
import { exportTransactionsCsv } from '@/features/settings/exportCsv'
import { TransactionForm } from '@/features/transactions/TransactionForm'
import { TransactionList } from '@/features/transactions/TransactionList'
import {
  EMPTY_FILTERS,
  filterTransactions,
  sortByDateDesc,
  totalsFor,
  type TransactionFilters,
} from '@/domain/selectors'
import type { Transaction, TransactionKind } from '@/domain/types'
import { formatMonthLong } from '@/lib/date'
import type { Cents } from '@/lib/money'
import { useFinanceStore } from '@/store/financeStore'
import {
  useAccounts,
  useCategories,
  useGoals,
  useSelectedMonth,
  useTransactions,
} from '@/store/hooks'

type Scope = 'month' | 'all'

const SCOPE_OPTIONS: readonly SegmentOption<Scope>[] = [
  { value: 'month', label: 'Mês' },
  { value: 'all', label: 'Tudo' },
]

const KIND_LABEL: Record<TransactionKind | 'all', string> = {
  all: 'Todos os tipos',
  income: 'Receitas',
  expense: 'Despesas',
  contribution: 'Aportes',
}

export function TransactionsPage() {
  const month = useSelectedMonth()
  const transactions = useTransactions()
  const categories = useCategories()
  const goals = useGoals()
  const accounts = useAccounts()

  const addTransaction = useFinanceStore((state) => state.addTransaction)
  const updateTransaction = useFinanceStore((state) => state.updateTransaction)
  const deleteTransaction = useFinanceStore((state) => state.deleteTransaction)

  const [scope, setScope] = useState<Scope>('month')
  const [filters, setFilters] = useState<TransactionFilters>(EMPTY_FILTERS)
  const [editing, setEditing] = useState<Transaction | null>(null)
  const [removing, setRemoving] = useState<Transaction | null>(null)
  const [composingOnMobile, setComposingOnMobile] = useState(false)

  const visible = useMemo(() => {
    const filtered = filterTransactions(transactions, {
      ...filters,
      month: scope === 'month' ? month : null,
    })
    return sortByDateDesc(filtered)
  }, [transactions, filters, scope, month])

  const totals = useMemo(() => totalsFor(visible), [visible])
  const hasAnyTransaction = transactions.length > 0
  const isFiltered =
    filters.search !== '' || filters.kind !== 'all' || filters.categoryId !== 'all'

  const formPanel = (
    <TransactionForm
      categories={categories}
      goals={goals}
      accounts={accounts}
      onSubmit={(draft, recurrence) => {
        addTransaction(draft, recurrence)
        setComposingOnMobile(false)
      }}
    />
  )

  return (
    <>
      <PageHeader
        title="Transações"
        description="Todo o histórico, filtrável e editável linha a linha."
        showMonth
        actions={
          <>
            <Segmented
              label="Período exibido"
              options={SCOPE_OPTIONS}
              value={scope}
              onChange={setScope}
              size="sm"
              className="w-[124px]"
            />
            <Button
              variant="quiet"
              icon="download"
              onClick={() => exportTransactionsCsv(visible, categories, goals)}
              disabled={visible.length === 0}
            >
              <span className="hidden sm:inline">Exportar CSV</span>
            </Button>
            <Button
              icon="plus"
              className="lg:hidden"
              onClick={() => setComposingOnMobile(true)}
            >
              <span className="hidden sm:inline">Novo</span>
            </Button>
          </>
        }
      />

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-8">
          <Card>
            {/*
              O resultado do recorte atual, à frente de tudo — a mesma
              composição do Painel: uma Figura carrega a resposta, a dl ao
              lado detalha. Ela responde à filtragem em tempo real porque lê
              de `totals`, que já é derivado de `visible`; é a resposta a
              "quanto entrou, saiu e sobrou neste recorte" sem exigir conta de
              cabeça. Não aparece sobre lista vazia — um resultado de
              R$ 0,00 acima de "nenhum lançamento" seria número inventado
              sobre uma tela que já diz a verdade sozinha.
            */}
            {visible.length > 0 ? (
              <div className="mb-6 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 border-b border-hairline pb-6">
                <div>
                  <p className="text-xs text-muted">
                    {visible.length} {visible.length === 1 ? 'lançamento' : 'lançamentos'}{' '}
                    {scope === 'month'
                      ? `em ${formatMonthLong(month).toLowerCase()}`
                      : 'em todo o histórico'}
                  </p>
                  <Figure cents={totals.net} tone="auto" className="mt-2" />
                </div>
                <dl className="flex flex-wrap gap-x-7 gap-y-4">
                  <SummaryStat label="Receitas" cents={totals.income} tone="income" />
                  <SummaryStat label="Despesas" cents={totals.expense} tone="expense" />
                  <SummaryStat label="Aportes" cents={totals.contribution} tone="contribution" />
                </dl>
              </div>
            ) : null}

            <div className="mb-4 flex flex-col gap-2.5 sm:flex-row">
              <SearchInput
                label="Buscar por descrição"
                placeholder="Buscar por descrição…"
                value={filters.search}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, search: event.target.value }))
                }
                className="sm:flex-1"
              />
              <div className="flex gap-2.5">
                <Select
                  aria-label="Filtrar por tipo"
                  value={filters.kind}
                  onChange={(value) =>
                    setFilters((current) => ({
                      ...current,
                      kind: value as TransactionKind | 'all',
                    }))
                  }
                  options={Object.entries(KIND_LABEL).map(([value, label]) => ({ value, label }))}
                  className="flex-1 sm:w-40"
                />
                <Select
                  aria-label="Filtrar por categoria"
                  value={filters.categoryId}
                  onChange={(value) =>
                    setFilters((current) => ({ ...current, categoryId: value }))
                  }
                  options={[
                    { value: 'all', label: 'Todas as categorias' },
                    ...categories.map((category) => ({
                      value: category.id,
                      label: category.label,
                    })),
                  ]}
                  className="flex-1 sm:w-44"
                />
              </div>
            </div>

            {/*
              Filtrar não muda o foco nem dispara navegação, então quem usa
              leitor de tela não recebe nenhum sinal de que a lista encolheu.
              Esta região anuncia só a contagem — incluir os valores aqui faria
              o leitor recitar a tabela inteira a cada tecla digitada na busca.
            */}
            <p aria-live="polite" className="sr-only">
              {visible.length === 0
                ? 'Nenhum lançamento encontrado.'
                : `${visible.length} ${visible.length === 1 ? 'lançamento encontrado' : 'lançamentos encontrados'}.`}
            </p>

            {visible.length === 0 ? (
              hasAnyTransaction ? (
                <EmptyState
                  icon="list-filter"
                  title="Nenhum lançamento com esses filtros"
                  description={
                    scope === 'month'
                      ? `Nada corresponde à busca em ${formatMonthLong(month).toLowerCase()}. Tente outro mês, ou veja todo o histórico.`
                      : 'Nada corresponde à busca em todo o histórico.'
                  }
                  action={
                    isFiltered ? (
                      <Button
                        size="sm"
                        variant="quiet"
                        onClick={() => setFilters(EMPTY_FILTERS)}
                      >
                        Limpar filtros
                      </Button>
                    ) : (
                      <Button size="sm" variant="quiet" onClick={() => setScope('all')}>
                        Ver todo o histórico
                      </Button>
                    )
                  }
                />
              ) : (
                <EmptyState
                  icon="arrow-left-right"
                  title="Nenhum lançamento ainda"
                  description="Registre a primeira movimentação no formulário ao lado. Ela aparece aqui e alimenta o painel na mesma hora."
                />
              )
            ) : (
              <TransactionList
                transactions={visible}
                categories={categories}
                goals={goals}
                onEdit={setEditing}
                onDelete={setRemoving}
              />
            )}
          </Card>
        </div>

        {/*
          Formulário fixo na coluna lateral. Lançar é a ação mais repetida do
          produto; escondê-la atrás de um modal cobraria um clique e uma espera
          de animação em cada uso.
        */}
        <aside className="hidden lg:col-span-4 lg:block">
          <div className="sticky top-6">
            <Card>
              <CardHeader
                title="Novo lançamento"
                description="Entra no mês da data escolhida."
              />
              {formPanel}
            </Card>
          </div>
        </aside>
      </div>

      <Dialog
        open={composingOnMobile}
        onClose={() => setComposingOnMobile(false)}
        title="Novo lançamento"
      >
        {formPanel}
      </Dialog>

      <Dialog
        open={editing !== null}
        onClose={() => setEditing(null)}
        title="Editar lançamento"
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
        title="Excluir lançamento"
        message={
          removing
            ? `"${removing.description}" será removido do histórico e dos totais. Não dá para desfazer.`
            : ''
        }
        confirmLabel="Excluir"
      />
    </>
  )
}

function SummaryStat({
  label,
  cents,
  tone,
}: {
  label: string
  cents: Cents
  tone: TransactionKind
}) {
  return (
    <div>
      <dt className="flex items-center gap-1.5 text-xs text-muted">
        <FlowIndicator tone={tone} />
        {label}
      </dt>
      <dd className="mt-1.5">
        <Money cents={cents} className="text-base font-semibold" />
      </dd>
    </div>
  )
}
