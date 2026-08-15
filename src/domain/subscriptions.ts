import { categoryIcon } from './categories'
import type { Category, CategoryId, Transaction } from './types'
import { fromIsoDate, todayIso, type IsoDate } from '@/lib/date'
import type { Cents } from '@/lib/money'

/**
 * As assinaturas do usuário, derivadas do que já existe no histórico.
 *
 * Não há entidade "assinatura" no modelo, e não precisa haver: quando alguém
 * marca "Repetir lançamento", `expandRecurrence` materializa as N cobranças de
 * uma vez, todas com o mesmo `seriesId`. Uma assinatura é exatamente isso —
 * uma série de despesa que ainda tem cobrança pela frente. Derivar em vez de
 * cadastrar significa que nada precisa ser mantido em dois lugares, e que
 * editar ou apagar uma cobrança solta continua funcionando como sempre.
 *
 * **O modelo não separa assinatura de compra parcelada.** As duas saem do
 * mesmo campo do formulário e as duas ganham `installment`, então um sofá em
 * 12x entra nesta lista. É uma imprecisão aceita de olhos abertos: as duas são
 * compromisso que se repete e ocupa o mês que vem, que é a pergunta que o
 * painel responde. Separá-las exigiria um campo novo no lançamento, e não uma
 * heurística — adivinhar pelo nome ou pela categoria erraria calado.
 */

/** Inferida pelo espaçamento das cobranças, porque a frequência não é gravada. */
export type SubscriptionCadence = 'weekly' | 'monthly' | 'yearly'

export interface Subscription {
  seriesId: string
  label: string
  icon: string
  categoryId: CategoryId
  /** O valor da próxima cobrança, não o do cadastro: parcela é editável. */
  amountCents: Cents
  /** O mesmo valor levado a um mês, para os totais poderem somar. */
  monthlyCents: Cents
  next: IsoDate
  cadence: SubscriptionCadence
  /** Cobranças que ainda faltam, contando a próxima. */
  remaining: number
}

/** O "(3/12)" que a expansão anexa à descrição. */
const SUFIXO_DE_PARCELA = /\s*\(\d+\/\d+\)\s*$/

const DIA_EM_MS = 86_400_000

export function activeSubscriptions(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  today: IsoDate = todayIso(),
): Subscription[] {
  const series = new Map<string, Transaction[]>()

  for (const transaction of transactions) {
    if (transaction.kind !== 'expense' || !transaction.seriesId) continue
    const atual = series.get(transaction.seriesId)
    if (atual) atual.push(transaction)
    else series.set(transaction.seriesId, [transaction])
  }

  const assinaturas: Subscription[] = []

  for (const [seriesId, ocorrencias] of series) {
    // Uma ocorrência só não é série — é um lançamento avulso que carrega um
    // `seriesId` órfão porque as irmãs foram apagadas.
    if (ocorrencias.length < 2) continue

    ocorrencias.sort((a, b) => (a.date < b.date ? -1 : 1))
    const futuras = ocorrencias.filter((item) => item.date >= today)
    // Série que já terminou não é assinatura ativa, é histórico.
    if (futuras.length === 0) continue

    const proxima = futuras[0]
    const cadence = inferirCadencia(ocorrencias)

    assinaturas.push({
      seriesId,
      label: proxima.description.replace(SUFIXO_DE_PARCELA, '').trim() || 'Assinatura',
      icon: categoryIcon(categories, proxima.categoryId),
      categoryId: proxima.categoryId,
      amountCents: proxima.amountCents,
      monthlyCents: POR_MES[cadence](proxima.amountCents),
      next: proxima.date,
      cadence,
      remaining: futuras.length,
    })
  }

  // Pela mordida mensal, que é a ordem da pergunta "o que mais pesa todo mês".
  // Empate resolve pela data, para a lista não trocar de ordem sozinha.
  return assinaturas.sort(
    (a, b) => b.monthlyCents - a.monthlyCents || (a.next < b.next ? -1 : 1),
  )
}

/** O quanto as assinaturas ocupam de um mês, somadas. */
export function monthlySubscriptionCost(subscriptions: readonly Subscription[]): Cents {
  return subscriptions.reduce((soma, item) => soma + item.monthlyCents, 0)
}

/**
 * Mediana e não média: uma série mensal pula de 28 a 31 dias, e um mês de 31
 * seguido de um de 28 não pode mudar a resposta. A mediana ignora esse ruído.
 */
function inferirCadencia(ocorrencias: readonly Transaction[]): SubscriptionCadence {
  const intervalos: number[] = []

  for (let i = 1; i < ocorrencias.length; i += 1) {
    const anterior = fromIsoDate(ocorrencias[i - 1].date)
    const atual = fromIsoDate(ocorrencias[i].date)
    if (anterior && atual) {
      intervalos.push(Math.round((atual.getTime() - anterior.getTime()) / DIA_EM_MS))
    }
  }

  if (intervalos.length === 0) return 'monthly'

  intervalos.sort((a, b) => a - b)
  const mediana = intervalos[Math.floor(intervalos.length / 2)]

  // Os cortes ficam longe das três cadências reais (7, ~30 e 365), então
  // atraso de lançamento não empurra uma série para a faixa vizinha.
  if (mediana <= 11) return 'weekly'
  if (mediana >= 200) return 'yearly'
  return 'monthly'
}

const POR_MES: Record<SubscriptionCadence, (cents: Cents) => Cents> = {
  // 52 semanas em 12 meses, e não 4 por mês: quatro semanas subestimam em 8%.
  weekly: (cents) => Math.round((cents * 52) / 12),
  monthly: (cents) => cents,
  yearly: (cents) => Math.round(cents / 12),
}
