import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from './categories'
import {
  categoryComparison,
  monthInsight,
  dailySpending,
  EMPTY_FILTERS,
  filterTransactions,
  sortTransactions,
  spendingTree,
  similarTransactions,
  compareWithPreviousMonth,
  cumulativeBalanceThrough,
  goalProgress,
  spendingByCategory,
  totalsFor,
  spendingPace,
} from './selectors'
import type { Goal, Transaction } from './types'

function tx(partial: Partial<Transaction> & Pick<Transaction, 'kind' | 'amountCents' | 'date'>): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    description: 'x',
    categoryId: 'outros',
    goalId: null,
    accountId: null,
    source: 'manual',
    externalId: null,
    seriesId: null,
    installment: null,
    notes: null,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  }
}

const GOALS: Goal[] = [
  { id: 'g1', name: 'Reserva', icon: 'target', targetCents: 100000, deadline: null, archived: false, createdAt: 0 },
  { id: 'g2', name: 'Arquivada', icon: 'target', targetCents: 50000, deadline: null, archived: true, createdAt: 0 },
]

describe('totalsFor', () => {
  it('trata aporte como saída do saldo, sem contá-lo como despesa', () => {
    const totals = totalsFor([
      tx({ kind: 'income', amountCents: 500000, date: '2024-03-05' }),
      tx({ kind: 'expense', amountCents: 200000, date: '2024-03-10' }),
      tx({ kind: 'contribution', amountCents: 100000, date: '2024-03-15', goalId: 'g1' }),
    ])

    expect(totals.income).toBe(500000)
    expect(totals.expense).toBe(200000)
    expect(totals.contribution).toBe(100000)
    expect(totals.net).toBe(200000)
  })
})

describe('cumulativeBalanceThrough', () => {
  it('acumula os meses anteriores e ignora os posteriores', () => {
    const transactions = [
      tx({ kind: 'income', amountCents: 100000, date: '2024-01-10' }),
      tx({ kind: 'income', amountCents: 100000, date: '2024-02-10' }),
      tx({ kind: 'income', amountCents: 999999, date: '2024-04-10' }),
    ]

    expect(cumulativeBalanceThrough(transactions, '2024-02')).toBe(200000)
  })
})

describe('compareWithPreviousMonth', () => {
  it('não inventa percentual quando o mês anterior é zero', () => {
    const comparison = compareWithPreviousMonth(
      [tx({ kind: 'income', amountCents: 100000, date: '2024-03-10' })],
      '2024-03',
    )

    expect(comparison.netDelta).toBe(100000)
    expect(comparison.netRatio).toBeNull()
  })
})

describe('goalProgress', () => {
  const transactions = [
    tx({ kind: 'contribution', amountCents: 30000, date: '2024-03-10', goalId: 'g1' }),
    tx({ kind: 'contribution', amountCents: 20000, date: '2024-04-10', goalId: 'g1' }),
    // Despesa comum não pode alimentar meta nenhuma.
    tx({ kind: 'expense', amountCents: 90000, date: '2024-04-11' }),
  ]

  it('deriva o progresso da soma dos aportes', () => {
    const [reserva] = goalProgress(GOALS, transactions)
    expect(reserva.savedCents).toBe(50000)
    expect(reserva.percent).toBe(50)
    expect(reserva.remainingCents).toBe(50000)
    expect(reserva.reached).toBe(false)
  })

  it('omite metas arquivadas', () => {
    expect(goalProgress(GOALS, transactions)).toHaveLength(1)
  })

  it('satura a barra em 100% mas preserva o percentual real', () => {
    const excedente = [tx({ kind: 'contribution', amountCents: 150000, date: '2024-03-10', goalId: 'g1' })]
    const [reserva] = goalProgress(GOALS, excedente)
    expect(reserva.percent).toBe(100)
    expect(reserva.rawPercent).toBe(150)
    expect(reserva.reached).toBe(true)
  })
})

describe('spendingByCategory', () => {
  it('agrupa despesas do mês e ordena da maior para a menor', () => {
    const transactions = [
      tx({ kind: 'expense', amountCents: 10000, date: '2024-03-01', categoryId: 'lazer' }),
      tx({ kind: 'expense', amountCents: 40000, date: '2024-03-02', categoryId: 'alimentacao' }),
      tx({ kind: 'expense', amountCents: 10000, date: '2024-03-03', categoryId: 'alimentacao' }),
      // Nem receita nem aporte entram na composição de gastos.
      tx({ kind: 'income', amountCents: 900000, date: '2024-03-04', categoryId: 'salario' }),
      tx({ kind: 'contribution', amountCents: 50000, date: '2024-03-05', goalId: 'g1', categoryId: 'meta' }),
      // Outro mês não entra.
      tx({ kind: 'expense', amountCents: 99999, date: '2024-04-01', categoryId: 'moradia' }),
    ]

    const result = spendingByCategory(transactions, DEFAULT_CATEGORIES, '2024-03')

    expect(result.map((r) => r.groupId)).toEqual(['alimentacao', 'lazer'])
    expect(result[0].amount).toBe(50000)
    expect(result[0].share).toBeCloseTo(50000 / 60000)
  })
})

describe('spendingPace', () => {
  const gasto = (date: string, amountCents: number) =>
    tx({ kind: 'expense', amountCents, date })

  it('acumula dia a dia e para no dia de hoje', () => {
    const pace = spendingPace(
      [gasto('2026-08-02', 1000), gasto('2026-08-05', 2000), gasto('2026-08-09', 500)],
      '2026-08',
      '2026-08-06',
    )

    expect(pace.points[1].current).toBe(1000)
    expect(pace.points[4].current).toBe(3000)
    // O dia 9 ainda não aconteceu: a linha para, e não segue reta fingindo
    // que houve gasto zero num dia que não chegou.
    expect(pace.points[8].current).toBeNull()
    expect(pace.currentCents).toBe(3000)
  })

  /*
   * A comparação é dia contra dia, e não contra o mês fechado. No dia 10,
   * comparar dez dias contra trinta diria que se está gastando muito menos todo
   * início de mês, e a conclusão viraria elogio automático em vez de informação.
   */
  it('compara com o mesmo dia do mês anterior, não com o mês inteiro', () => {
    const pace = spendingPace(
      [
        gasto('2026-07-03', 5000),
        gasto('2026-07-20', 90000),
        gasto('2026-08-03', 4000),
      ],
      '2026-08',
      '2026-08-05',
    )

    expect(pace.previousCents).toBe(5000)
    expect(pace.currentCents).toBe(4000)
    expect(pace.deltaCents).toBe(-1000)
  })

  it('mostra o mês anterior inteiro, porque ele já aconteceu', () => {
    const pace = spendingPace([gasto('2026-07-28', 3000)], '2026-08', '2026-08-05')

    expect(pace.points[27].previous).toBe(3000)
    expect(pace.points[30].previous).toBe(3000)
  })

  it('ignora receita, que não é ritmo de gasto', () => {
    const pace = spendingPace(
      [gasto('2026-08-02', 1000), tx({ kind: 'income', amountCents: 500000, date: '2026-08-03' })],
      '2026-08',
      '2026-08-05',
    )

    expect(pace.currentCents).toBe(1000)
  })

  it('percorre o mês inteiro quando ele já passou', () => {
    const pace = spendingPace([gasto('2026-07-31', 1000)], '2026-07', '2026-08-05')

    expect(pace.dayCursor).toBe(31)
    expect(pace.points[30].current).toBe(1000)
  })

  it('devolve razão nula quando não há mês anterior com o que comparar', () => {
    const pace = spendingPace([gasto('2026-08-02', 1000)], '2026-08', '2026-08-05')

    expect(pace.ratio).toBeNull()
  })
})

describe('dailySpending', () => {
  const gasto = (date: string, amountCents: number): Transaction => ({
    id: `t-${date}-${amountCents}` as Transaction['id'],
    kind: 'expense',
    date: date as Transaction['date'],
    amountCents,
    description: 'x',
    categoryId: 'alimentacao' as Transaction['categoryId'],
    source: 'manual',
    createdAt: 0,
    updatedAt: 0,
  })

  it('devolve todos os dias do mês, inclusive os sem gasto', () => {
    const resultado = dailySpending([gasto('2026-09-03', 1000)], '2026-09', '2026-09-30')

    expect(resultado.days).toHaveLength(30)
    expect(resultado.days[0]).toEqual({ day: 1, cents: 0, count: 0 })
    expect(resultado.days[2]).toEqual({ day: 3, cents: 1000, count: 1 })
  })

  it('soma vários lançamentos no mesmo dia', () => {
    const resultado = dailySpending(
      [gasto('2026-09-03', 1000), gasto('2026-09-03', 250)],
      '2026-09',
      '2026-09-30',
    )

    expect(resultado.days[2].cents).toBe(1250)
    // A contagem existe para o balão do mapa distinguir uma compra grande de
    // várias pequenas que somam o mesmo.
    expect(resultado.days[2].count).toBe(2)
  })

  it('aponta o maior gasto do mês', () => {
    const resultado = dailySpending(
      [gasto('2026-09-03', 1000), gasto('2026-09-12', 7500)],
      '2026-09',
      '2026-09-30',
    )

    expect(resultado.peak).toEqual({ day: 12, cents: 7500, count: 1 })
  })

  it('não aponta pico em mês sem despesa', () => {
    expect(dailySpending([], '2026-09', '2026-09-30').peak).toBeNull()
  })

  /*
   * A média é por dia decorrido. No dia 5 de um mês de 30, dividir pelos 30
   * diria que está tudo bem quando ainda faltam 25 dias de gasto pela frente.
   */
  it('divide a média pelos dias decorridos, não pelos dias do mês', () => {
    const resultado = dailySpending([gasto('2026-09-01', 5000)], '2026-09', '2026-09-05')

    expect(resultado.dailyAverageCents).toBe(1000)
  })

  it('usa o mês inteiro quando ele já fechou', () => {
    const resultado = dailySpending([gasto('2026-08-01', 3100)], '2026-08', '2026-09-17')

    expect(resultado.dailyAverageCents).toBe(100)
  })

  it('não divide por zero em mês futuro', () => {
    expect(dailySpending([], '2027-01', '2026-09-17').dailyAverageCents).toBe(0)
  })

  it('sabe em que dia da semana o mês começa', () => {
    // 1º de setembro de 2026 é uma terça-feira.
    expect(dailySpending([], '2026-09', '2026-09-17').firstWeekday).toBe(2)
  })
})

describe('categoryComparison', () => {
  const despesa = (date: string, categoryId: string, amountCents: number): Transaction => ({
    id: `c-${date}-${categoryId}-${amountCents}` as Transaction['id'],
    kind: 'expense',
    date: date as Transaction['date'],
    amountCents,
    description: 'x',
    categoryId: categoryId as Transaction['categoryId'],
    source: 'manual',
    createdAt: 0,
    updatedAt: 0,
  })

  it('traz o valor do mês anterior ao lado do atual', () => {
    const resultado = categoryComparison(
      [despesa('2026-09-10', 'alimentacao', 3000), despesa('2026-08-10', 'alimentacao', 2000)],
      DEFAULT_CATEGORIES,
      '2026-09',
    )

    expect(resultado[0].amount).toBe(3000)
    expect(resultado[0].previousCents).toBe(2000)
    expect(resultado[0].changeRatio).toBeCloseTo(0.5)
  })

  it('marca variação negativa quando o gasto caiu', () => {
    const resultado = categoryComparison(
      [despesa('2026-09-10', 'alimentacao', 1000), despesa('2026-08-10', 'alimentacao', 2000)],
      DEFAULT_CATEGORIES,
      '2026-09',
    )

    expect(resultado[0].changeRatio).toBeCloseTo(-0.5)
  })

  /*
   * Categoria nova não tem variação. "Aumentou infinito por cento" não é uma
   * leitura — quem desenha precisa saber que o caso é "não tinha" para dizer
   * isso com palavra em vez de número.
   */
  it('deixa a variação nula quando a categoria não existia no mês anterior', () => {
    const resultado = categoryComparison(
      [despesa('2026-09-10', 'alimentacao', 3000)],
      DEFAULT_CATEGORIES,
      '2026-09',
    )

    expect(resultado[0].previousCents).toBe(0)
    expect(resultado[0].changeRatio).toBeNull()
  })

  it('ordena pelo valor atual, não pela variação', () => {
    const resultado = categoryComparison(
      [
        despesa('2026-09-10', 'alimentacao', 9000),
        despesa('2026-08-10', 'alimentacao', 8000),
        despesa('2026-09-11', 'transporte', 3000),
        despesa('2026-08-11', 'transporte', 100),
      ],
      DEFAULT_CATEGORIES,
      '2026-09',
    )

    // Transporte multiplicou por 30; alimentação ainda vem primeiro.
    expect(resultado[0].groupId).toBe('alimentacao')
    expect(resultado[1].groupId).toBe('transporte')
  })

  it('ignora categoria que só existiu no mês anterior', () => {
    const resultado = categoryComparison(
      [despesa('2026-08-10', 'alimentacao', 2000)],
      DEFAULT_CATEGORIES,
      '2026-09',
    )

    expect(resultado).toHaveLength(0)
  })
})

describe('monthInsight', () => {
  const mov = (
    date: string,
    amountCents: number,
    kind: Transaction['kind'] = 'expense',
  ): Transaction => ({
    id: `m-${date}-${amountCents}-${kind}` as Transaction['id'],
    kind,
    date: date as Transaction['date'],
    amountCents,
    description: 'x',
    categoryId: 'alimentacao' as Transaction['categoryId'],
    source: 'manual',
    createdAt: 0,
    updatedAt: 0,
  })

  const insight = (txs: Transaction[], nome?: string) =>
    monthInsight(txs, DEFAULT_CATEGORIES, '2026-09', nome)

  it('diz que subiu quando subiu, e quanto', () => {
    const r = insight([mov('2026-09-10', 20000), mov('2026-08-10', 10000)])

    expect(r.tone).toBe('bad')
    expect(r.message).toContain('100%')
    expect(r.message).toMatch(/subiram/)
  })

  /*
   * O pior defeito possível desta tela é dizer "dispararam" quando o gasto
   * caiu. Nenhuma checagem de tipo pega isso — só um teste.
   */
  it('diz que caiu quando caiu, e trata como boa notícia', () => {
    const r = insight([mov('2026-09-10', 5000), mov('2026-08-10', 10000)])

    expect(r.tone).toBe('good')
    expect(r.message).toMatch(/caíram/)
    expect(r.message).toContain('50%')
  })

  it('trata variação pequena como mesmo ritmo, nos dois sentidos', () => {
    const subiuPouco = insight([mov('2026-09-10', 10500), mov('2026-08-10', 10000)])
    const caiuPouco = insight([mov('2026-09-10', 9500), mov('2026-08-10', 10000)])

    expect(subiuPouco.tone).toBe('neutral')
    expect(caiuPouco.tone).toBe('neutral')
    expect(subiuPouco.message).toMatch(/mesmo ritmo/)
  })

  it('não inventa comparação quando não há mês anterior', () => {
    const r = insight([mov('2026-09-10', 10000)])

    expect(r.changeRatio).toBeNull()
    expect(r.message).toMatch(/primeiro mês/)
    expect(r.tone).toBe('neutral')
  })

  it('reconhece mês sem nenhuma despesa', () => {
    const r = insight([mov('2026-09-10', 10000, 'income')])

    expect(r.spentCents).toBe(0)
    expect(r.message).toMatch(/[Nn]enhuma despesa/)
  })

  it('ignora receita no cálculo do gasto', () => {
    const r = insight([
      mov('2026-09-10', 10000),
      mov('2026-09-11', 500000, 'income'),
      mov('2026-08-10', 10000),
    ])

    expect(r.spentCents).toBe(10000)
    expect(r.tone).toBe('neutral')
  })

  it('usa o nome quando existe, e continua uma frase quando não existe', () => {
    const com = insight([mov('2026-09-10', 20000), mov('2026-08-10', 10000)], 'Otávio')
    const sem = insight([mov('2026-09-10', 20000), mov('2026-08-10', 10000)])

    expect(com.message.startsWith('Otávio, seus gastos')).toBe(true)
    expect(sem.message.startsWith('Seus gastos')).toBe(true)
  })

  it('aponta a categoria que mais pesou', () => {
    const r = insight([mov('2026-09-10', 20000), mov('2026-08-10', 10000)])

    expect(r.topCategory?.label).toBe('Alimentação')
  })
})

describe('filterTransactions — categorias', () => {
  const lista = [
    tx({ id: 'a', kind: 'expense', amountCents: 100, date: '2026-09-01', categoryId: 'alimentacao' }),
    tx({ id: 'b', kind: 'expense', amountCents: 200, date: '2026-09-02', categoryId: 'transporte' }),
    tx({ id: 'c', kind: 'expense', amountCents: 300, date: '2026-09-03', categoryId: 'lazer' }),
  ]

  it('lista vazia de categorias não recorta nada', () => {
    expect(filterTransactions(lista, EMPTY_FILTERS).map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('aceita várias categorias de uma vez', () => {
    const r = filterTransactions(lista, { ...EMPTY_FILTERS, categoryIds: ['alimentacao', 'lazer'] })
    expect(r.map((t) => t.id)).toEqual(['a', 'c'])
  })

  it('combina categoria com os demais filtros', () => {
    const r = filterTransactions(lista, {
      ...EMPTY_FILTERS,
      categoryIds: ['alimentacao', 'transporte'],
      search: 'x',
      month: '2026-09',
    })
    expect(r).toHaveLength(2)
  })
})

describe('sortTransactions', () => {
  const lista = [
    tx({ id: 'velha-grande', kind: 'income', amountCents: 50000, date: '2026-09-01', createdAt: 1 }),
    tx({ id: 'nova-pequena', kind: 'expense', amountCents: 1000, date: '2026-09-10', createdAt: 2 }),
    tx({ id: 'meio', kind: 'expense', amountCents: 20000, date: '2026-09-05', createdAt: 3 }),
    tx({ id: 'nova-pequena-2', kind: 'expense', amountCents: 1000, date: '2026-09-10', createdAt: 4 }),
  ]
  const ids = (order: Parameters<typeof sortTransactions>[1]) =>
    sortTransactions(lista, order).map((t) => t.id)

  it('data decrescente desempata pelo criado por último', () => {
    expect(ids('date-desc')).toEqual(['nova-pequena-2', 'nova-pequena', 'meio', 'velha-grande'])
  })

  it('data crescente é o espelho exato', () => {
    expect(ids('date-asc')).toEqual(['velha-grande', 'meio', 'nova-pequena', 'nova-pequena-2'])
  })

  it('valor ordena pelo tamanho, sem sinal: receita grande vem primeiro', () => {
    expect(ids('amount-desc')).toEqual(['velha-grande', 'meio', 'nova-pequena-2', 'nova-pequena'])
  })

  it('valor crescente mantém o empate em data decrescente', () => {
    expect(ids('amount-asc')).toEqual(['nova-pequena-2', 'nova-pequena', 'meio', 'velha-grande'])
  })

  it('não altera a lista recebida', () => {
    const antes = lista.map((t) => t.id)
    sortTransactions(lista, 'amount-desc')
    expect(lista.map((t) => t.id)).toEqual(antes)
  })
})

describe('soma por grupo', () => {
  const lista = [
    tx({ kind: 'expense', amountCents: 10000, date: '2026-09-01', categoryId: 'combustivel' }),
    tx({ kind: 'expense', amountCents: 5000, date: '2026-09-02', categoryId: 'estacionamento' }),
    tx({ kind: 'expense', amountCents: 2000, date: '2026-09-03', categoryId: 'transporte' }),
    tx({ kind: 'expense', amountCents: 9000, date: '2026-09-04', categoryId: 'farmacia' }),
  ]

  it('junta as subcategorias no grupo delas', () => {
    const r = spendingByCategory(lista, DEFAULT_CATEGORIES, '2026-09')
    expect(r.map((item) => [item.groupId, item.amount])).toEqual([
      ['transporte', 17000],
      ['saude', 9000],
    ])
    expect(r[1].label).toBe('Saúde e bem-estar')
  })
})

describe('spendingTree', () => {
  const lista = [
    tx({ kind: 'expense', amountCents: 10000, date: '2026-09-01', categoryId: 'combustivel' }),
    tx({ kind: 'expense', amountCents: 5000, date: '2026-09-02', categoryId: 'estacionamento' }),
    tx({ kind: 'expense', amountCents: 3000, date: '2026-09-03', categoryId: 'combustivel' }),
    tx({ kind: 'expense', amountCents: 9000, date: '2026-09-04', categoryId: 'farmacia' }),
    tx({ kind: 'income', amountCents: 99999, date: '2026-09-05', categoryId: 'salario' }),
    tx({ kind: 'expense', amountCents: 77777, date: '2026-08-05', categoryId: 'farmacia' }),
  ]
  const arvore = spendingTree(lista, DEFAULT_CATEGORIES, '2026-09')

  it('põe as subcategorias dentro do grupo, da maior para a menor', () => {
    expect(arvore[0].groupId).toBe('transporte')
    expect(arvore[0].items.map((item) => [item.categoryId, item.amount])).toEqual([
      ['combustivel', 13000],
      ['estacionamento', 5000],
    ])
    expect(arvore[0].items[0].label).toBe('Postos de gasolina')
  })

  it('a soma das subcategorias é o valor do grupo', () => {
    for (const grupo of arvore) {
      expect(grupo.items.reduce((soma, item) => soma + item.amount, 0)).toBe(grupo.amount)
    }
  })

  it('ignora receita e outro mês', () => {
    expect(arvore.map((grupo) => grupo.groupId)).toEqual(['transporte', 'saude'])
    expect(arvore[1].amount).toBe(9000)
  })
})

describe('similarTransactions', () => {
  const alvo = tx({ id: 'alvo', kind: 'income', amountCents: 6, date: '2026-09-18', description: 'Crédito Evento B3 - * Prov * Dividendos 1 Gogl34' })
  const lista = [
    alvo,
    tx({ id: 'a', kind: 'income', amountCents: 6, date: '2026-03-20', description: 'Crédito Evento B3 - * Prov * Dividendos 1 Gogl34' }),
    tx({ id: 'b', kind: 'income', amountCents: 6, date: '2025-12-19', description: 'CREDITO EVENTO B3 - PROV DIVIDENDOS 7 GOGL34' }),
    tx({ id: 'c', kind: 'income', amountCents: 6, date: '2025-09-19', description: 'Crédito Evento B3 - * Prov * Dividendos 1 Gogl34' }),
    tx({ id: 'd', kind: 'income', amountCents: 6, date: '2025-06-19', description: 'Crédito Evento B3 - * Prov * Dividendos 1 Gogl34' }),
    tx({ id: 'outro', kind: 'income', amountCents: 999, date: '2026-09-01', description: 'Salário' }),
    tx({ id: 'estorno', kind: 'expense', amountCents: 6, date: '2026-09-02', description: 'Crédito Evento B3 - * Prov * Dividendos 1 Gogl34' }),
  ]

  it('acha o mesmo estabelecimento, ignorando números e caixa, do mais recente ao mais antigo', () => {
    expect(similarTransactions(alvo, lista).map((t) => t.id)).toEqual(['a', 'b', 'c'])
  })

  it('não inclui a própria transação, outro lugar nem outro tipo', () => {
    const ids = similarTransactions(alvo, lista, 10).map((t) => t.id)
    expect(ids).not.toContain('alvo')
    expect(ids).not.toContain('outro')
    expect(ids).not.toContain('estorno')
  })

  it('descrição sem estabelecimento não tem semelhante', () => {
    const semNome = tx({ id: 'x', kind: 'expense', amountCents: 1, date: '2026-09-01', description: 'PIX 0293' })
    const outro = tx({ id: 'y', kind: 'expense', amountCents: 1, date: '2026-09-02', description: 'PIX 7788' })
    expect(similarTransactions(semNome, [semNome, outro])).toEqual([])
  })
})
