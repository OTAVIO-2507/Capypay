import { useMemo, type ReactNode } from 'react'
import { Icon, type IconName } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import type { Account, Category, Goal, Transaction } from '@/domain/types'
import { similarTransactions } from '@/domain/selectors'
import { BankTag } from '@/features/dashboard/BankTag'
import { BrandMark, findBrand } from '@/features/series/BrandMark'
import { formatDayMonthYear, formatNumericDate } from '@/lib/date'
import { CategoryPill, CategoryTile } from './CategoryMarks'
import { SignedAmount, TransactionMiniRow } from './TransactionMiniRow'
import { presentTransaction, type TransactionPresentation } from './presentation'

interface TransactionDetailsProps {
  /** O lançamento aberto. Nulo fecha o detalhe. */
  transaction: Transaction | null
  /** O histórico inteiro, de onde saem as semelhantes. */
  transactions: readonly Transaction[]
  categories: readonly Category[]
  goals: readonly Goal[]
  accounts: readonly Account[]
  onClose: () => void
  onEdit: (transaction: Transaction) => void
  /** Troca o detalhe aberto por outro — o clique numa semelhante. */
  onOpen: (transaction: Transaction) => void
}

/**
 * O detalhe de um lançamento: o que ele é, de onde saiu, e onde mais ele
 * aparece.
 *
 * A tabela mostra seis campos por linha, e a descrição de extrato — que passa
 * fácil dos sessenta caracteres — sai cortada nela. Aqui ela cabe inteira, com
 * o valor em destaque, e o resto em linhas de rótulo e valor.
 *
 * As semelhantes são a parte que a tabela não tem como dar: outros lançamentos
 * do mesmo estabelecimento, que respondem "isto é recorrente?" e "quanto eu
 * costumo gastar aqui?" sem filtro nenhum. Clicar numa delas abre o detalhe
 * dela no lugar, para seguir o fio sem voltar à tabela.
 */
export function TransactionDetails({
  transaction,
  transactions,
  categories,
  goals,
  accounts,
  onClose,
  onEdit,
  onOpen,
}: TransactionDetailsProps) {
  const semelhantes = useMemo(
    () => (transaction ? similarTransactions(transaction, transactions) : []),
    [transaction, transactions],
  )

  const view = transaction ? presentTransaction(transaction, categories, goals) : null
  const conta = transaction?.accountId
    ? accounts.find((item) => item.id === transaction.accountId)
    : undefined

  return (
    <Dialog
      open={transaction !== null}
      onClose={onClose}
      /*
       * Larga, como na referência. Descrição de extrato passa fácil dos
       * quarenta caracteres — do tipo "COMPRA NO DEBITO - ESTABELECIMENTO
       * CIDADE BRA" — e numa janela estreita ela quebra em duas linhas e
       * empurra o valor para baixo. Este é o único lugar do produto onde ela
       * aparece inteira; a largura é o que torna isso verdade.
       */
      size="lg"
      title="Detalhes da transação"
      initialFocus="dialog"
      headerAction={
        transaction ? (
          <Button size="sm" variant="ghost" icon="square-pen" onClick={() => onEdit(transaction)}>
            Editar
          </Button>
        ) : null
      }
    >
      {transaction && view ? (
        <div className="flex flex-col gap-6">
          <div className="flex items-start gap-4">
            <MarcaDoDetalhe transaction={transaction} view={view} />
            <div className="min-w-0">
              {/* Inteira, e não cortada: é o único lugar do produto onde a
                  descrição do extrato aparece sem reticências. */}
              <p className="text-xl leading-snug font-semibold break-words text-ink">
                {transaction.description}
              </p>
              <p className="mt-1.5 text-[1.75rem] leading-tight font-bold">
                <span className="sr-only">{view.kindLabel}: </span>
                <SignedAmount view={view} />
              </p>
            </div>
          </div>

          <dl className="flex flex-col gap-3.5 text-[0.8125rem]">
            <Linha icone="calendar" rotulo="Data">
              <time dateTime={transaction.date}>{formatNumericDate(transaction.date)}</time>
            </Linha>
            {conta ? (
              <Linha icone="credit-card" rotulo="Conta">
                <BankTag account={conta} className="justify-end" />
              </Linha>
            ) : null}
            <Linha icone="tags" rotulo={transaction.kind === 'contribution' ? 'Meta' : 'Categoria'}>
              <CategoryPill transaction={transaction} view={view} />
            </Linha>
            {transaction.installment ? (
              <Linha icone="credit-card" rotulo="Parcela">
                <span className="tnum">
                  {transaction.installment.index} de {transaction.installment.total}
                </span>
              </Linha>
            ) : null}
            {transaction.notes ? (
              <Linha icone="square-pen" rotulo="Observação">
                <span className="text-right break-words">{transaction.notes}</span>
              </Linha>
            ) : null}
          </dl>

          <section aria-labelledby={`semelhantes-${transaction.id}`}>
            <h3
              id={`semelhantes-${transaction.id}`}
              className="flex items-center gap-2 text-sm font-semibold text-ink"
            >
              <Icon name="repeat" size={15} className="text-muted" />
              Transações semelhantes
            </h3>
            {semelhantes.length === 0 ? (
              /* A seção fica mesmo vazia, como na referência: "nenhuma" também
                 é resposta — diz que a compra é avulsa, e não que o produto
                 esqueceu de procurar. */
              <p className="mt-3 py-4 text-center text-[0.8125rem] text-muted">
                Nenhuma transação semelhante encontrada
              </p>
            ) : (
              <ul className="mt-3 flex flex-col gap-2">
                {semelhantes.map((outra) => (
                  <li key={outra.id}>
                    <TransactionMiniRow
                      transaction={outra}
                      categories={categories}
                      goals={goals}
                      legenda={`${formatDayMonthYear(outra.date)} · ${
                        presentTransaction(outra, categories, goals).subtitle
                      }`}
                      onOpen={onOpen}
                    />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </Dialog>
  )
}

function Linha({ icone, rotulo, children }: { icone: IconName; rotulo: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="flex shrink-0 items-center gap-2.5 text-muted">
        <Icon name={icone} size={16} className="shrink-0" />
        {rotulo}:
      </dt>
      <dd className="flex min-w-0 justify-end text-ink">{children}</dd>
    </div>
  )
}

/**
 * A marca do detalhe: a arte do serviço quando ele é conhecido, e a pastilha
 * da categoria quando não é.
 *
 * Só aqui, e não nas linhas de baixo. No cabeçalho a marca é leitura
 * principal — reconhecer o quadrado vermelho da Netflix é mais rápido que
 * ler a linha crua que o banco escreveu — e ela tem 56px para ser
 * reconhecida. Numa pastilha de 36px a arte vira uma mancha, e ali a cor da
 * categoria diz mais: é a mesma marca da linha que a pessoa clicou para
 * chegar aqui, o que mantém as duas telas contando a mesma história.
 */
function MarcaDoDetalhe({
  transaction,
  view,
}: {
  transaction: Transaction
  view: TransactionPresentation
}) {
  if (findBrand(transaction.description)) {
    return (
      <BrandMark
        label={transaction.description}
        fallbackIcon={view.icon}
        size={56}
        className="rounded-lg"
      />
    )
  }

  return <CategoryTile transaction={transaction} view={view} size={56} className="rounded-lg" />
}
