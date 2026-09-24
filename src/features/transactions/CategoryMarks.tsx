import { Icon } from '@/components/Icon'
import { categoryColor } from '@/domain/categories'
import type { Transaction } from '@/domain/types'
import { cn } from '@/lib/cn'
import type { TransactionPresentation } from './presentation'

/**
 * A pastilha e a pílula de categoria de um lançamento, as mesmas na tabela de
 * Transações e no detalhe que abre dela. Reconhecer "o laranja" num lugar e no
 * outro só funciona se a marca for idêntica, e não uma versão de cada tela.
 */

const FRAME_CLASS: Record<TransactionPresentation['frame'], string> = {
  outline: 'border border-ink text-ink',
  fill: 'bg-sunken text-faint',
  dashed: 'border border-dashed border-hairline-strong text-muted',
}

/**
 * A pastilha: a cor do grupo tingida a 16% no fundo e cheia no ícone, como
 * na tela de Categorias e no produto de referência.
 *
 * O quadro sem cor continua para o que não tem matiz — receita, aporte,
 * grupo fora da paleta — e ali ele volta a ser a forma que codifica o tipo:
 * contorno para entrada, tracejado para aporte, preenchido para saída. É uma
 * das leituras do tipo que não dependem de matiz, ao lado da seta e do sinal.
 */
export function CategoryTile({
  transaction,
  view,
  size = 32,
  className,
}: {
  transaction: Transaction
  view: TransactionPresentation
  size?: number
  className?: string
}) {
  const cor = categoryColor(transaction.categoryId)

  return (
    <span
      aria-hidden
      style={{
        width: size,
        height: size,
        ...(cor ? { color: cor, backgroundColor: `color-mix(in srgb, ${cor} 16%, transparent)` } : {}),
      }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md',
        !cor && FRAME_CLASS[view.frame],
        className,
      )}
    >
      <Icon name={view.icon} size={Math.round(size * 0.44)} />
    </span>
  )
}

/**
 * A categoria como pílula tingida: a cor dela a 15% no fundo, e cheia no texto.
 *
 * Tingida, e não sólida, pelo mesmo motivo do distintivo de variação: numa
 * coluna inteira de pílulas sólidas, a tabela vira um mosaico e o valor — que
 * é o que a linha existe para mostrar — perde a disputa. Tingida, ela identifica
 * sem gritar.
 *
 * Categoria sem matiz (ou um aporte, que mostra a meta) cai na pílula neutra.
 * A cor nunca é a única leitura: o nome está escrito.
 */
export function CategoryPill({
  transaction,
  view,
  className,
}: {
  transaction: Transaction
  view: TransactionPresentation
  className?: string
}) {
  const cor = categoryColor(transaction.categoryId)

  return (
    <span
      style={
        cor ? { color: cor, backgroundColor: `color-mix(in srgb, ${cor} 15%, transparent)` } : undefined
      }
      className={cn(
        'inline-flex max-w-full items-center gap-1.5 rounded-full px-3 py-1 text-[0.8125rem] font-medium',
        !cor && 'bg-sunken text-muted',
        className,
      )}
    >
      <Icon name={view.icon} size={13} className="shrink-0" />
      <span className="truncate">{view.subtitle}</span>
    </span>
  )
}
