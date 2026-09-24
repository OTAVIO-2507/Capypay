import type { ReactNode } from 'react'
import { Money } from '@/components/ui/Money'
import type { Category, Goal, Transaction } from '@/domain/types'
import { cn } from '@/lib/cn'
import { usePrivacy } from '@/store/hooks'
import { CategoryTile } from './CategoryMarks'
import {
  AMOUNT_CLASS,
  detailSign,
  presentTransaction,
  type TransactionPresentation,
} from './presentation'

/**
 * A linha curta de lançamento — a que aparece **dentro** de uma janela, e não
 * na tabela da tela de Transações.
 *
 * Existe porque a tabela não cabe aqui. Ela tem cinco colunas de largura fixa,
 * e num diálogo de 448px a descrição some e o valor sai pela borda. Esta linha
 * é a mesma informação em pilha: a pastilha da categoria, o nome, uma legenda
 * embaixo e o valor à direita.
 *
 * As duas listas que a usam fazem a mesma coisa com ela — as semelhantes de um
 * lançamento e as despesas de um dia do mapa de calor —, e é por isso que ela
 * é um componente e não duas marcações parecidas: a primeira correção aplicada
 * só num dos lados já abriria a distância entre elas.
 */
export function TransactionMiniRow({
  transaction,
  categories,
  goals,
  /** A linha de baixo: a categoria, ou a data mais a categoria. */
  legenda,
  onOpen,
}: {
  transaction: Transaction
  categories: readonly Category[]
  goals: readonly Goal[]
  legenda: ReactNode
  /** Abre o detalhe. Sem ele a linha é leitura, e não um botão morto. */
  onOpen?: (transaction: Transaction) => void
}) {
  const view = presentTransaction(transaction, categories, goals)

  const conteudo = (
    <>
      <CategoryTile transaction={transaction} view={view} size={36} />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[0.8125rem] font-medium text-ink">
          {transaction.description}
        </span>
        <span className="block truncate text-xs text-muted">{legenda}</span>
      </span>
      <SignedAmount view={view} className="shrink-0 text-[0.8125rem] font-semibold" />
    </>
  )

  const classe = 'flex w-full items-center gap-3 rounded-md bg-sunken px-4 py-3 text-left'

  if (!onOpen) return <div className={classe}>{conteudo}</div>

  return (
    <button
      type="button"
      onClick={() => onOpen(transaction)}
      className={cn(classe, 'transition-colors duration-150 hover:bg-hairline')}
    >
      {conteudo}
    </button>
  )
}

/**
 * O valor com o sinal do detalhe, separado por um espaço. Ver `detailSign`.
 *
 * No modo de privacidade o sinal some junto com o número, pela mesma regra
 * do `Money`: "− R$ •••" ainda contaria o sentido de um valor que a pessoa
 * pediu para esconder.
 */
export function SignedAmount({
  view,
  className,
}: {
  view: TransactionPresentation
  className?: string
}) {
  const masked = usePrivacy()
  const sinal = masked ? '' : detailSign(view)

  return (
    <span className={cn('whitespace-nowrap', AMOUNT_CLASS[view.tone], className)}>
      {sinal ? `${sinal} ` : null}
      <Money cents={Math.abs(view.signedCents)} className={AMOUNT_CLASS[view.tone]} />
    </span>
  )
}
