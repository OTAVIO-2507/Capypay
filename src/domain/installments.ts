import { categoryIcon, categoryLabel } from './categories'
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

/** Uma parcela da compra, como ela aparece na lista aberta. */
export interface InstallmentParcel {
  /** Id do lançamento, para a lista ter chave estável. */
  id: string
  /** Posição na compra, começando em 1. */
  index: number
  date: IsoDate
  amountCents: Cents
  /** "Paga" aqui é "com data até hoje" — ver o cabeçalho deste módulo. */
  paid: boolean
}

export interface Installment {
  seriesId: string
  label: string
  icon: string
  categoryId: CategoryId
  /** O nome da categoria, para a compra aberta poder dizer de que ela é. */
  categoryName: string
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
  /**
   * As parcelas, em ordem de data.
   *
   * Os agregados acima respondem "quanto falta"; esta lista responde "quando
   * e quanto", que é a pergunta de quem quer conferir uma cobrança contra o
   * extrato do cartão. O valor vem de cada lançamento, e não do total dividido
   * pelo número de parcelas: parcela é editável, e a primeira costuma diferir
   * das outras por causa de entrada ou arredondamento.
   */
  parcels: InstallmentParcel[]
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
    parcelas.sort((a, b) => (a.date < b.date ? -1 : 1))

    /*
     * O total declarado pelo banco, quando existe.
     *
     * Uma compra parcelada cadastrada aqui nasce com todas as parcelas, e
     * contá-las responde certo. Uma compra que veio de extrato traz só as que
     * caíram no período importado: "3/10" pode chegar sozinha, e contar as
     * presentes diria "1 de 1" sobre uma dívida de dez vezes. O número que o
     * banco carimbou vale mais que a contagem do que temos em mãos.
     */
    const declarado = parcelas.reduce<number>(
      (maior, item) => Math.max(maior, item.installment?.total ?? 0),
      0,
    )

    // Uma parcela solta só é série quando o banco declarou que há mais. Sem
    // declaração, é um lançamento avulso com `seriesId` órfão.
    if (parcelas.length < 2 && declarado < 2) continue

    const totalCount = Math.max(declarado, parcelas.length)

    const pagas = parcelas.filter((item) => item.date <= today)
    const abertas = parcelas.filter((item) => item.date > today)
    const referencia = abertas[0] ?? pagas[pagas.length - 1] ?? parcelas[0]

    /*
     * Com parcelas ausentes, os totais vêm do valor da parcela vezes a
     * contagem, e não da soma do que está em mãos.
     *
     * Somar só o importado responderia "você deve R$ 1.249" numa compra de dez
     * vezes de que só três chegaram — um terço da dívida, apresentado como a
     * dívida inteira, na tela que existe para responder quanto falta.
     *
     * **Só vale para série importada**, e é aí que `source` ganha o uso para o
     * qual foi criado. Faltar parcela tem duas causas opostas: numa compra
     * cadastrada aqui, todas nasceram juntas, então uma ausência é uma exclusão
     * deliberada e a lista deve fechar o buraco. Numa compra vinda de extrato,
     * a ausência é só o começo do período importado, e a parcela existe na vida
     * real. Tratar as duas igual apagaria a intenção de quem excluiu, ou
     * inventaria dívida para quem não tem.
     */
    const importada = parcelas.some((item) => item.source === 'imported')
    const faltando = importada && totalCount > parcelas.length
    const valorDaParcela = referencia.amountCents

    const totalCents = faltando
      ? valorDaParcela * totalCount
      : parcelas.reduce((soma, item) => soma + item.amountCents, 0)

    // Quantas já venceram: pela posição declarada da última paga, que sabe das
    // parcelas anteriores ao período importado.
    const pagasCount = faltando
      ? Math.max(pagas.length, pagas[pagas.length - 1]?.installment?.index ?? 0)
      : pagas.length

    const paidCents = faltando
      ? valorDaParcela * pagasCount
      : pagas.reduce((soma, item) => soma + item.amountCents, 0)

    compras.push({
      seriesId,
      label: referencia.description.replace(SUFIXO_DE_PARCELA, '').trim() || 'Compra parcelada',
      icon: categoryIcon(categories, referencia.categoryId),
      categoryId: referencia.categoryId,
      categoryName: categoryLabel(categories, referencia.categoryId),
      totalCents,
      paidCents,
      remainingCents: totalCents - paidCents,
      installmentCents: valorDaParcela,
      paidCount: pagasCount,
      totalCount,
      progress: totalCents === 0 ? 0 : paidCents / totalCents,
      next: abertas[0]?.date ?? null,
      lastDate: parcelas[parcelas.length - 1].date,
      // Com parcelas ausentes, a última importada não é a última da compra: a
      // dívida continua depois do fim do extrato.
      done: abertas.length === 0 && !faltando,
      /*
       * A posição vem da ordem de data quando temos a compra inteira. Os dois
       * concordam no caso normal, mas uma parcela apagada deixaria buracos na
       * numeração gravada — e "3/8" com sete linhas na tela é a tela mentindo
       * sobre si mesma. A ordem cronológica é sempre densa.
       *
       * Faltando parcelas, é o contrário: a lista tem três linhas de uma compra
       * de dez, e numerá-las 1, 2 e 3 renomearia a parcela 5 de alguém para 1.
       * Aí a posição declarada é a única que diz a verdade.
       */
      parcels: parcelas.map((item, indice) => ({
        id: item.id,
        index: faltando ? (item.installment?.index ?? indice + 1) : indice + 1,
        date: item.date,
        amountCents: item.amountCents,
        paid: item.date <= today,
      })),
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
