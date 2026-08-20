import { categoryIcon } from './categories'
import type { Category, CategoryId, Transaction } from './types'
import { fromIsoDate, shiftDate, todayIso, type IsoDate } from '@/lib/date'
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
 * Compra parcelada fica de fora: ela é série também, mas responde outra
 * pergunta e tem página própria (`domain/installments.ts`). Quem separa as
 * duas é `seriesKind`, gravado no lançamento — não uma heurística sobre o
 * nome ou a categoria, que erraria calada.
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
  /**
   * Cobranças que já aconteceram.
   *
   * O campo antes contava as **futuras**, e a tela dizia "cobranças lançadas"
   * sobre ele. Num extrato importado o futuro é sempre zero, por definição —
   * então toda assinatura vinda do banco anunciava "0 cobranças lançadas"
   * embaixo de um valor mensal, que é uma frase que não descreve nada. O que
   * responde "há quanto tempo eu pago isto" é o passado.
   */
  charged: number
}

/** O "(3/12)" que a expansão anexa à descrição. */
const SUFIXO_DE_PARCELA = /\s*\(\d+\/\d+\)\s*$/

const DIA_EM_MS = 86_400_000

/** A unidade de deslocamento de cada cadência, para projetar a próxima. */
const UNIDADE_DA_CADENCIA: Record<SubscriptionCadence, 'week' | 'month' | 'year'> = {
  weekly: 'week',
  monthly: 'month',
  yearly: 'year',
}

export function activeSubscriptions(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  today: IsoDate = todayIso(),
): Subscription[] {
  const series = new Map<string, Transaction[]>()

  for (const transaction of transactions) {
    if (transaction.kind !== 'expense') continue
    if (!transaction.seriesId || transaction.seriesKind !== 'subscription') continue
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
    const cadence = inferirCadencia(ocorrencias)

    /*
     * A próxima cobrança é **projetada** quando a série só tem passado.
     *
     * Quem cadastra uma assinatura pela tela ganha as cobranças seguintes
     * materializadas, e a próxima já existe como lançamento. Um extrato
     * importado é o contrário: é inteiramente passado, por definição. Exigir
     * uma ocorrência futura descartava toda assinatura vinda de importação —
     * a tela ficava vazia justamente para quem trouxe o banco inteiro para
     * dentro do produto.
     *
     * Projetar é honesto porque assinatura é, por definição, o que vai cobrar
     * de novo: se a última cobrança foi em 10 de agosto e a cadência é mensal,
     * a próxima cai em 10 de setembro, tenha ela sido lançada ou não.
     */
    const ultima = ocorrencias[ocorrencias.length - 1]
    const proxima = futuras[0] ?? {
      ...ultima,
      date: shiftDate(ultima.date, 1, UNIDADE_DA_CADENCIA[cadence]),
    }

    /*
     * Uma projeção que já venceu quer dizer que a cobrança esperada não veio, e
     * a explicação mais provável é cancelamento. Continuar somando o serviço na
     * projeção anual seria cobrar da pessoa, no relatório, algo que ela já
     * deixou de pagar. A tolerância de uma cadência cobre atraso de lançamento
     * e importação feita dias depois.
     */
    if (proxima.date < shiftDate(today, -1, UNIDADE_DA_CADENCIA[cadence])) continue

    assinaturas.push({
      seriesId,
      label: proxima.description.replace(SUFIXO_DE_PARCELA, '').trim() || 'Assinatura',
      icon: categoryIcon(categories, proxima.categoryId),
      categoryId: proxima.categoryId,
      amountCents: proxima.amountCents,
      monthlyCents: POR_MES[cadence](proxima.amountCents),
      next: proxima.date,
      cadence,
      charged: ocorrencias.length - futuras.length,
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
