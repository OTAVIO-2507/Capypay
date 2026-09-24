import { monthOf, monthsOfYear, shiftMonth, todayIso, type IsoDate, type MonthKey } from '@/lib/date'
import { percentOf, type Cents } from '@/lib/money'
import { findGroup, groupIdOf } from './categories'
import { merchantKey } from './importing'
import type {
  Category,
  CategoryGroupId,
  CategoryId,
  Goal,
  GoalId,
  Transaction,
  TransactionKind,
} from './types'

/**
 * Todo cálculo derivado vive aqui, em funções puras sobre os dados brutos.
 *
 * A versão anterior gravava valores derivados no estado — `goal.current` era
 * persistido e recalculado a cada render — o que abre espaço para o dado salvo
 * discordar do dado calculado. Aqui nada derivado é persistido: o progresso de
 * uma meta é sempre a soma dos aportes vinculados a ela, ponto.
 */

export interface PeriodTotals {
  income: Cents
  expense: Cents
  contribution: Cents
  /** Receitas menos despesas menos aportes. O que sobrou no período. */
  net: Cents
}

const EMPTY_TOTALS: PeriodTotals = { income: 0, expense: 0, contribution: 0, net: 0 }

export function totalsFor(transactions: readonly Transaction[]): PeriodTotals {
  let income = 0
  let expense = 0
  let contribution = 0

  for (const transaction of transactions) {
    if (transaction.kind === 'income') income += transaction.amountCents
    else if (transaction.kind === 'expense') expense += transaction.amountCents
    else contribution += transaction.amountCents
  }

  return { income, expense, contribution, net: income - expense - contribution }
}

export function transactionsInMonth(
  transactions: readonly Transaction[],
  month: MonthKey,
): Transaction[] {
  return transactions.filter((transaction) => monthOf(transaction.date) === month)
}

export function totalsForMonth(
  transactions: readonly Transaction[],
  month: MonthKey,
): PeriodTotals {
  return totalsFor(transactionsInMonth(transactions, month))
}

/**
 * Saldo acumulado até o fim de um mês — o que efetivamente está disponível,
 * somando todo o histórico anterior. Diferente do resultado do mês.
 */
export function cumulativeBalanceThrough(
  transactions: readonly Transaction[],
  month: MonthKey,
): Cents {
  const upToMonth = transactions.filter((transaction) => monthOf(transaction.date) <= month)
  return totalsFor(upToMonth).net
}

export interface MonthComparison {
  current: PeriodTotals
  previous: PeriodTotals
  /** Diferença absoluta do resultado contra o mês anterior. */
  netDelta: Cents
  /**
   * Variação relativa do resultado. `null` quando o mês anterior é zero — nesse
   * caso não existe percentual honesto, e exibir "+100%" seria invenção.
   */
  netRatio: number | null
}

export function compareWithPreviousMonth(
  transactions: readonly Transaction[],
  month: MonthKey,
): MonthComparison {
  const current = totalsForMonth(transactions, month)
  const previous = totalsForMonth(transactions, shiftMonth(month, -1))
  const netDelta = current.net - previous.net

  return {
    current,
    previous,
    netDelta,
    netRatio: previous.net === 0 ? null : netDelta / Math.abs(previous.net),
  }
}

/**
 * O gasto de um **grupo** de categorias no período.
 *
 * Soma pelo grupo, e não pela subcategoria, porque é a pergunta que as telas
 * de composição fazem: "quanto foi em Transporte" é uma leitura; "quanto foi
 * em Postos de gasolina, em Estacionamentos e em Pedágios" são três fatias
 * finas que o olho precisa somar sozinho.
 */
export interface CategorySpend {
  groupId: CategoryGroupId
  label: string
  icon: string
  amount: Cents
  /** Fatia do total de despesas do período, de 0 a 1. */
  share: number
}

/** Gastos do mês agrupados por grupo de categoria, do maior para o menor. */
export function spendingByCategory(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  month: MonthKey,
): CategorySpend[] {
  const totals = new Map<CategoryGroupId, Cents>()

  for (const transaction of transactionsInMonth(transactions, month)) {
    if (transaction.kind !== 'expense') continue
    const grupo = groupIdOf(transaction.categoryId, categories)
    totals.set(grupo, (totals.get(grupo) ?? 0) + transaction.amountCents)
  }

  const grandTotal = [...totals.values()].reduce((sum, value) => sum + value, 0)

  return [...totals.entries()]
    .map(([groupId, amount]) => {
      const group = findGroup(groupId)
      return {
        groupId,
        label: group.label,
        icon: group.icon,
        amount,
        share: grandTotal === 0 ? 0 : amount / grandTotal,
      }
    })
    .sort((a, b) => b.amount - a.amount)
}

export interface MonthlyFlowPoint {
  month: MonthKey
  income: Cents
  expense: Cents
  contribution: Cents
  net: Cents
}

/** Série de fluxo para os N meses que terminam em `month`, inclusive. */
export function monthlyFlow(
  transactions: readonly Transaction[],
  month: MonthKey,
  length = 6,
): MonthlyFlowPoint[] {
  return Array.from({ length }, (_, index) => {
    const key = shiftMonth(month, index - (length - 1))
    const totals = totalsForMonth(transactions, key)
    return { month: key, ...totals }
  })
}

/** Resultado de cada mês de um ano, para a faixa de tendência anual. */
export function yearlyNet(
  transactions: readonly Transaction[],
  year: number,
): { month: MonthKey; net: Cents }[] {
  return monthsOfYear(year).map((month) => ({
    month,
    net: totalsForMonth(transactions, month).net,
  }))
}

export interface GoalProgress {
  goal: Goal
  savedCents: Cents
  remainingCents: Cents
  /** Percentual inteiro, saturado em 100 para largura de barra. */
  percent: number
  /** Percentual inteiro real, que pode ultrapassar 100. */
  rawPercent: number
  reached: boolean
}

/**
 * Progresso das metas, sempre derivado dos aportes — nunca lido de um campo
 * salvo. Excluir um aporte reduz o progresso automaticamente.
 */
export function goalProgress(
  goals: readonly Goal[],
  transactions: readonly Transaction[],
): GoalProgress[] {
  const saved = new Map<GoalId, Cents>()

  for (const transaction of transactions) {
    if (transaction.kind !== 'contribution' || !transaction.goalId) continue
    saved.set(transaction.goalId, (saved.get(transaction.goalId) ?? 0) + transaction.amountCents)
  }

  return goals
    .filter((goal) => !goal.archived)
    .map((goal) => {
      const savedCents = saved.get(goal.id) ?? 0
      const rawPercent = percentOf(savedCents, goal.targetCents)
      return {
        goal,
        savedCents,
        remainingCents: Math.max(goal.targetCents - savedCents, 0),
        percent: Math.min(rawPercent, 100),
        rawPercent,
        reached: savedCents >= goal.targetCents,
      }
    })
}

/** Uma subcategoria dentro de `GroupSpend`. */
export interface SubcategorySpend {
  categoryId: CategoryId
  label: string
  icon: string
  amount: Cents
}

/** O gasto de um grupo, com as subcategorias que o compõem. */
export interface GroupSpend extends CategorySpend {
  /** Do maior para o menor, só as que tiveram gasto no mês. */
  items: SubcategorySpend[]
}

/**
 * O gasto do mês em árvore: cada grupo, e dentro dele as subcategorias.
 *
 * É a leitura da tela de Categorias, que abre o grupo para mostrar de onde
 * o número dele veio — "Transporte R$ 600" diz pouco; "R$ 520 disso foi
 * combustível" diz o que fazer. Os grupos vêm na ordem de `spendingByCategory`
 * e somam exatamente o mesmo, então o anel e a lista nunca discordam.
 */
export function spendingTree(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  month: MonthKey,
): GroupSpend[] {
  const porFolha = new Map<CategoryId, Cents>()
  for (const transaction of transactionsInMonth(transactions, month)) {
    if (transaction.kind !== 'expense') continue
    porFolha.set(
      transaction.categoryId,
      (porFolha.get(transaction.categoryId) ?? 0) + transaction.amountCents,
    )
  }

  const porGrupo = new Map<CategoryGroupId, SubcategorySpend[]>()
  for (const [categoryId, amount] of porFolha) {
    const grupo = groupIdOf(categoryId, categories)
    const category = categories.find((item) => item.id === categoryId)
    const lista = porGrupo.get(grupo) ?? []
    lista.push({
      categoryId,
      label: category?.label ?? 'Sem categoria',
      icon: category?.icon ?? 'circle-dashed',
      amount,
    })
    porGrupo.set(grupo, lista)
  }

  return spendingByCategory(transactions, categories, month).map((grupo) => ({
    ...grupo,
    items: (porGrupo.get(grupo.groupId) ?? []).sort((a, b) => b.amount - a.amount),
  }))
}

/** Meses que possuem ao menos um lançamento, do mais recente para o mais antigo. */
export function monthsWithActivity(transactions: readonly Transaction[]): MonthKey[] {
  const months = new Set<MonthKey>()
  for (const transaction of transactions) months.add(monthOf(transaction.date))
  return [...months].sort().reverse()
}

export interface TransactionFilters {
  search: string
  kind: TransactionKind | 'all'
  /**
   * Categorias aceitas. Lista vazia é "todas": o filtro de categoria escolhe
   * várias de uma vez, e "nenhuma marcada" precisa querer dizer "sem recorte",
   * nunca "nenhum lançamento" — uma tabela vazia porque ninguém marcou nada
   * pareceria defeito.
   */
  categoryIds: readonly CategoryId[]
  accountId: string | 'all'
  /** `null` desativa o recorte mensal e mostra o histórico inteiro. */
  month: MonthKey | null
  /**
   * Um único dia. `null` é "qualquer dia".
   *
   * Existe ao lado de `month` em vez de substituí-lo porque responde outra
   * pergunta: o mês é o período que a tela inteira está mostrando, e o dia é
   * um recorte que alguém pediu — hoje, o clique numa célula do mapa de calor.
   * Guardados juntos, são duas coisas para limpar ao mesmo tempo.
   */
  day: IsoDate | null
}

export const EMPTY_FILTERS: TransactionFilters = {
  search: '',
  kind: 'all',
  categoryIds: [],
  accountId: 'all',
  month: null,
  day: null,
}

export function filterTransactions(
  transactions: readonly Transaction[],
  filters: TransactionFilters,
): Transaction[] {
  const search = filters.search.trim().toLowerCase()
  const categorias = filters.categoryIds.length > 0 ? new Set(filters.categoryIds) : null

  return transactions.filter((transaction) => {
    if (filters.month && monthOf(transaction.date) !== filters.month) return false
    if (filters.day && transaction.date !== filters.day) return false
    if (filters.kind !== 'all' && transaction.kind !== filters.kind) return false
    if (categorias && !categorias.has(transaction.categoryId)) return false
    if (filters.accountId !== 'all' && transaction.accountId !== filters.accountId) return false
    if (search && !transaction.description.toLowerCase().includes(search)) return false
    return true
  })
}

/** Ordena por data decrescente e, no empate, pelo lançamento mais recente. */
export function sortByDateDesc(transactions: readonly Transaction[]): Transaction[] {
  return [...transactions].sort((a, b) => {
    if (a.date !== b.date) return a.date < b.date ? 1 : -1
    return b.createdAt - a.createdAt
  })
}

export type TransactionOrder = 'date-desc' | 'date-asc' | 'amount-desc' | 'amount-asc'

/**
 * Ordena a lista pela escolha da tela de Transações.
 *
 * Valor ordena pelo **tamanho** do lançamento, sem sinal: "maior primeiro"
 * responde "onde foi o dinheiro grande", e isso vale para uma receita de
 * R$ 5.000 tanto quanto para uma despesa do mesmo tamanho. Ordenar pelo valor
 * com sinal jogaria todas as despesas para o fim e as receitas para o topo,
 * que é filtrar por tipo com outro nome.
 *
 * No empate, a data mais recente vem antes, e depois o lançamento criado por
 * último — a mesma regra de `sortByDateDesc`, para duas compras iguais no mesmo
 * dia não trocarem de lugar a cada renderização.
 */
export function sortTransactions(
  transactions: readonly Transaction[],
  order: TransactionOrder,
): Transaction[] {
  const recentes = sortByDateDesc(transactions)
  if (order === 'date-desc') return recentes
  if (order === 'date-asc') {
    return [...transactions].sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1
      return a.createdAt - b.createdAt
    })
  }

  // `sort` é estável: partir da lista já em data decrescente faz o empate de
  // valor sair nessa ordem sem um segundo critério escrito à mão.
  const sinal = order === 'amount-desc' ? -1 : 1
  return recentes.sort((a, b) => sinal * (a.amountCents - b.amountCents))
}

/** Agrupa lançamentos por dia, preservando a ordem já aplicada. */
export function groupByDate(
  transactions: readonly Transaction[],
): { date: IsoDate; items: Transaction[]; net: Cents }[] {
  const groups = new Map<IsoDate, Transaction[]>()

  for (const transaction of transactions) {
    const bucket = groups.get(transaction.date)
    if (bucket) bucket.push(transaction)
    else groups.set(transaction.date, [transaction])
  }

  return [...groups.entries()].map(([date, items]) => ({
    date,
    items,
    net: totalsFor(items).net,
  }))
}

export { EMPTY_TOTALS }

/** Um dia do mês, com o gasto acumulado até ele nos dois meses comparados. */
export interface SpendingPacePoint {
  day: number
  /**
   * Acumulado do mês em foco. `null` depois de hoje, e isso é deliberado: uma
   * linha que continua reta até o fim do mês parece gasto zero nos dias que
   * ainda não aconteceram, quando na verdade eles não têm resposta ainda.
   */
  current: Cents | null
  /** Acumulado do mês anterior no mesmo dia. Vai até o fim, porque já aconteceu. */
  previous: Cents | null
}

export interface SpendingPace {
  points: SpendingPacePoint[]
  /** Gasto do mês em foco até hoje. */
  currentCents: Cents
  /**
   * Gasto do mês anterior **até o mesmo dia**, e não o mês fechado.
   *
   * É o que torna a comparação honesta: no dia 10, comparar dez dias contra
   * trinta diria que se está gastando muito menos todo início de mês, e a
   * conclusão viraria elogio automático em vez de informação.
   */
  previousCents: Cents
  /** Positivo quando se gastou mais que no mês anterior no mesmo ponto. */
  deltaCents: Cents
  /** Variação relativa. `null` quando não há com o que comparar. */
  ratio: number | null
  /** O último dia com resposta: hoje, ou o fim do mês se ele já passou. */
  dayCursor: number
}

/**
 * O ritmo de gastos do mês, dia a dia, contra o mês anterior.
 *
 * Responde uma pergunta que o total do mês não responde: **estou gastando mais
 * rápido que da última vez?**. O total fechado só chega no fim, quando não há
 * mais o que decidir; a curva acumulada mostra a diferença no dia 10, que é
 * quando ainda dá para mudar alguma coisa.
 *
 * Só despesa entra. Misturar receita produziria uma linha que desce quando o
 * salário cai, e "gastei menos" e "recebi mais" são coisas diferentes.
 */
export function spendingPace(
  transactions: readonly Transaction[],
  month: MonthKey,
  today: IsoDate = todayIso(),
): SpendingPace {
  const anterior = shiftMonth(month, -1)

  const porDia = (alvo: MonthKey) => {
    const dias = new Map<number, Cents>()
    for (const transaction of transactions) {
      if (transaction.kind !== 'expense') continue
      if (monthOf(transaction.date) !== alvo) continue
      const dia = Number(transaction.date.slice(8, 10))
      dias.set(dia, (dias.get(dia) ?? 0) + transaction.amountCents)
    }
    return dias
  }

  const gastosAtuais = porDia(month)
  const gastosAnteriores = porDia(anterior)

  const diasNoMes = new Date(
    Number(month.slice(0, 4)),
    Number(month.slice(5, 7)),
    0,
  ).getDate()

  // O mês em foco pode ser passado, presente ou futuro. Em mês passado a linha
  // vai até o fim; no mês corrente ela para hoje; num mês futuro não há nada.
  const mesDeHoje = monthOf(today)
  const dayCursor =
    month < mesDeHoje ? diasNoMes : month === mesDeHoje ? Number(today.slice(8, 10)) : 0

  const points: SpendingPacePoint[] = []
  let somaAtual = 0
  let somaAnterior = 0
  let currentCents = 0
  let previousCents = 0

  for (let dia = 1; dia <= diasNoMes; dia += 1) {
    somaAtual += gastosAtuais.get(dia) ?? 0
    somaAnterior += gastosAnteriores.get(dia) ?? 0

    if (dia <= dayCursor) {
      currentCents = somaAtual
      previousCents = somaAnterior
    }

    points.push({
      day: dia,
      current: dia <= dayCursor ? somaAtual : null,
      previous: somaAnterior,
    })
  }

  const deltaCents = currentCents - previousCents

  return {
    points,
    currentCents,
    previousCents,
    deltaCents,
    ratio: previousCents === 0 ? null : deltaCents / previousCents,
    dayCursor,
  }
}

export interface DailyTotal {
  /** Dia do mês, de 1 ao último. */
  day: number
  cents: Cents
  /**
   * Quantas despesas caíram nesse dia.
   *
   * O valor sozinho não diz que tipo de dia foi: quatrocentos reais podem ser
   * uma compra grande ou doze pequenas, e as duas pedem reações diferentes. É
   * o número que o balão do mapa mostra embaixo do total.
   */
  count: number
}

export interface DailySpending {
  /** Um item por dia do mês, sempre do dia 1 ao último — inclusive os zerados. */
  days: DailyTotal[]
  /** Dia da semana em que o mês começa: 0 = domingo. */
  firstWeekday: number
  /** O maior gasto de um único dia, e em que dia foi. Nulo em mês sem despesa. */
  peak: { day: number; cents: Cents } | null
  /** Média por dia **decorrido**, não por dia do mês. Ver a nota abaixo. */
  dailyAverageCents: Cents
}

/**
 * O gasto de cada dia do mês, para o mapa de calor.
 *
 * Devolve todos os dias, inclusive os sem gasto: o mapa precisa da grade
 * inteira para manter cada dia na linha do seu dia da semana, e um dia
 * ausente deslocaria todos os seguintes.
 *
 * A média divide pelos dias **decorridos**, não pelos dias do mês. No dia 5 de
 * um mês de 30, dividir por 30 daria uma média seis vezes menor que a real e
 * diria que está tudo bem quando não está. Em mês passado os dois números
 * coincidem; em mês futuro não há o que dividir e a média é zero.
 */
export function dailySpending(
  transactions: readonly Transaction[],
  month: MonthKey,
  today: IsoDate = todayIso(),
): DailySpending {
  const porDia = new Map<number, { cents: Cents; count: number }>()
  for (const transaction of transactions) {
    if (transaction.kind !== 'expense') continue
    if (monthOf(transaction.date) !== month) continue
    const dia = Number(transaction.date.slice(8, 10))
    const atual = porDia.get(dia)
    if (atual) {
      atual.cents += transaction.amountCents
      atual.count += 1
    } else {
      porDia.set(dia, { cents: transaction.amountCents, count: 1 })
    }
  }

  const ano = Number(month.slice(0, 4))
  const mes = Number(month.slice(5, 7))
  const diasNoMes = new Date(ano, mes, 0).getDate()

  const days: DailyTotal[] = Array.from({ length: diasNoMes }, (_, i) => ({
    day: i + 1,
    cents: porDia.get(i + 1)?.cents ?? 0,
    count: porDia.get(i + 1)?.count ?? 0,
  }))

  const peak = days.reduce<{ day: number; cents: Cents } | null>(
    (maior, dia) => (dia.cents > 0 && (!maior || dia.cents > maior.cents) ? dia : maior),
    null,
  )

  const mesDeHoje = monthOf(today)
  const decorridos =
    month < mesDeHoje ? diasNoMes : month === mesDeHoje ? Number(today.slice(8, 10)) : 0

  const total = days.reduce((soma, dia) => soma + dia.cents, 0)

  return {
    days,
    // `Date` com dia 1 em horário local: usar UTC aqui joga o mês para o dia
    // anterior em qualquer fuso a oeste de Greenwich, e o Brasil inteiro é.
    firstWeekday: new Date(ano, mes - 1, 1).getDay(),
    peak,
    dailyAverageCents: decorridos === 0 ? 0 : Math.round(total / decorridos),
  }
}

export interface CategoryComparison extends CategorySpend {
  /** O mesmo gasto no mês anterior. Zero quando a categoria não apareceu lá. */
  previousCents: Cents
  /**
   * A variação contra o mês anterior, de -1 a +∞. Nula quando a categoria é
   * nova — não existe "aumentou infinito por cento", existe "não tinha".
   */
  changeRatio: number | null
}

/**
 * Gastos por categoria com o comparativo do mês anterior.
 *
 * Existe separado de `spendingByCategory` porque responde outra pergunta.
 * Aquele responde "onde o dinheiro foi este mês", que é composição; este
 * responde "o que mudou", que é comportamento. Juntar os dois obrigaria todo
 * consumidor do primeiro a carregar um mês extra de transações que não vai
 * usar.
 *
 * A ordenação continua pelo valor atual, e não pela variação. Uma categoria
 * que triplicou de dez para trinta reais lidera a lista ordenada por variação
 * e não merece a primeira linha de nada.
 */
export function categoryComparison(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  month: MonthKey,
): CategoryComparison[] {
  const atual = spendingByCategory(transactions, categories, month)
  const anterior = spendingByCategory(transactions, categories, shiftMonth(month, -1))

  const porId = new Map(anterior.map((item) => [item.groupId, item.amount]))

  return atual.map((item) => {
    const previousCents = porId.get(item.groupId) ?? 0

    return {
      ...item,
      previousCents,
      changeRatio: previousCents === 0 ? null : (item.amount - previousCents) / previousCents,
    }
  })
}

export interface MonthInsight {
  /** A frase que o painel diz, já montada. Sempre em segunda pessoa. */
  message: string
  /** Quão grave é o que ela diz. Governa a cor do título. */
  tone: 'good' | 'bad' | 'neutral'
  /** A variação do gasto contra o mês anterior, de -1 a +∞, ou nula. */
  changeRatio: number | null
  spentCents: Cents
  /** A categoria que mais pesou no mês, quando existe alguma. */
  topCategory: { label: string; icon: string } | null
}

/**
 * A leitura do mês em uma frase.
 *
 * É o que o card de abertura da Visão geral diz, e é **cálculo, não geração**.
 * O produto de referência abre com uma frase de assistente do mesmo formato —
 * "seus gastos dispararam 116% comparado ao mês passado" — e essa frase em
 * particular não precisa de modelo nenhum: é uma divisão e um limiar.
 *
 * Construir aqui, e não no componente, é o que permite testá-la. Uma frase que
 * diz "dispararam" quando o gasto caiu é o pior defeito possível desta tela, e
 * ele não apareceria em nenhuma checagem de tipo.
 *
 * Os limiares são três e foram escolhidos pelo que muda a decisão de quem lê:
 * abaixo de 10% para cima ou para baixo, o mês é igual ao anterior e não há o
 * que fazer a respeito; acima de 50%, algo mudou de patamar e vale investigar;
 * no meio, é variação normal de mês a mês.
 */
export function monthInsight(
  transactions: readonly Transaction[],
  categories: readonly Category[],
  month: MonthKey,
  nome?: string,
): MonthInsight {
  const atual = totalsForMonth(transactions, month)
  const anterior = totalsForMonth(transactions, shiftMonth(month, -1))

  const gasto = atual.expense
  const gastoAnterior = anterior.expense
  const changeRatio = gastoAnterior === 0 ? null : (gasto - gastoAnterior) / gastoAnterior

  const porCategoria = spendingByCategory(transactions, categories, month)
  const topCategory = porCategoria[0]
    ? { label: porCategoria[0].label, icon: porCategoria[0].icon }
    : null

  // O nome entra na frase só quando existe. "Otávio, seus gastos..." é uma
  // frase; ", seus gastos..." é um defeito visível.
  const vocativo = nome ? `${nome}, ` : ''
  const maiuscula = (frase: string) =>
    nome ? frase : frase.charAt(0).toUpperCase() + frase.slice(1)

  if (gasto === 0) {
    return {
      message: `${vocativo}${maiuscula('nenhuma despesa lançada neste mês ainda.')}`,
      tone: 'neutral',
      changeRatio,
      spentCents: gasto,
      topCategory,
    }
  }

  if (changeRatio === null) {
    return {
      message: `${vocativo}${maiuscula('este é o primeiro mês com gastos registrados — o mês que vem já terá com o que comparar.')}`,
      tone: 'neutral',
      changeRatio,
      spentCents: gasto,
      topCategory,
    }
  }

  const percentual = Math.round(Math.abs(changeRatio) * 100)

  if (changeRatio > 0.5) {
    return {
      message: `${vocativo}${maiuscula(`seus gastos subiram ${percentual}% comparado ao mês passado. Vale olhar de perto.`)}`,
      tone: 'bad',
      changeRatio,
      spentCents: gasto,
      topCategory,
    }
  }

  if (changeRatio > 0.1) {
    return {
      message: `${vocativo}${maiuscula(`seus gastos estão ${percentual}% acima do mês passado.`)}`,
      tone: 'bad',
      changeRatio,
      spentCents: gasto,
      topCategory,
    }
  }

  if (changeRatio < -0.1) {
    return {
      message: `${vocativo}${maiuscula(`seus gastos caíram ${percentual}% comparado ao mês passado.`)}`,
      tone: 'good',
      changeRatio,
      spentCents: gasto,
      topCategory,
    }
  }

  return {
    message: `${vocativo}${maiuscula('seus gastos estão no mesmo ritmo do mês passado.')}`,
    tone: 'neutral',
    changeRatio,
    spentCents: gasto,
    topCategory,
  }
}

/**
 * Outros lançamentos do mesmo lugar, do mais recente para o mais antigo.
 *
 * "Mesmo lugar" é a chave do estabelecimento, e não a descrição idêntica:
 * "Compra no débito - Mercadinho Aruja Bra" e "COMPRA NO DEBITO - MERCADINHO
 * ARUJA BRA 0293" são a mesma padaria. O tipo também precisa bater — um
 * estorno da loja não é uma compra semelhante a ela.
 *
 * Descrição que some inteira na limpeza ("PIX 0293") não tem estabelecimento
 * reconhecível, e aí não há semelhante nenhum: casar pela chave vazia diria
 * que todo lançamento sem nome é parecido com todo outro.
 */
export function similarTransactions(
  target: Transaction,
  transactions: readonly Transaction[],
  limit = 3,
): Transaction[] {
  const chave = merchantKey(target.description)
  if (!chave) return []

  return transactions
    .filter(
      (item) =>
        item.id !== target.id &&
        item.kind === target.kind &&
        merchantKey(item.description) === chave,
    )
    .sort((a, b) => (a.date === b.date ? b.createdAt - a.createdAt : a.date < b.date ? 1 : -1))
    .slice(0, limit)
}
