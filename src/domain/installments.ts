import { categoryIcon } from './categories'
import type { Category, CategoryId, Transaction } from './types'
import { todayIso, type IsoDate } from '@/lib/date'
import type { Cents } from '@/lib/money'

/**
 * As compras parceladas, derivadas das séries do histórico.
 *
 * A pergunta aqui é outra que a das assinaturas. Uma compra parcelada tem
 * total fechado — foi decidido na hora da compra — e o que interessa é quanto
 * já foi pago e quanto ainda falta. Uma assinatura não tem total, e o que
 * interessa é quanto ela ocupa por mês. Por isso são dois módulos e duas
 * páginas, e não uma lista com um filtro: os números que cada uma soma não
 * são os mesmos.
 *
 * "Paga" aqui quer dizer "com data até hoje". O produto não registra
 * pagamento, registra lançamento — a parcela existir com data passada é toda
 * a evidência que existe, e é a mesma que o saldo já usa.
 */

export interface Installment {
  seriesId: string
  label: string
  icon: string
  categoryId: CategoryId
  /** Quanto a compra custa somando todas as parcelas. */
  totalCents: Cents
  paidCents: Cents
  remainingCents: Cents
  /** Valor de uma parcela, pela próxima em aberto ou pela última paga. */
  installmentCents: Cents
  paidCount: number
  totalCount: number
  /** De 0 a 1, pelo valor pago e não pela contagem: parcelas variam. */
  progress: number
  /** Data da próxima parcela em aberto; nula quando a compra terminou. */
  next: IsoDate | null
  /** Data da última parcela da série, paga ou não. */
  lastDate: IsoDate
  done: boolean
}

const SUFIXO_DE_PARCELA = /\s*\(\d+\/\d+\)\s*$/

export function installmentPurchases(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  today: IsoDate = todayIso(),
): Installment[] {
  const series = new Map<string, Transaction[]>()

  for (const transaction of transactions) {
    if (transaction.kind !== 'expense') continue
    if (!transaction.seriesId || transaction.seriesKind !== 'installment') continue
    const atual = series.get(transaction.seriesId)
    if (atual) atual.push(transaction)
    else series.set(transaction.seriesId, [transaction])
  }

  const compras: Installment[] = []

  for (const [seriesId, parcelas] of series) {
    if (parcelas.length < 2) continue

    parcelas.sort((a, b) => (a.date < b.date ? -1 : 1))
    const pagas = parcelas.filter((item) => item.date <= today)
    const abertas = parcelas.filter((item) => item.date > today)

    const totalCents = parcelas.reduce((soma, item) => soma + item.amountCents, 0)
    const paidCents = pagas.reduce((soma, item) => soma + item.amountCents, 0)
    const referencia = abertas[0] ?? pagas[pagas.length - 1] ?? parcelas[0]

    compras.push({
      seriesId,
      label: referencia.description.replace(SUFIXO_DE_PARCELA, '').trim() || 'Compra parcelada',
      icon: categoryIcon(categories, referencia.categoryId),
      categoryId: referencia.categoryId,
      totalCents,
      paidCents,
      remainingCents: totalCents - paidCents,
      installmentCents: referencia.amountCents,
      paidCount: pagas.length,
      totalCount: parcelas.length,
      progress: totalCents === 0 ? 0 : paidCents / totalCents,
      next: abertas[0]?.date ?? null,
      lastDate: parcelas[parcelas.length - 1].date,
      done: abertas.length === 0,
    })
  }

  // As em andamento primeiro, pelo que ainda falta; as terminadas depois, da
  // mais recente para a mais antiga. Quem abre a página quer ver o que pesa no
  // mês que vem, não o que já saiu da vida.
  return compras.sort((a, b) => {
    if (a.done !== b.done) return a.done ? 1 : -1
    if (a.done) return a.lastDate < b.lastDate ? 1 : -1
    return b.remainingCents - a.remainingCents
  })
}

export interface InstallmentSummary {
  ongoing: number
  totalCents: Cents
  paidCents: Cents
  remainingCents: Cents
  progress: number
  /** O mês em que a última parcela em aberto cai. Nulo se não há nenhuma. */
  lastMonth: IsoDate | null
}

/** Os totais do topo da página, contando **só** o que ainda está em andamento. */
export function installmentSummary(purchases: readonly Installment[]): InstallmentSummary {
  const emAndamento = purchases.filter((item) => !item.done)

  const totalCents = emAndamento.reduce((soma, item) => soma + item.totalCents, 0)
  const paidCents = emAndamento.reduce((soma, item) => soma + item.paidCents, 0)

  // A última parcela de todas, que é quando a pessoa volta a ter o mês livre.
  const lastMonth = emAndamento.reduce<IsoDate | null>(
    (maior, item) => (maior === null || item.lastDate > maior ? item.lastDate : maior),
    null,
  )

  return {
    ongoing: emAndamento.length,
    totalCents,
    paidCents,
    remainingCents: totalCents - paidCents,
    progress: totalCents === 0 ? 0 : paidCents / totalCents,
    lastMonth,
  }
}
