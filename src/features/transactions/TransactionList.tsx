import { Icon } from '@/components/Icon'
import { Badge } from '@/components/ui/Controls'
import { FLOW_TEXT_CLASS, Money } from '@/components/ui/Money'
import type { Category, Goal, Transaction } from '@/domain/types'
import { cn } from '@/lib/cn'
import { formatDayMonth, formatFullDate } from '@/lib/date'
import { presentTransaction, type TransactionPresentation } from './presentation'

interface TransactionListProps {
  transactions: Transaction[]
  categories: readonly Category[]
  goals: readonly Goal[]
  onEdit?: (transaction: Transaction) => void
  onDelete?: (transaction: Transaction) => void
  /** Oculta a coluna de ações — usado no resumo do painel. */
  readOnly?: boolean
}

const FRAME_CLASS: Record<TransactionPresentation['frame'], string> = {
  outline: 'border border-ink text-ink',
  fill: 'bg-sunken text-faint',
  dashed: 'border border-dashed border-hairline-strong text-muted',
}

export function TransactionList({
  transactions,
  categories,
  goals,
  onEdit,
  onDelete,
  readOnly = false,
}: TransactionListProps) {
  const rows = transactions.map((transaction) => ({
    transaction,
    view: presentTransaction(transaction, categories, goals),
  }))

  return (
    <>
      {/* Tabela no desktop: cabeçalho de coluna e valores alinhados por casa decimal. */}
      <table className="hidden w-full border-collapse sm:table">
        <thead>
          <tr className="border-b border-hairline text-left">
            <th scope="col" className="pb-3 text-xs font-medium text-muted">
              Descrição
            </th>
            <th scope="col" className="pb-3 text-xs font-medium text-muted">
              Data
            </th>
            <th scope="col" className="pb-3 text-right text-xs font-medium text-muted">
              Valor
            </th>
            {!readOnly ? (
              <th scope="col" className="pb-3">
                <span className="sr-only">Ações</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {rows.map(({ transaction, view }) => (
            <tr
              key={transaction.id}
              className="group border-b border-hairline last:border-0 hover:bg-sunken/70"
            >
              <td className="py-3 pr-3">
                <Identity transaction={transaction} view={view} />
              </td>
              <td className="py-3 pr-3">
                <time
                  dateTime={transaction.date}
                  title={formatFullDate(transaction.date)}
                  className="tnum text-xs whitespace-nowrap text-muted"
                >
                  {formatDayMonth(transaction.date)}
                </time>
              </td>
              <td className="py-3 text-right">
                <Amount view={view} />
              </td>
              {!readOnly ? (
                <td className="py-3 pl-2">
                  <RowActions
                    transaction={transaction}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    className="opacity-0 transition-opacity duration-150 group-hover:opacity-100 group-focus-within:opacity-100"
                  />
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>

      {/* Cartões no celular: a tabela de quatro colunas não cabe em 360px. */}
      <ul className="flex flex-col gap-2 sm:hidden">
        {rows.map(({ transaction, view }) => (
          <li
            key={transaction.id}
            className="flex items-center justify-between gap-3 rounded-md bg-sunken px-3.5 py-3"
          >
            <div className="min-w-0 flex-1">
              <Identity transaction={transaction} view={view} />
              <time
                dateTime={transaction.date}
                className="tnum mt-1 block pl-[42px] text-xs text-muted"
              >
                {formatDayMonth(transaction.date)}
              </time>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Amount view={view} />
              {!readOnly ? (
                <RowActions transaction={transaction} onEdit={onEdit} onDelete={onDelete} />
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </>
  )
}

function Identity({
  transaction,
  view,
}: {
  transaction: Transaction
  view: TransactionPresentation
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <span
        className={cn(
          'inline-flex size-9 shrink-0 items-center justify-center rounded-sm',
          FRAME_CLASS[view.frame],
        )}
      >
        <Icon name={view.icon} size={15} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          <span className="truncate text-[0.8125rem] font-medium text-ink">
            {transaction.description}
          </span>
          {transaction.installment ? (
            <Badge tone="quiet" className="tnum shrink-0 px-1.5 py-0 text-[10px]">
              {transaction.installment.index}/{transaction.installment.total}
            </Badge>
          ) : null}
        </span>
        <span className="block truncate text-xs text-muted">{view.subtitle}</span>
      </span>
    </div>
  )
}

/**
 * O valor, com a direção do dinheiro à frente.
 *
 * A seta é o recurso que extrato de banco usa há décadas, e resolve aqui o que
 * a cor resolveria em outro sistema: entrada sobe, saída desce, aporte segue
 * para o lado. Somada ao sinal `+`/`−` e ao peso da tinta, dá três leituras
 * independentes da mesma informação, sem depender de matiz — o que mantém a
 * tela legível impressa e para qualquer tipo de daltonismo. A cor da seta é
 * um quarto sinal, não o primeiro: confirma o que as outras três já disseram.
 */
function Amount({ view }: { view: TransactionPresentation }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
      <span className="sr-only">{view.kindLabel}:</span>
      <Icon
        name={view.direction}
        size={13}
        strokeWidth={2.25}
        className={FLOW_TEXT_CLASS[view.tone]}
      />
      <Money
        cents={view.signedCents}
        emphasis={view.emphasis}
        signed
        className="text-[0.8125rem]"
      />
    </span>
  )
}

function RowActions({
  transaction,
  onEdit,
  onDelete,
  className,
}: {
  transaction: Transaction
  onEdit?: (transaction: Transaction) => void
  onDelete?: (transaction: Transaction) => void
  className?: string
}) {
  return (
    <div className={cn('flex items-center justify-end gap-0.5', className)}>
      {onEdit ? (
        <button
          type="button"
          onClick={() => onEdit(transaction)}
          aria-label={`Editar ${transaction.description}`}
          className="inline-flex size-9 items-center justify-center rounded-sm text-faint transition-colors duration-150 hover:bg-hairline hover:text-ink"
        >
          <Icon name="square-pen" size={15} />
        </button>
      ) : null}
      {onDelete ? (
        <button
          type="button"
          onClick={() => onDelete(transaction)}
          aria-label={`Excluir ${transaction.description}`}
          className="inline-flex size-9 items-center justify-center rounded-sm text-faint transition-colors duration-150 hover:bg-hairline hover:text-ink"
        >
          <Icon name="trash-2" size={15} />
        </button>
      ) : null}
    </div>
  )
}
