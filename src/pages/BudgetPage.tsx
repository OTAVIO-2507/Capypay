import { useMemo } from 'react'
import { Icon } from '@/components/Icon'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { BlockPanel, Card, CardHeader } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Controls'
import { CategoryDonut } from '@/features/charts/CategoryDonut'
import { MoneyInput } from '@/components/ui/Field'
import { Money } from '@/components/ui/Money'
import { categoryColor, categoriesFor } from '@/domain/categories'
import { budgetStatuses, spendingByCategory, transactionsInMonth } from '@/domain/selectors'
import { cn } from '@/lib/cn'
import { formatMonthLong, shiftMonth } from '@/lib/date'
import { parseDecimalInput, toCents, toInputValue } from '@/lib/money'
import { useFinanceStore } from '@/store/financeStore'
import { useBudgets, useCategories, useSelectedMonth, useTransactions } from '@/store/hooks'

export function BudgetPage() {
  const month = useSelectedMonth()
  const budgets = useBudgets()
  const categories = useCategories()
  const transactions = useTransactions()
  const setBudget = useFinanceStore((state) => state.setBudget)
  const copyPrevious = useFinanceStore((state) => state.copyBudgetsFromPreviousMonth)

  const expenseCategories = useMemo(() => categoriesFor(categories, 'expense'), [categories])
  const limits = budgets[month] ?? {}
  const previousMonth = shiftMonth(month, -1)
  const hasPrevious = Object.keys(budgets[previousMonth] ?? {}).length > 0
  const hasLimits = Object.keys(limits).length > 0

  const statuses = useMemo(
    () => budgetStatuses(budgets, transactions, categories, month),
    [budgets, transactions, categories, month],
  )

  /** Gasto real por categoria, inclusive nas que ainda não têm limite. */
  const spentByCategory = useMemo(() => {
    const totals = new Map<string, number>()
    for (const transaction of transactionsInMonth(transactions, month)) {
      if (transaction.kind !== 'expense') continue
      totals.set(
        transaction.categoryId,
        (totals.get(transaction.categoryId) ?? 0) + transaction.amountCents,
      )
    }
    return totals
  }, [transactions, month])

  // A composição do anel: o gasto real do mês por categoria, inclusive nas
  // que não têm limite definido — o anel mostra para onde o dinheiro foi, e
  // isso não depende de alguém ter posto um teto.
  const categorySpend = useMemo(
    () => spendingByCategory(transactions, categories, month),
    [transactions, categories, month],
  )

  const totalLimit = statuses.reduce((sum, row) => sum + row.limitCents, 0)
  const totalSpent = statuses.reduce((sum, row) => sum + row.spentCents, 0)
  const exceeded = statuses.filter((row) => row.state === 'exceeded')
  const overallRemaining = totalLimit - totalSpent
  // O número acima do anel é o gasto do mês inteiro. `totalSpent` só soma as
  // categorias que têm limite, e o anel mostra todas — um total menor que a
  // soma das próprias fatias logo abaixo seria a tela se contradizendo.
  const totalSpentAll = categorySpend.reduce((soma, item) => soma + item.amount, 0)

  return (
    <>
      <PageHeader
        title="Orçamento"
        description="Um teto por categoria, guardado mês a mês. O histórico de meses anteriores é preservado."
        showMonth
        actions={
          hasPrevious && !hasLimits ? (
            <Button variant="quiet" icon="repeat" onClick={() => copyPrevious(month)}>
              Copiar de {formatMonthLong(previousMonth).toLowerCase()}
            </Button>
          ) : null
        }
      />

      <div className="grid gap-5 lg:grid-cols-12">
        <div className="flex flex-col gap-5 lg:col-span-7">
          {/*
            A Regra do Alerta Invertido, posta em prática: um limite estourado
            inverte o painel inteiro para tinta cheia — o evento mais alto
            disponível num campo sem cor.

            Fica no topo da coluna das categorias, e não no fim da outra, por
            dois motivos. O primeiro é de leitura: o aviso nomeia categorias, e
            a lista delas está logo abaixo — quem lê "Alimentação estourou"
            desce dois dedos e já está no campo do limite. O segundo é a Regra
            da Coluna que Fecha: acima, quem fecha o vão da coluna é a lista,
            que distribui a sobra entre as próprias linhas. No fim da coluna
            seria o bloco de aviso a esticar, e um aviso de duas linhas com
            duzentos pixels de vazio embaixo lê como falha de carregamento.
          */}
          {exceeded.length > 0 ? (
            <BlockPanel>
              <CardHeader
                title="Atenção"
                onBlock
                action={
                  <span className="inline-flex items-center gap-1 rounded-full bg-block-ink/15 px-2.5 py-1 text-xs font-semibold text-block-ink">
                    <Icon name="triangle-alert" size={12} />
                    {exceeded.length}
                  </span>
                }
              />
              <p className="text-xs leading-relaxed text-block-muted">
                {exceeded.length === 1
                  ? `O limite de ${exceeded[0].label} foi ultrapassado neste mês. Vale conferir os lançamentos dessa categoria ou ajustar o teto para o mês seguinte.`
                  : `Os limites de ${exceeded.map((row) => row.label).join(', ')} foram ultrapassados neste mês. Vale conferir os lançamentos dessas categorias ou ajustar os tetos para o mês seguinte.`}
              </p>
            </BlockPanel>
          ) : null}

          <Card className="flex flex-1 flex-col">
            <CardHeader
              title={`Limites de ${formatMonthLong(month).toLowerCase()}`}
              description="Deixe em branco ou zero para não acompanhar a categoria."
            />

          <ul className="flex flex-col divide-y divide-hairline">
            {expenseCategories.map((category) => {
              const limitCents = limits[category.id] ?? 0
              const spent = spentByCategory.get(category.id) ?? 0

              return (
                <li
                  key={category.id}
                  className="-mx-3 flex items-center justify-between gap-4 rounded-md px-3 py-2.5 transition-colors duration-150 hover:bg-sunken/60"
                >
                  <span className="flex min-w-0 items-center gap-2.5">
                    {/*
                      A pastilha veste o matiz da categoria — a quarta exceção
                      de cor, documentada em DESIGN.md. É esta tela que a
                      justifica: aqui a pessoa procura uma categoria entre oito,
                      e com oito ícones do mesmo cinza achar exige ler todos os
                      rótulos. Colorida, achar vira reconhecer.

                      O glifo em branco, e não o ícone colorido sobre o cinza:
                      a mancha de cor é maior e por isso mais rápida de achar
                      de canto de olho. Categoria criada pelo usuário volta ao
                      cinza — `categoryColor` devolve nulo de propósito.
                    */}
                    <span
                      style={{ backgroundColor: categoryColor(category.id) ?? undefined }}
                      className={cn(
                        'inline-flex size-8 shrink-0 items-center justify-center rounded-lg',
                        categoryColor(category.id) ? 'text-white' : 'bg-sunken text-faint',
                      )}
                    >
                      <Icon name={category.icon} size={15} />
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-[0.8125rem] font-medium text-ink">
                        {category.label}
                      </span>
                      <span className="block text-xs text-muted">
                        {spent > 0 ? (
                          <>
                            Gasto: <Money cents={spent} />
                          </>
                        ) : (
                          'Sem gasto neste mês'
                        )}
                      </span>
                    </span>
                  </span>

                  <label className="w-32 shrink-0">
                    <span className="sr-only">Limite para {category.label}</span>
                    <MoneyInput
                      defaultValue={limitCents > 0 ? toInputValue(limitCents) : ''}
                      // `onBlur` em vez de `onChange`: salvar a cada tecla
                      // gravaria "1", "12", "123" como limites intermediários.
                      onBlur={(event) => {
                        const parsed = parseDecimalInput(event.target.value)
                        setBudget(month, category.id, Number.isFinite(parsed) ? toCents(parsed) : 0)
                      }}
                    />
                  </label>
                </li>
              )
            })}
            </ul>
          </Card>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-5">
          <Card className="flex flex-1 flex-col">
            <CardHeader title="Como está indo" />

            {/*
              O anel de composição vem antes da conferência de limites, e fora
              do `if` dela de propósito: para onde o dinheiro foi não depende de
              alguém ter definido teto nenhum. Quem ainda não usa orçamento
              continua tendo a resposta mais útil da tela.

              Anel e não barra porque a pergunta aqui é parte-do-todo. Em
              "Principais categorias", no painel, a pergunta é qual pesou mais,
              e lá as barras ficam: comparar comprimento é mais fácil que
              comparar ângulo.
            */}
            {categorySpend.length > 0 ? (
              <div className="mb-6 border-b border-hairline pb-6">
                <div className="min-w-0">
                  <p className="text-2xl font-semibold tracking-[-0.02em]">
                    <Money cents={totalSpentAll} tabular={false} />
                  </p>
                  <p className="mt-1 text-xs text-muted">
                    gasto em {formatMonthLong(month).toLowerCase()}
                  </p>
                </div>

                <CategoryDonut data={categorySpend} className="mt-5" />

                {statuses.length > 0 ? (
                  <p className="mt-5 text-xs text-muted">
                    {overallRemaining >= 0 ? (
                      <>
                        Restam <Money cents={overallRemaining} emphasis="strong" /> de{' '}
                        <Money cents={totalLimit} /> em limites
                      </>
                    ) : (
                      <>
                        <Money cents={Math.abs(overallRemaining)} emphasis="strong" /> acima do
                        total de limites
                      </>
                    )}
                  </p>
                ) : null}
              </div>
            ) : null}

            {statuses.length === 0 ? (
              <p className="text-xs text-muted">
                Defina ao menos um limite ao lado para acompanhar o consumo durante o mês.
              </p>
            ) : (
              <>
                <ul className="flex flex-col gap-4">
                  {statuses.map((row) => (
                    <li key={row.categoryId}>
                      <div className="mb-1.5 flex items-baseline justify-between gap-3">
                        <span className="truncate text-[0.8125rem] font-medium text-ink">
                          {row.label}
                        </span>
                        <span className="tnum shrink-0 text-xs text-muted">{row.percent}%</span>
                      </div>
                      {/*
                        A barra diz duas coisas em canais separados: o trecho
                        cheio veste o matiz da **categoria**, para a linha ser
                        reconhecível numa lista de seis barras que antes eram
                        todas do mesmo verde; e o estouro continua na hachura,
                        que é textura e não cor. `tone` segue valendo para ela.
                      */}
                      <Progress
                        value={row.barPercent}
                        overflow={row.percent}
                        label={`${row.label}: ${row.percent}% do limite usado`}
                        tone={row.state === 'exceeded' ? 'expense' : 'income'}
                        fillColor={categoryColor(row.categoryId)}
                      />
                      <p className="mt-1 text-xs text-muted">
                        {row.remainingCents >= 0 ? (
                          <>
                            Restam <Money cents={row.remainingCents} className="text-ink" />
                          </>
                        ) : (
                          <>
                            <Money cents={Math.abs(row.remainingCents)} emphasis="strong" />{' '}
                            acima do limite
                          </>
                        )}
                      </p>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </Card>

        </div>
      </div>
    </>
  )
}
