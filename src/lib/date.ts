/**
 * Datas circulam como `YYYY-MM-DD` puro, nunca como `Date`.
 *
 * `new Date('2024-03-15')` é interpretado como UTC e, em fuso negativo como o
 * brasileiro, volta para o dia 14 ao ser exibido. Tratar a data como string de
 * calendário e só construir `Date` com componentes locais evita esse deslize,
 * que a versão original contornava concatenando `'T00:00:00'` em cada chamada.
 *
 * O segundo princípio deste módulo foi aprendido do jeito caro: **nenhuma
 * função aqui lança**. Um único lançamento com data corrompida chegava ao
 * `Intl.DateTimeFormat`, que responde a uma `Date` inválida com um `RangeError`
 * — e como a formatação acontece durante a renderização, o erro subia até a
 * raiz e derrubava a aplicação inteira. Um registro ruim pode estragar a
 * própria linha; não pode estragar a tela.
 */

/** Data de calendário no formato `YYYY-MM-DD`. */
export type IsoDate = string

/** Mês de calendário no formato `YYYY-MM`. Unidade de raciocínio do produto. */
export type MonthKey = string

/** Exibido no lugar de uma data que não dá para interpretar. */
export const INVALID_DATE_LABEL = 'Data inválida'

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})$/
const MONTH_KEY = /^(\d{4})-(\d{2})$/

export function isValidIsoDate(value: unknown): value is IsoDate {
  return typeof value === 'string' && fromIsoDate(value) !== null
}

export function isValidMonthKey(value: unknown): value is MonthKey {
  if (typeof value !== 'string' || !MONTH_KEY.test(value)) return false
  const month = Number(value.slice(5, 7))
  return month >= 1 && month <= 12
}

export function todayIso(): IsoDate {
  return toIsoDate(new Date())
}

export function toIsoDate(date: Date): IsoDate {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Constrói um `Date` local a partir de `YYYY-MM-DD`, sem passar por UTC.
 * Devolve `null` — e não uma `Date` inválida — para que o chamador seja
 * obrigado pelo tipo a decidir o que fazer com uma entrada ruim.
 */
export function fromIsoDate(iso: IsoDate): Date | null {
  const match = ISO_DATE.exec(iso ?? '')
  if (!match) return null

  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  if (Number.isNaN(date.getTime())) return null

  /*
   * O construtor de `Date` transborda em silêncio: 31 de fevereiro vira 2 de
   * março, e mês 13 vira janeiro do ano seguinte. Aceitar isso seria trocar um
   * erro barulhento por uma mentira silenciosa — a tela mostraria uma data que
   * ninguém digitou. A ida e volta pela string é o que prova que a data existe.
   */
  return toIsoDate(date) === iso ? date : null
}

export function monthOf(iso: IsoDate): MonthKey {
  return typeof iso === 'string' ? iso.slice(0, 7) : ''
}

export function currentMonth(): MonthKey {
  return todayIso().slice(0, 7)
}

export function yearOf(month: MonthKey): number {
  // Exige quatro dígitos: `Number('')` é 0, que passaria por `isFinite` e viraria
  // o ano zero — gerando doze chaves de mês que nenhum formatador reconhece.
  const digits = /^(\d{4})/.exec(String(month))
  return digits ? Number(digits[1]) : new Date().getFullYear()
}

/** Desloca um mês em N posições, atravessando a virada de ano corretamente. */
export function shiftMonth(month: MonthKey, delta: number): MonthKey {
  if (!isValidMonthKey(month)) return currentMonth()

  const [year, monthIndex] = month.split('-').map(Number)
  const date = new Date(year, monthIndex - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

/**
 * Desloca uma data preservando a intenção de "mesmo dia do mês".
 * Uma recorrência que começa em 31 de janeiro precisa cair em 28/29 de fevereiro
 * em vez de transbordar para março, que é o que `setMonth` faz sozinho.
 */
export function shiftDate(
  iso: IsoDate,
  amount: number,
  unit: 'day' | 'week' | 'month' | 'year',
): IsoDate {
  const base = fromIsoDate(iso)
  // Sem data de partida válida não há deslocamento possível. Devolver a entrada
  // intacta mantém o problema numa linha só, em vez de gerar "NaN-NaN-NaN" e
  // espalhar a corrupção para o histórico inteiro.
  if (!base) return iso

  const year = base.getFullYear()
  const month = base.getMonth()
  const day = base.getDate()

  if (unit === 'day' || unit === 'week') {
    return toIsoDate(new Date(year, month, day + amount * (unit === 'week' ? 7 : 1)))
  }

  const targetYear = unit === 'year' ? year + amount : year
  const targetMonthIndex = unit === 'month' ? month + amount : month
  const normalized = new Date(targetYear, targetMonthIndex, 1)
  const lastDayOfMonth = new Date(
    normalized.getFullYear(),
    normalized.getMonth() + 1,
    0,
  ).getDate()

  return toIsoDate(
    new Date(normalized.getFullYear(), normalized.getMonth(), Math.min(day, lastDayOfMonth)),
  )
}

const MONTH_LABEL = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
const MONTH_SHORT = new Intl.DateTimeFormat('pt-BR', { month: 'short' })
const DAY_MONTH = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short' })
const FULL_DATE = new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long' })
const DAY_MONTH_YEAR = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' })
const WEEKDAY_SHORT = new Intl.DateTimeFormat('pt-BR', { weekday: 'short' })

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1)
}

/** `Date` do primeiro dia de um mês, ou `null` se a chave não for válida. */
function monthStart(month: MonthKey): Date | null {
  if (!isValidMonthKey(month)) return null
  const [year, monthIndex] = month.split('-').map(Number)
  return new Date(year, monthIndex - 1, 1)
}

/** "Março de 2024" — cabeçalho do seletor global de período. */
export function formatMonthLong(month: MonthKey): string {
  const date = monthStart(month)
  return date ? capitalize(MONTH_LABEL.format(date)) : INVALID_DATE_LABEL
}

/** "Mar" — eixo de gráfico. */
export function formatMonthShort(month: MonthKey): string {
  const date = monthStart(month)
  return date ? capitalize(MONTH_SHORT.format(date).replace('.', '')) : '—'
}

/** "15 de mar" — coluna de data na tabela. */
export function formatDayMonth(iso: IsoDate): string {
  const date = fromIsoDate(iso)
  return date ? DAY_MONTH.format(date).replace('.', '') : INVALID_DATE_LABEL
}

/**
 * "10 ago 2026" — para lista que atravessa a virada do ano.
 *
 * `formatDayMonth` omite o ano, o que basta dentro de um mês. Uma compra em
 * 12x não cabe num ano só, e "10 ago" duas vezes na mesma lista seriam duas
 * parcelas diferentes parecendo a mesma.
 */
export function formatDayMonthYear(iso: IsoDate): string {
  const date = fromIsoDate(iso)
  if (!date) return INVALID_DATE_LABEL

  /*
   * Montado a partir das partes, e não de `format()`.
   *
   * O pt-BR compõe esse conjunto como "10 de ago. de 2026" — dois "de" e um
   * ponto, quinze caracteres para dizer uma data numa lista onde cabem dez.
   * Pegar dia, mês e ano e juntar com espaço dá "10 ago 2026" sem depender de
   * remendar a string com `replace`, que é o que quebra quando a biblioteca
   * muda a pontuação entre versões.
   */
  const partes = DAY_MONTH_YEAR.formatToParts(date)
  const pegar = (tipo: Intl.DateTimeFormatPartTypes) =>
    (partes.find((parte) => parte.type === tipo)?.value ?? '').replace('.', '')

  return `${pegar('day')} ${pegar('month')} ${pegar('year')}`
}

/** "15 de março de 2024" — título acessível e tooltip. */
export function formatFullDate(iso: IsoDate): string {
  const date = fromIsoDate(iso)
  return date ? FULL_DATE.format(date) : INVALID_DATE_LABEL
}

/** "sáb" — a linha de cima da folha de calendário. */
export function formatWeekdayShort(iso: IsoDate): string {
  const date = fromIsoDate(iso)
  return date ? WEEKDAY_SHORT.format(date).replace('.', '') : '—'
}

/** "08" — o número do dia, com zero à esquerda, para a folha de calendário. */
export function formatDayNumber(iso: IsoDate): string {
  const date = fromIsoDate(iso)
  return date ? String(date.getDate()).padStart(2, '0') : '--'
}

/** Os 12 meses de um ano, do mais antigo para o mais recente. */
export function monthsOfYear(year: number): MonthKey[] {
  const safeYear = Number.isFinite(year) ? Math.trunc(year) : new Date().getFullYear()
  return Array.from({ length: 12 }, (_, i) => `${safeYear}-${String(i + 1).padStart(2, '0')}`)
}
