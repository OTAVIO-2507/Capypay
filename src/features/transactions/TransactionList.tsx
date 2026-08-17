import { Icon } from '@/components/Icon'
import { categoryColor } from '@/domain/categories'
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
      {/*
        Tabela no desktop: cabeçalho de coluna e valores alinhados por casa
        decimal.

        `table-fixed` não é detalhe de estilo, é o que faz o `truncate` da
        descrição funcionar. No layout automático a coluna cresce até caber o
        texto inteiro, então uma descrição longa — que é a regra em extrato
        importado, cheio de "Compra no débito - Estabelecimento Cidade" — empurra
        a tabela para além do cartão e o valor sai pela borda. Com largura fixa,
        quem cede é a descrição, que é a única coluna que pode ser cortada sem
        perder informação: o nome continua inteiro no título e na tela estreita.
      */}
      <table className="hidden w-full table-fixed border-collapse sm:table">
        <thead>
          <tr className="border-b border-hairline text-left">
            <th scope="col" className="pb-3 text-xs font-medium text-muted">
              Descrição
            </th>
            <th scope="col" className="w-24 pb-3 text-xs font-medium text-muted">
              Data
            </th>
            <th scope="col" className="w-36 pb-3 text-right text-xs font-medium text-muted">
              Valor
            </th>
            {!readOnly ? (
              <th scope="col" className="w-16 pb-3">
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
              {/* `max-w-0` obriga a célula a respeitar a largura da coluna em
                  vez da largura natural do texto, que é o que destrava o
                  `truncate` lá dentro. */}
              <td className="max-w-0 py-3 pr-3">
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
      {/*
        A mesma pastilha colorida do Orçamento, para a categoria ser a mesma
        coisa nas duas telas — reconhecer "o laranja" ali e aqui só funciona se
        a marca for idêntica, e não uma versão reduzida dela.

        O quadro cinza continua para o que não tem matiz: receita, aporte e
        categoria criada pelo usuário. Nesses casos ele volta a ser a forma que
        codifica o tipo — contorno para entrada, tracejado para aporte.

        Na despesa colorida essa leitura sai do quadro, e isso é aceito com
        conta feita: o tipo continua dito pela seta antes do valor, pelo sinal
        `+`/`−` e pelo peso da tinta. Eram quatro leituras e ficam três, todas
        independentes de matiz. A quarta era a mais fraca das quatro, e é a
        única que a cor de categoria pode ocupar sem apagar nada.
      */}
      <span
        style={{ backgroundColor: categoryColor(transaction.categoryId) ?? undefined }}
        className={cn(
          'inline-flex size-9 shrink-0 items-center justify-center rounded-lg',
          categoryColor(transaction.categoryId) ? 'text-white' : FRAME_CLASS[view.frame],
        )}
      >
        <Icon name={view.icon} size={15} />
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          {/* O `title` devolve o que o corte tira: descrição de extrato passa
              fácil dos quarenta caracteres, e sem isto o fim do nome do
              estabelecimento ficaria inalcançável no desktop. */}
          <span
            title={transaction.description}
            className="truncate text-[0.8125rem] font-medium text-ink"
          >
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
