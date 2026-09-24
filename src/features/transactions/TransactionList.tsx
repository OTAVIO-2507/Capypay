import { Icon } from '@/components/Icon'
import { Badge } from '@/components/ui/Controls'
import { Money } from '@/components/ui/Money'
import { Popover } from '@/components/ui/Popover'
import { BankTag } from '@/features/dashboard/BankTag'
import type { Account, Category, Goal, Transaction } from '@/domain/types'
import { cn } from '@/lib/cn'
import { Fragment } from 'react'
import { groupByDate } from '@/domain/selectors'
import { formatDayGroup, formatFullDate, formatNumericDate, type IsoDate } from '@/lib/date'
import { CategoryPill, CategoryTile } from './CategoryMarks'
import {
  AMOUNT_CLASS,
  amountDisplay,
  presentTransaction,
  type TransactionPresentation,
} from './presentation'

interface TransactionListProps {
  transactions: Transaction[]
  categories: readonly Category[]
  goals: readonly Goal[]
  onEdit?: (transaction: Transaction) => void
  onDelete?: (transaction: Transaction) => void
  /**
   * Abre o detalhe do lançamento. Com ele, a linha inteira é clicável e a
   * descrição vira botão — é o botão que o teclado alcança, e o clique no
   * resto da linha é conveniência de mouse por cima dele.
   */
  onOpen?: (transaction: Transaction) => void
  /** Oculta a coluna de ações — usado no resumo do painel. */
  readOnly?: boolean
  /**
   * Agrupa por dia, com um cabeçalho ("Hoje", "Ontem", "ter, 15 de set") no
   * lugar da coluna de data.
   *
   * A coluna some quando o agrupamento entra, e não é economia de espaço: com
   * o dia escrito no cabeçalho do grupo, repeti-lo em cada linha é a mesma
   * informação duas vezes, e a repetição é o que faz o olho parar de lê-la.
   */
  groupByDay?: boolean
  /**
   * As contas, para a coluna "Conta". Sem elas a coluna não aparece — uma
   * coluna inteira de "—" diria que os lançamentos não têm conta, quando na
   * verdade é esta tela que não perguntou.
   */
  accounts?: readonly Account[]
}

export function TransactionList({
  transactions,
  categories,
  goals,
  onEdit,
  onDelete,
  onOpen,
  readOnly = false,
  groupByDay = false,
  accounts,
}: TransactionListProps) {
  const rows = transactions.map((transaction) => ({
    transaction,
    view: presentTransaction(transaction, categories, goals),
  }))

  // Sem agrupamento, um grupo só e sem cabeçalho — o mesmo laço desenha os dois
  // casos, em vez de duas marcações que divergem na primeira mudança.
  const grupos: { dia: IsoDate | null; linhas: typeof rows }[] = groupByDay
    ? groupByDate(transactions).map((grupo) => ({
        dia: grupo.date,
        linhas: rows.filter((row) => row.transaction.date === grupo.date),
      }))
    : [{ dia: null, linhas: rows }]

  const contaPorId = new Map((accounts ?? []).map((account) => [account.id, account]))
  const colunas = 3 + (accounts ? 1 : 0) + (groupByDay ? 0 : 1) + (readOnly ? 0 : 1)

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
        {/*
          O cabeçalho vai em caixa alta, como todo rótulo do sistema depois da
          virada de tema — mesma regra que o título de painel segue.
        */}
        <thead>
          <tr className="border-b border-hairline text-left text-sm font-medium tracking-[0.04em] text-muted uppercase">
            <th scope="col" className="pb-3">
              Descrição
            </th>
            {/*
              Categoria e conta ganham coluna própria a partir de 1024px, como
              no produto de referência. Abaixo disso a categoria volta para a
              linha de baixo da descrição, que é onde ela sempre esteve: cinco
              colunas em 700px espremeriam a descrição até ela virar reticências.
            */}
            <th scope="col" className="hidden w-64 pb-3 lg:table-cell">
              Categoria
            </th>
            {accounts ? (
              <th scope="col" className="hidden w-48 pb-3 lg:table-cell">
                Conta
              </th>
            ) : null}
            {!groupByDay ? (
              <th scope="col" className="w-32 pb-3">
                Data
              </th>
            ) : null}
            <th scope="col" className="w-40 pb-3 text-right">
              Valor
            </th>
            {!readOnly ? (
              <th scope="col" className="w-12 pb-3">
                <span className="sr-only">Ações</span>
              </th>
            ) : null}
          </tr>
        </thead>
        <tbody>
          {grupos.map((grupo) => (
            <Fragment key={grupo.dia ?? 'todos'}>
              {grupo.dia ? (
                <tr>
                  {/*
                    Cabeçalho de linha que atravessa as colunas: o leitor de
                    tela anuncia o dia antes das linhas dele, que é a mesma
                    ordem em que o olho lê.
                  */}
                  <th
                    scope="colgroup"
                    colSpan={colunas}
                    className="pt-5 pb-2 text-left text-[0.8125rem] font-medium tracking-[0.04em] text-muted uppercase first:pt-3"
                  >
                    {formatDayGroup(grupo.dia)}
                  </th>
                </tr>
              ) : null}
          {grupo.linhas.map(({ transaction, view }) => (
            <tr
              key={transaction.id}
              onClick={onOpen ? () => onOpen(transaction) : undefined}
              className={cn(
                'group border-b border-hairline last:border-0 hover:bg-sunken/70',
                onOpen && 'cursor-pointer',
              )}
            >
              {/* `max-w-0` obriga a célula a respeitar a largura da coluna em
                  vez da largura natural do texto, que é o que destrava o
                  `truncate` lá dentro. */}
              <td className="max-w-0 py-3 pr-3">
                <Identity transaction={transaction} view={view} onOpen={onOpen} />
              </td>
              <td className="hidden py-3 pr-3 lg:table-cell">
                <CategoryPill transaction={transaction} view={view} />
              </td>
              {accounts ? (
                <td className="hidden max-w-0 py-3 pr-3 lg:table-cell">
                  <AccountCell
                    account={transaction.accountId ? contaPorId.get(transaction.accountId) : undefined}
                  />
                </td>
              ) : null}
              {!groupByDay ? (
                <td className="py-3 pr-3">
                  <time
                    dateTime={transaction.date}
                    title={formatFullDate(transaction.date)}
                    className="tnum text-[0.9375rem] whitespace-nowrap text-muted"
                  >
                    {formatNumericDate(transaction.date)}
                  </time>
                </td>
              ) : null}
              <td className="py-3 text-right">
                <Amount view={view} />
              </td>
              {!readOnly ? (
                // O menu não abre o detalhe: o clique nele, e nos itens dele,
                // para aqui em vez de subir até a linha.
                <td className="py-3 pl-2 text-right" onClick={(evento) => evento.stopPropagation()}>
                  <RowMenu transaction={transaction} onEdit={onEdit} onDelete={onDelete} />
                </td>
              ) : null}
            </tr>
          ))}
            </Fragment>
          ))}
        </tbody>
      </table>

      {/* Cartões no celular: a tabela de quatro colunas não cabe em 360px. */}
      <ul className="flex flex-col gap-2 sm:hidden">
        {grupos.map((grupo) => (
          <Fragment key={grupo.dia ?? 'todos'}>
            {grupo.dia ? (
              <li className="pt-3 pb-1 text-xs font-medium tracking-[0.06em] text-muted uppercase first:pt-0">
                {formatDayGroup(grupo.dia)}
              </li>
            ) : null}
        {grupo.linhas.map(({ transaction, view }) => (
          <li
            key={transaction.id}
            onClick={onOpen ? () => onOpen(transaction) : undefined}
            className={cn(
              'flex items-center justify-between gap-3 rounded-md bg-sunken px-3.5 py-3',
              onOpen && 'cursor-pointer',
            )}
          >
            <div className="min-w-0 flex-1">
              <Identity transaction={transaction} view={view} onOpen={onOpen} />
              {!groupByDay ? (
                <time
                  dateTime={transaction.date}
                  className="tnum mt-1 block pl-12 text-xs text-muted"
                >
                  {formatNumericDate(transaction.date)}
                </time>
              ) : null}
            </div>
            <div
              className="flex shrink-0 items-center gap-1"
              onClick={(evento) => evento.stopPropagation()}
            >
              <Amount view={view} />
              {!readOnly ? (
                <RowMenu transaction={transaction} onEdit={onEdit} onDelete={onDelete} />
              ) : null}
            </div>
          </li>
        ))}
          </Fragment>
        ))}
      </ul>
    </>
  )
}

function Identity({
  transaction,
  view,
  onOpen,
}: {
  transaction: Transaction
  view: TransactionPresentation
  onOpen?: (transaction: Transaction) => void
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      {/*
        A pastilha de categoria em toda largura, como no produto de
        referência. Ela já saiu a partir de 1024px, quando a categoria ganhou
        coluna própria e o ícone aparecia duas vezes na mesma linha; voltou por
        pedido explícito, e com razão prática: é o ícone que se acha de canto
        de olho numa lista de oitenta linhas, e a pílula fica longe dele, do
        outro lado da tabela.
      */}
      <CategoryTile transaction={transaction} view={view} size={36} />
      <span className="min-w-0">
        <span className="flex items-center gap-2">
          {/* O `title` devolve o que o corte tira: descrição de extrato passa
              fácil dos quarenta caracteres, e sem isto o fim do nome do
              estabelecimento ficaria inalcançável no desktop. */}
          {onOpen ? (
            <button
              type="button"
              title={transaction.description}
              onClick={(evento) => {
                // A linha também abre o detalhe; sem isto, abriria duas vezes.
                evento.stopPropagation()
                onOpen(transaction)
              }}
              className="truncate text-left text-base font-medium text-ink hover:underline"
            >
              {transaction.description}
            </button>
          ) : (
            <span
              title={transaction.description}
              className="truncate text-base font-medium text-ink"
            >
              {transaction.description}
            </span>
          )}
          {transaction.installment ? (
            <Badge tone="quiet" className="tnum shrink-0 px-1.5 py-0 text-[10px]">
              {transaction.installment.index}/{transaction.installment.total}
            </Badge>
          ) : null}
        </span>
        {/* Some a partir de 1024px, onde a categoria tem coluna própria: a
            mesma palavra duas vezes na mesma linha é a repetição que faz o olho
            parar de ler as duas. */}
        <span className="block truncate text-[0.8125rem] text-muted lg:hidden">{view.subtitle}</span>
      </span>
    </div>
  )
}

/** O valor, escrito pela regra de `AMOUNT_CLASS`. */
function Amount({ view }: { view: TransactionPresentation }) {
  const { cents, signed } = amountDisplay(view)
  return (
    <span className="whitespace-nowrap">
      <span className="sr-only">{view.kindLabel}: </span>
      <Money cents={cents} signed={signed} className={cn('text-base font-semibold', AMOUNT_CLASS[view.tone])} />
    </span>
  )
}

/** A conta do lançamento, ou um traço quando ele não tem conta. */
function AccountCell({ account }: { account: Account | undefined }) {
  if (!account) return <span className="text-[0.9375rem] text-faint">—</span>
  return <BankTag account={account} className="text-[0.9375rem] text-ink" />
}

const MENU_ITEM_CLASS =
  'flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-[0.8125rem] font-medium ' +
  'transition-colors duration-150 hover:bg-sunken'

/**
 * As ações da linha num menu ⋮, sempre à vista.
 *
 * Já foram dois botões — lápis e lixeira — que só apareciam no hover. Isso
 * escondia a saída de quem não sabe que ela existe, e deixava a lixeira a um
 * dedo do lápis numa linha de 36px: o erro mais caro da tela ficava encostado
 * na ação mais comum. No menu, excluir é um segundo passo, separado do editar
 * por uma linha e pela cor.
 */
function RowMenu({
  transaction,
  onEdit,
  onDelete,
}: {
  transaction: Transaction
  onEdit?: (transaction: Transaction) => void
  onDelete?: (transaction: Transaction) => void
}) {
  if (!onEdit && !onDelete) return null

  return (
    <div className="flex justify-end">
      <Popover
        label={`Ações de ${transaction.description}`}
        width={184}
        trigger={({ open, toggle, controls }) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={controls}
            aria-label={`Ações de ${transaction.description}`}
            className={cn(
              'inline-flex size-9 items-center justify-center rounded-full transition-colors duration-150',
              open ? 'bg-sunken text-ink' : 'text-muted hover:bg-sunken hover:text-ink',
            )}
          >
            <Icon name="ellipsis-vertical" size={16} />
          </button>
        )}
      >
        {({ close }) => (
          <div className="p-1.5 text-left">
            {onEdit ? (
              <button
                type="button"
                onClick={() => {
                  close()
                  onEdit(transaction)
                }}
                className={cn(MENU_ITEM_CLASS, 'text-ink')}
              >
                <Icon name="square-pen" size={15} className="text-muted" />
                Editar
              </button>
            ) : null}
            {onDelete ? (
              <button
                type="button"
                onClick={() => {
                  close()
                  onDelete(transaction)
                }}
                className={cn(MENU_ITEM_CLASS, 'text-expense')}
              >
                <Icon name="trash-2" size={15} />
                Excluir
              </button>
            ) : null}
          </div>
        )}
      </Popover>
    </div>
  )
}
