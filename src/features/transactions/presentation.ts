import type { IconName } from '@/components/Icon'
import { categoryIcon, categoryLabel } from '@/domain/categories'
import type { Category, Goal, Transaction, TransactionKind } from '@/domain/types'

export interface TransactionPresentation {
  icon: IconName | string
  /** Linha secundária: categoria, ou o nome da meta quando é aporte. */
  subtitle: string
  emphasis: 'plain' | 'strong' | 'muted'
  /**
   * Tratamento do contêiner do ícone. A diferença entre entrada e saída
   * também passa pela forma, e não só pela cor: entrada vem contornada,
   * saída vem preenchida em superfície rebaixada, aporte vem tracejada —
   * sobrevive à impressão em preto e branco tanto quanto ao daltonismo.
   */
  frame: 'outline' | 'fill' | 'dashed'
  /**
   * Seta que precede o valor. Entrada sobe, saída desce, aporte segue para o
   * lado — a direção do dinheiro dita em forma, e não só em cor.
   */
  direction: IconName
  /** Cor da seta e do aro do ícone — ver `tone` em `TooltipRow`. */
  tone: TransactionKind
  /** Valor já com sinal aplicado. */
  signedCents: number
  /** Texto lido por leitor de tela no lugar do sinal gráfico. */
  kindLabel: string
}

/**
 * Traduz um lançamento para o vocabulário visual.
 *
 * Receita e despesa vestem a identidade de fluxo — verde e terracota, e não
 * verde-e-vermelho de semáforo — mas a cor nunca é a única leitura: o sinal
 * `+`/`−` antes do número, o peso da tinta e o contorno do ícone continuam
 * lá, redundantes de propósito. Qualquer um dos quatro sozinho já bastaria; é
 * o conjunto que sobrevive à impressão em preto e branco e a qualquer tipo
 * de daltonismo — a cor é o quinto sinal, o único que pode faltar sem que a
 * leitura se perca.
 */
export function presentTransaction(
  transaction: Transaction,
  categories: readonly Category[],
  goals: readonly Goal[],
): TransactionPresentation {
  if (transaction.kind === 'contribution') {
    const goal = goals.find((item) => item.id === transaction.goalId)
    return {
      icon: goal?.icon ?? 'target',
      subtitle: goal ? `Meta: ${goal.name}` : 'Meta removida',
      emphasis: 'muted',
      frame: 'dashed',
      direction: 'arrow-right',
      tone: 'contribution',
      signedCents: -transaction.amountCents,
      kindLabel: 'Aporte em meta',
    }
  }

  const subtitle = categoryLabel(categories, transaction.categoryId)
  const icon = categoryIcon(categories, transaction.categoryId)

  if (transaction.kind === 'income') {
    return {
      icon,
      subtitle,
      emphasis: 'strong',
      frame: 'outline',
      direction: 'arrow-up-right',
      tone: 'income',
      signedCents: transaction.amountCents,
      kindLabel: 'Receita',
    }
  }

  return {
    icon,
    subtitle,
    emphasis: 'plain',
    frame: 'fill',
    direction: 'arrow-down-right',
    tone: 'expense',
    signedCents: -transaction.amountCents,
    kindLabel: 'Despesa',
  }
}

/**
 * Como o valor de um lançamento é escrito, na tabela e no detalhe.
 *
 * Como no produto de referência: despesa sai sem sinal e na tinta do texto,
 * receita sai com "+" e em verde, aporte sai sem sinal na cor dele. A despesa
 * é o caso comum de uma lista de extrato — quatro de cada cinco linhas —, e um
 * "−" e uma seta em cada uma delas eram ruído repetido; o que se procura de
 * relance é a exceção, e a exceção é o que entra.
 *
 * Isto substitui a Regra das Quatro Leituras (seta, sinal, peso e cor em toda
 * linha), por pedido explícito. A distinção entre entrada e saída continua sem
 * depender só de matiz: o "+" está escrito, e o leitor de tela ouve o tipo
 * antes do número. Aporte se distingue pela pílula "Meta:" e pela pastilha
 * tracejada ao lado.
 */
export const AMOUNT_CLASS: Record<TransactionKind, string> = {
  income: 'text-income',
  expense: 'text-ink',
  contribution: 'text-contribution',
}

/** O valor sem sinal, e se ele leva "+". Ver `AMOUNT_CLASS`. */
export function amountDisplay(view: TransactionPresentation): { cents: number; signed: boolean } {
  return { cents: Math.abs(view.signedCents), signed: view.tone === 'income' }
}

/**
 * O sinal do valor no detalhe de um lançamento: os dois sentidos levam sinal,
 * separado do valor por um espaço, como na referência — "− R$ 580,00" e
 * "+ R$ 0,06".
 *
 * Na tabela a despesa vai sem sinal (ver `AMOUNT_CLASS`) porque a coluna
 * inteira ao redor já diz que o normal é saída. No detalhe o valor está
 * sozinho, sem essa coluna, e o sinal volta a ser informação. Aporte leva o
 * "−": é dinheiro que sai da conta para a meta.
 */
export function detailSign(view: TransactionPresentation): '+' | '−' | '' {
  if (view.signedCents === 0) return ''
  return view.tone === 'income' ? '+' : '−'
}
