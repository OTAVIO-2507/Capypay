import { isValidIsoDate, monthOf, shiftDate, shiftMonth, type IsoDate, type MonthKey } from '@/lib/date'
import type { Cents } from '@/lib/money'
import type { Account, CreditCardTerms, Transaction } from './types'

/**
 * Faturas de cartão, derivadas dos lançamentos.
 *
 * O produto não recebe a fatura do banco: recebe as compras. A fatura aqui é
 * uma **estimativa** — a soma das compras do cartão entre um fechamento e o
 * seguinte —, e toda tela que a mostra diz isso. Compra que o banco ainda não
 * repassou não entra, e o app do banco pode mostrar um valor maior.
 *
 * A fatura se chama pelo mês do **vencimento**, que é como a pessoa fala dela:
 * "a fatura de outubro" é a que vence em outubro, mesmo tendo fechado em
 * setembro.
 */

export interface InvoiceWindow {
  /** O mês da fatura, pelo vencimento. */
  month: MonthKey
  /** O primeiro dia que entra: o dia seguinte ao fechamento anterior. */
  start: IsoDate
  /** O dia do fechamento, inclusive. */
  end: IsoDate
  /** O vencimento. Nulo quando o dia de vencimento não é conhecido. */
  due: IsoDate | null
}

/** O dia `dia` de `mes`, ou o último dia do mês quando ele é mais curto. */
function diaDoMes(mes: MonthKey, dia: number): IsoDate {
  // `shiftDate` já faz o "mesmo dia, ou o último que existir": partir do dia 1
  // e somar é o jeito de ter 31 → 28 em fevereiro sem reescrever a regra.
  const ultimo = shiftDate(`${shiftMonth(mes, 1)}-01`, -1, 'day')
  const maximo = Number(ultimo.slice(8, 10))
  return `${mes}-${String(Math.min(Math.max(dia, 1), maximo)).padStart(2, '0')}`
}

/**
 * Se o vencimento cai no mesmo mês do fechamento. É o caso de quem fecha no
 * dia 3 e vence no 10; quem fecha no 28 e vence no 8 paga no mês seguinte.
 */
function venceNoMesDoFechamento(terms: Pick<CreditCardTerms, 'closingDay' | 'dueDay'>): boolean {
  return terms.dueDay != null && terms.closingDay != null && terms.dueDay > terms.closingDay
}

/**
 * A janela da fatura que vence em `month`.
 *
 * Sem dia de fechamento conhecido, a fatura vira o mês do calendário. É uma
 * aproximação, e é a única honesta: inventar um fechamento faria a estimativa
 * somar um pedaço de dois meses sem ninguém saber.
 */
export function invoiceWindow(
  terms: Pick<CreditCardTerms, 'closingDay' | 'dueDay'> | null | undefined,
  month: MonthKey,
): InvoiceWindow {
  if (!terms || terms.closingDay == null) {
    return {
      month,
      start: `${month}-01`,
      end: shiftDate(`${shiftMonth(month, 1)}-01`, -1, 'day'),
      due: terms?.dueDay != null ? diaDoMes(month, terms.dueDay) : null,
    }
  }

  const mesDoFechamento = venceNoMesDoFechamento(terms) ? month : shiftMonth(month, -1)
  const fechamento = diaDoMes(mesDoFechamento, terms.closingDay)
  const anterior = diaDoMes(shiftMonth(mesDoFechamento, -1), terms.closingDay)

  return {
    month,
    start: shiftDate(anterior, 1, 'day'),
    end: fechamento,
    due: terms.dueDay != null ? diaDoMes(month, terms.dueDay) : null,
  }
}

/** O mês da fatura aberta hoje: a que recebe uma compra feita hoje. */
export function currentInvoiceMonth(
  terms: Pick<CreditCardTerms, 'closingDay' | 'dueDay'> | null | undefined,
  today: IsoDate,
): MonthKey {
  const mesDeHoje = monthOf(today)
  if (!terms || terms.closingDay == null) return mesDeHoje

  // Depois do fechamento deste mês, a compra já cai na fatura que fecha no mês
  // que vem.
  const fechamentoDesteMes = diaDoMes(mesDeHoje, terms.closingDay)
  const mesDoFechamento = today <= fechamentoDesteMes ? mesDeHoje : shiftMonth(mesDeHoje, 1)
  return venceNoMesDoFechamento(terms) ? mesDoFechamento : shiftMonth(mesDoFechamento, 1)
}

/** As compras de um cartão dentro de uma janela de fatura. */
export function invoiceTransactions(
  transactions: readonly Transaction[],
  accountId: string,
  window: InvoiceWindow,
): Transaction[] {
  return transactions.filter(
    (item) =>
      item.accountId === accountId &&
      item.kind === 'expense' &&
      isValidIsoDate(item.date) &&
      item.date >= window.start &&
      item.date <= window.end,
  )
}

/** O total estimado de uma fatura: a soma das compras dentro da janela. */
export function invoiceTotal(
  transactions: readonly Transaction[],
  accountId: string,
  window: InvoiceWindow,
): Cents {
  return invoiceTransactions(transactions, accountId, window).reduce(
    (soma, item) => soma + item.amountCents,
    0,
  )
}

export interface CardSummary {
  account: Account
  /** A fatura aberta hoje. */
  window: InvoiceWindow
  /** O total estimado dela. */
  invoiceCents: Cents
  /** A data da compra mais recente do cartão — até onde os dados chegam. */
  lastTransactionDate: IsoDate | null
  limitCents: Cents | null
  /**
   * Quanto do limite está tomado.
   *
   * Pelo disponível que o banco informou, quando há: é o único número que
   * conta as parcelas futuras de uma compra importada. Sem ele, pela soma da
   * fatura aberta mais as **parcelas** já lançadas para os meses seguintes, e
   * aí é estimativa.
   *
   * Só parcela futura conta. Uma assinatura cadastrada aqui nasce com doze
   * cobranças lançadas, e as de daqui a seis meses não ocupam limite nenhum
   * hoje — o banco só as cobra quando chegam. Somá-las fazia um cartão com
   * R$ 900 de fatura aparecer com o limite quase todo tomado.
   */
  usedCents: Cents | null
  /** Se o usado veio do banco (exato) ou dos lançamentos (estimado). */
  usedFromBank: boolean
}

/** O resumo de um cartão para a tela de Contas. */
export function cardSummary(
  account: Account,
  transactions: readonly Transaction[],
  today: IsoDate,
): CardSummary {
  const terms = account.creditCard
  const window = invoiceWindow(terms, currentInvoiceMonth(terms, today))
  const doCartao = transactions.filter(
    (item) => item.accountId === account.id && item.kind === 'expense',
  )

  const lastTransactionDate = doCartao
    .map((item) => item.date)
    .filter((date) => date <= today)
    .sort()
    .at(-1) ?? null

  const limitCents = terms?.limitCents ?? null
  const disponivel = terms?.availableCents
  const usedFromBank = limitCents != null && disponivel != null

  let usedCents: Cents | null = null
  if (usedFromBank) usedCents = Math.max(limitCents - disponivel, 0)
  else if (limitCents != null) {
    usedCents = doCartao
      .filter(
        (item) =>
          item.date >= window.start &&
          (item.date <= window.end || item.seriesKind === 'installment'),
      )
      .reduce((soma, item) => soma + item.amountCents, 0)
  }

  return {
    account,
    window,
    invoiceCents: invoiceTotal(transactions, account.id, window),
    lastTransactionDate,
    limitCents,
    usedCents,
    usedFromBank,
  }
}

export interface InvoiceMonth {
  month: MonthKey
  cents: Cents
}

/**
 * As faturas de vários cartões, somadas por mês de vencimento, nos `count`
 * meses que terminam em `lastMonth`.
 *
 * Cada cartão usa a própria janela — dois cartões com fechamentos diferentes
 * não compartilham o recorte —, e o que soma é o mês em que cada fatura vence,
 * que é o mês em que o dinheiro sai.
 */
export function invoiceHistory(
  cards: readonly Account[],
  transactions: readonly Transaction[],
  lastMonth: MonthKey,
  count = 6,
): InvoiceMonth[] {
  const meses = Array.from({ length: count }, (_, indice) => shiftMonth(lastMonth, indice - count + 1))
  return meses.map((month) => ({
    month,
    cents: cards.reduce(
      (soma, card) => soma + invoiceTotal(transactions, card.id, invoiceWindow(card.creditCard, month)),
      0,
    ),
  }))
}
