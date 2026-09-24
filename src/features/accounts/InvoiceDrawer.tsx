import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { Drawer } from '@/components/ui/Drawer'
import { Money } from '@/components/ui/Money'
import { categoryColor } from '@/domain/categories'
import { invoiceTransactions, type CardSummary } from '@/domain/invoices'
import type { Category, CategoryId, Goal, Transaction } from '@/domain/types'
import type { BankBrand } from '@/features/dashboard/bankBrand'
import { CategoryTile } from '@/features/transactions/CategoryMarks'
import { presentTransaction } from '@/features/transactions/presentation'
import { formatDayMonth, todayIso } from '@/lib/date'
import { BankBadge, cardName } from './CardTile'

/**
 * Quantas linhas cada lista do painel mostra.
 *
 * O painel é uma consulta rápida, e uma fatura de cartão passa fácil das
 * quarenta compras: mostrar todas transformava o painel num extrato inteiro,
 * e a divisão por categoria — que é o que ele tem de próprio — ficava perdida
 * no alto de uma rolagem longa. O resto está a um clique, em "Ver todas".
 */
const LIMITE_DE_CATEGORIAS = 6
const LIMITE_DE_TRANSACOES = 5

/**
 * O detalhe da fatura aberta de um cartão, num painel lateral.
 *
 * Abre por cima da tela de Contas, e não numa página nova, porque é consulta:
 * a pessoa quer ver de onde saiu o número do cartão e voltar para o resto. O
 * painel diz o período que a fatura cobre, o valor, onde o dinheiro foi por
 * subcategoria, e as compras uma a uma.
 */
export function InvoiceDrawer({
  summary,
  bank,
  transactions,
  categories,
  goals,
  onClose,
}: {
  /** O cartão aberto. Nulo fecha o painel. */
  summary: CardSummary | null
  bank: BankBrand | null
  transactions: readonly Transaction[]
  categories: readonly Category[]
  goals: readonly Goal[]
  onClose: () => void
}) {
  const nome = summary ? cardName(summary.account, bank) : ''

  return (
    <Drawer open={summary !== null} onClose={onClose} label={`Fatura de ${nome}`}>
      {summary ? (
        <Conteudo
          summary={summary}
          bank={bank}
          nome={nome}
          transactions={transactions}
          categories={categories}
          goals={goals}
        />
      ) : null}
    </Drawer>
  )
}

function Conteudo({
  summary,
  bank,
  nome,
  transactions,
  categories,
  goals,
}: {
  summary: CardSummary
  bank: BankBrand | null
  nome: string
  transactions: readonly Transaction[]
  categories: readonly Category[]
  goals: readonly Goal[]
}) {
  const { account, window, invoiceCents } = summary

  const compras = useMemo(
    () =>
      invoiceTransactions(transactions, account.id, window).sort((a, b) =>
        a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1,
      ),
    [transactions, account.id, window],
  )

  // Por subcategoria, e não por grupo: dentro de uma fatura são poucas
  // compras, e "Academias" diz mais que "Saúde e bem-estar" sobre o que
  // aconteceu no cartão.
  const porCategoria = useMemo(() => {
    const totais = new Map<CategoryId, number>()
    for (const compra of compras) {
      totais.set(compra.categoryId, (totais.get(compra.categoryId) ?? 0) + compra.amountCents)
    }
    return [...totais.entries()]
      .map(([categoryId, cents]) => {
        const categoria = categories.find((item) => item.id === categoryId)
        return {
          categoryId,
          cents,
          label: categoria?.label ?? 'Sem categoria',
          icon: categoria?.icon ?? 'circle-dashed',
        }
      })
      .sort((a, b) => b.cents - a.cents)
  }, [compras, categories])

  const maior = porCategoria[0]?.cents ?? 0
  const categoriasVisiveis = porCategoria.slice(0, LIMITE_DE_CATEGORIAS)
  // A cauda vira uma linha com o total, e não some calada: a soma das linhas
  // precisa bater com o valor da fatura logo acima.
  const cauda = porCategoria.slice(LIMITE_DE_CATEGORIAS)
  const totalDaCauda = cauda.reduce((soma, item) => soma + item.cents, 0)
  const recentes = compras.slice(0, LIMITE_DE_TRANSACOES)
  const fechou = window.end < todayIso()

  return (
    <div className="flex flex-col gap-6 p-5 pt-5">
      <header className="flex items-center gap-3 border-b border-hairline pr-10 pb-5">
        <BankBadge banco={bank} nome={nome} size={52} />
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-ink">{nome}</h2>
          {window.due ? (
            <p className="mt-0.5 flex items-center gap-1.5 text-[0.8125rem] text-muted">
              <Icon name="calendar" size={14} className="shrink-0" />
              Vence em {formatDayMonth(window.due)}
            </p>
          ) : null}
        </div>
      </header>

      <p className="flex items-center gap-2 rounded-md bg-sunken px-4 py-3 text-[0.8125rem] text-muted">
        <Icon name="calendar" size={15} className="shrink-0" />
        Período de compras até{' '}
        <strong className="font-semibold text-ink">{formatDayMonth(window.end)}</strong>
      </p>

      <section className="rounded-md bg-sunken px-5 py-4">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[0.8125rem] text-muted">Valor da fatura</span>
          {/*
            O estado da fatura em palavra, e não só em cor: "Em aberto" enquanto
            ainda recebe compra, "Fechada" depois do fechamento. Âmbar para a
            aberta porque é o que ainda pode mudar.
          */}
          <span
            className={
              fechou
                ? 'inline-flex items-center gap-1 rounded-full border border-hairline-strong px-2.5 py-0.5 text-xs font-medium text-muted'
                : 'inline-flex items-center gap-1 rounded-full border border-attention/50 bg-attention/10 px-2.5 py-0.5 text-xs font-medium text-attention'
            }
          >
            <Icon name={fechou ? 'check' : 'clock'} size={12} />
            {fechou ? 'Fechada' : 'Em aberto'}
          </span>
        </div>
        <Money cents={invoiceCents} className="mt-2 block text-3xl leading-tight font-bold tracking-tight" />
      </section>

      <section aria-labelledby="fatura-categorias">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="fatura-categorias" className="text-[0.9375rem] font-medium text-muted">
            Gastos por categoria
          </h3>
          <span className="text-xs text-muted">
            {compras.length} {compras.length === 1 ? 'transação' : 'transações'}
          </span>
        </div>

        {porCategoria.length === 0 ? (
          <p className="mt-4 text-center text-[0.8125rem] text-muted">Nenhuma compra nesta fatura ainda.</p>
        ) : (
          <ul className="mt-3 flex flex-col gap-3.5">
            {categoriasVisiveis.map((item) => {
              const cor = categoryColor(item.categoryId)
              return (
                <li key={item.categoryId}>
                  <div className="flex items-center justify-between gap-3">
                    <span className="flex min-w-0 items-center gap-2.5">
                      <Icon
                        name={item.icon}
                        size={16}
                        className="shrink-0"
                        style={{ color: cor ?? 'var(--ink-secondary)' }}
                      />
                      <span title={item.label} className="truncate text-[0.9375rem] text-ink">
                        {item.label}
                      </span>
                    </span>
                    <Money cents={item.cents} className="shrink-0 text-[0.9375rem] font-semibold text-ink" />
                  </div>
                  {/* Proporção contra a maior subcategoria da fatura. */}
                  <div aria-hidden className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-sunken">
                    <div
                      className="h-full rounded-full bg-muted"
                      style={{ width: `${maior === 0 ? 0 : Math.max((item.cents / maior) * 100, 2)}%` }}
                    />
                  </div>
                </li>
              )
            })}
            {cauda.length > 0 ? (
              <li className="flex items-center justify-between gap-3 border-t border-hairline pt-3 text-[0.8125rem] text-muted">
                <span>
                  +{cauda.length} {cauda.length === 1 ? 'categoria' : 'categorias'}
                </span>
                <Money cents={totalDaCauda} className="text-[0.8125rem] font-medium text-muted" />
              </li>
            ) : null}
          </ul>
        )}
      </section>

      <section aria-labelledby="fatura-transacoes" className="pb-4">
        <div className="flex items-baseline justify-between gap-3">
          <h3 id="fatura-transacoes" className="text-[0.9375rem] font-medium text-muted">
            Transações da fatura
          </h3>
          <span className="flex items-baseline gap-3">
            {compras.length > LIMITE_DE_TRANSACOES ? (
              <span className="tnum text-xs text-muted">
                {recentes.length} de {compras.length}
              </span>
            ) : null}
            <Link
              to={`/transacoes?conta=${encodeURIComponent(account.id)}`}
              className="inline-flex items-center gap-1 text-xs font-semibold text-ink hover:underline"
            >
              Ver todas
              <Icon name="arrow-up-right" size={13} />
            </Link>
          </span>
        </div>

        <ul className="mt-2 flex flex-col">
          {recentes.map((compra) => {
            const visao = presentTransaction(compra, categories, goals)
            return (
              <li key={compra.id} className="flex items-center gap-3 py-2.5">
                <CategoryTile transaction={compra} view={visao} size={36} />
                <span className="min-w-0 flex-1">
                  <span title={compra.description} className="block truncate text-[0.9375rem] font-medium text-ink">
                    {compra.description}
                  </span>
                  <span className="block text-xs text-muted">
                    {formatDayMonth(compra.date)}
                    {compra.installment ? ` · ${compra.installment.index}/${compra.installment.total}` : ''}
                  </span>
                </span>
                <Money cents={compra.amountCents} className="shrink-0 text-[0.9375rem] font-semibold text-ink" />
              </li>
            )
          })}
        </ul>
      </section>
    </div>
  )
}
