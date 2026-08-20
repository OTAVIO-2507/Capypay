import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from './categories'
import { installmentPurchases, installmentSummary } from './installments'
import type { Transaction } from './types'

function tx(
  partial: Partial<Transaction> & Pick<Transaction, 'kind' | 'amountCents' | 'date'>,
): Transaction {
  return {
    id: Math.random().toString(36).slice(2),
    description: 'x',
    categoryId: 'compras',
    goalId: null,
    accountId: null,
    source: 'manual',
    externalId: null,
    seriesId: null,
    seriesKind: null,
    installment: null,
    notes: null,
    createdAt: 0,
    updatedAt: 0,
    ...partial,
  }
}

/** Uma compra parcelada, como `expandRecurrence` produz. */
function compra(
  seriesId: string,
  description: string,
  parcelaCents: number,
  meses: string[],
  dia = '10',
): Transaction[] {
  return meses.map((mes, index) =>
    tx({
      kind: 'expense',
      amountCents: parcelaCents,
      date: `${mes}-${dia}`,
      description: `${description} (${index + 1}/${meses.length})`,
      seriesId,
      seriesKind: 'installment',
      installment: { index: index + 1, total: meses.length },
    }),
  )
}

const HOJE = '2026-08-14'

describe('installmentPurchases', () => {
  it('soma o total, o pago e o que falta', () => {
    const transactions = compra('c1', 'Sofá', 32000, ['2026-06', '2026-07', '2026-08', '2026-09'])

    const [sofa] = installmentPurchases(transactions, DEFAULT_CATEGORIES, HOJE)

    expect(sofa.label).toBe('Sofá')
    expect(sofa.totalCents).toBe(128000)
    expect(sofa.paidCents).toBe(96000)
    expect(sofa.remainingCents).toBe(32000)
    expect(sofa.paidCount).toBe(3)
    expect(sofa.totalCount).toBe(4)
    expect(sofa.next).toBe('2026-09-10')
    expect(sofa.done).toBe(false)
    // O nome da categoria vem resolvido do catálogo, e não do id cru: é ele
    // que a compra aberta exibe, e "compras" minúsculo na tela seria o
    // identificador vazando para fora do domínio.
    expect(sofa.categoryName).toBe('Compras')
  })

  it('marca como terminada a compra sem parcela em aberto', () => {
    const transactions = compra('c1', 'Notebook', 50000, ['2026-04', '2026-05', '2026-06'])

    const [notebook] = installmentPurchases(transactions, DEFAULT_CATEGORIES, HOJE)

    expect(notebook.done).toBe(true)
    expect(notebook.next).toBeNull()
    expect(notebook.remainingCents).toBe(0)
    expect(notebook.progress).toBe(1)
  })

  it('não confunde assinatura com parcelamento', () => {
    const assinatura = compra('a1', 'Streaming', 5000, ['2026-08', '2026-09']).map((item) => ({
      ...item,
      seriesKind: 'subscription' as const,
    }))

    expect(installmentPurchases(assinatura, DEFAULT_CATEGORIES, HOJE)).toEqual([])
  })

  it('mede o progresso pelo valor, e não pela contagem de parcelas', () => {
    // Entrada maior que as duas seguintes: 3 de 4 parcelas pagas seriam 75%,
    // mas em dinheiro já foram 90%.
    const transactions = compra('c1', 'Viagem', 10000, ['2026-06', '2026-07', '2026-08', '2026-09'])
    transactions[0] = { ...transactions[0], amountCents: 70000 }

    const [viagem] = installmentPurchases(transactions, DEFAULT_CATEGORIES, HOJE)

    expect(viagem.progress).toBeCloseTo(0.9, 5)
  })

  it('põe as em andamento antes das terminadas', () => {
    const andando = compra('c1', 'Sofá', 32000, ['2026-07', '2026-08', '2026-09'])
    const terminada = compra('c2', 'Notebook', 50000, ['2026-04', '2026-05'])

    const ordem = installmentPurchases(
      [...terminada, ...andando],
      DEFAULT_CATEGORIES,
      HOJE,
    ).map((item) => item.label)

    expect(ordem).toEqual(['Sofá', 'Notebook'])
  })
})

describe('installmentSummary', () => {
  it('conta só o que está em andamento', () => {
    const andando = compra('c1', 'Sofá', 32000, ['2026-07', '2026-08', '2026-09'])
    const terminada = compra('c2', 'Notebook', 50000, ['2026-04', '2026-05'])

    const resumo = installmentSummary(
      installmentPurchases([...andando, ...terminada], DEFAULT_CATEGORIES, HOJE),
    )

    expect(resumo.ongoing).toBe(1)
    expect(resumo.totalCents).toBe(96000)
    expect(resumo.paidCents).toBe(64000)
    expect(resumo.remainingCents).toBe(32000)
    expect(resumo.lastMonth).toBe('2026-09-10')
  })

  it('devolve zeros e nenhuma data quando nada está em andamento', () => {
    const terminada = compra('c2', 'Notebook', 50000, ['2026-04', '2026-05'])

    const resumo = installmentSummary(
      installmentPurchases(terminada, DEFAULT_CATEGORIES, HOJE),
    )

    expect(resumo).toEqual({
      ongoing: 0,
      totalCents: 0,
      paidCents: 0,
      remainingCents: 0,
      progress: 0,
      lastMonth: null,
    })
  })
})

describe('as parcelas de uma compra', () => {
  it('lista cada uma com posição, data, valor e se já passou', () => {
    const transactions = compra('c1', 'Sofá', 32000, ['2026-07', '2026-08', '2026-09'])

    const [sofa] = installmentPurchases(transactions, DEFAULT_CATEGORIES, HOJE)

    expect(sofa.parcels).toHaveLength(3)
    expect(sofa.parcels.map((p) => [p.index, p.date, p.paid])).toEqual([
      [1, '2026-07-10', true],
      [2, '2026-08-10', true],
      [3, '2026-09-10', false],
    ])
    expect(sofa.parcels[0].amountCents).toBe(32000)
  })

  it('numera pela ordem de data, e não pelo índice gravado', () => {
    // Uma parcela apagada deixa buraco em `installment.index`; a lista na tela
    // não pode herdar esse buraco.
    const transactions = compra('c1', 'Sofá', 32000, ['2026-07', '2026-08', '2026-09']).filter(
      (item) => item.installment?.index !== 2,
    )

    const [sofa] = installmentPurchases(transactions, DEFAULT_CATEGORIES, HOJE)

    expect(sofa.parcels.map((p) => p.index)).toEqual([1, 2])
  })

  it('usa o valor de cada lançamento, e não o total dividido', () => {
    const transactions = compra('c1', 'Viagem', 10000, ['2026-07', '2026-08', '2026-09'])
    transactions[0] = { ...transactions[0], amountCents: 50000 }

    const [viagem] = installmentPurchases(transactions, DEFAULT_CATEGORIES, HOJE)

    expect(viagem.parcels.map((p) => p.amountCents)).toEqual([50000, 10000, 10000])
  })
})

/**
 * O grupo que existe por causa do outro lado do mesmo defeito: uma compra
 * parcelada importada chega com só as parcelas que caíram no período. Exigir
 * duas descartava a compra inteira, e contar as presentes dizia "1 de 1" sobre
 * uma dívida de dez vezes.
 */
describe('compra parcelada vinda de importação, com parcelas ausentes', () => {
  const parcela = (mes: string, index: number) =>
    tx({
      kind: 'expense',
      amountCents: 41650,
      date: `${mes}-15`,
      description: 'NOTEBOOK DELL',
      seriesId: 'imp1',
      seriesKind: 'installment',
      installment: { index, total: 10 },
      source: 'imported',
    })

  it('reconhece a compra mesmo com uma parcela só', () => {
    const [notebook] = installmentPurchases([parcela('2026-08', 3)], DEFAULT_CATEGORIES, HOJE)

    expect(notebook).toBeDefined()
    expect(notebook.totalCount).toBe(10)
  })

  it('usa o total declarado pelo banco para dizer quanto falta', () => {
    // Três parcelas em mãos, dez na vida real. Somar só o que temos responderia
    // um terço da dívida como se fosse a dívida inteira.
    const compras = installmentPurchases(
      [parcela('2026-06', 1), parcela('2026-07', 2), parcela('2026-08', 3)],
      DEFAULT_CATEGORIES,
      HOJE,
    )

    const [notebook] = compras
    expect(notebook.totalCount).toBe(10)
    expect(notebook.totalCents).toBe(416500)
    // HOJE é 14 de agosto, e a terceira parcela cai no dia 15: ainda não venceu.
    expect(notebook.paidCount).toBe(2)
    expect(notebook.paidCents).toBe(83300)
    expect(notebook.remainingCents).toBe(333200)
    expect(notebook.done).toBe(false)
  })

  it('preserva a posição declarada de cada parcela', () => {
    // Renumerar densamente aqui renomearia a parcela 5 de alguém para 1.
    const [notebook] = installmentPurchases(
      [parcela('2026-07', 5), parcela('2026-08', 6)],
      DEFAULT_CATEGORIES,
      HOJE,
    )

    const reais = notebook.parcels.filter((p) => !p.projected)
    expect(reais.map((p) => p.index)).toEqual([5, 6])
  })

  /*
   * A lista completa é o que responde a pergunta da página. Mostrar três linhas
   * de uma compra em oito, sem dizer onde estão as outras cinco, é responder
   * "quanto falta" escondendo justamente o que falta.
   */
  it('projeta as parcelas que ainda não existem no histórico', () => {
    const [notebook] = installmentPurchases(
      [parcela('2026-07', 5), parcela('2026-08', 6)],
      DEFAULT_CATEGORIES,
      HOJE,
    )

    expect(notebook.parcels).toHaveLength(10)
    expect(notebook.parcels.map((p) => p.index)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])
    // As duas reais continuam distinguíveis das projetadas: uma pode ser
    // conferida contra a fatura, a outra é conta nossa.
    expect(notebook.parcels.filter((p) => p.projected)).toHaveLength(8)
  })

  it('projeta as datas de mês em mês a partir da última conhecida', () => {
    const [notebook] = installmentPurchases(
      [parcela('2026-07', 5), parcela('2026-08', 6)],
      DEFAULT_CATEGORIES,
      HOJE,
    )

    const setima = notebook.parcels.find((p) => p.index === 7)
    expect(setima?.date).toBe('2026-09-15')
    expect(setima?.paid).toBe(false)
  })

  /*
   * "Termina em" saía da última parcela importada, e a última importada não é a
   * última da compra: o extrato acaba, a dívida não. A tela anunciava o fim do
   * parcelamento para o mês em que o período pedido terminava.
   */
  it('termina na última parcela de verdade, e não na última importada', () => {
    const [notebook] = installmentPurchases(
      [parcela('2026-07', 5), parcela('2026-08', 6)],
      DEFAULT_CATEGORIES,
      HOJE,
    )

    expect(notebook.lastDate).toBe('2026-12-15')
    expect(notebook.next).toBe('2026-08-15')
    expect(notebook.done).toBe(false)
  })

  it('continua fechando o buraco quando a compra é do próprio app', () => {
    // Numa compra cadastrada aqui todas as parcelas nasceram juntas, então uma
    // ausência é exclusão deliberada e a lista deve fechar. É `source` que
    // separa os dois casos.
    const transactions = compra('c1', 'Sofá', 32000, ['2026-07', '2026-08', '2026-09']).filter(
      (item) => item.installment?.index !== 2,
    )

    const [sofa] = installmentPurchases(transactions, DEFAULT_CATEGORIES, HOJE)

    expect(sofa.parcels.map((p) => p.index)).toEqual([1, 2])
    expect(sofa.totalCents).toBe(64000)
  })
})

/*
 * O contrato entre "É parcelamento" e esta tela.
 *
 * A conversão é a saída para o caso em que o banco não declara a parcela e a
 * detecção classifica a compra como assinatura — as duas cobram o mesmo valor,
 * no mesmo dia, todo mês. Ela grava posição e total nos lançamentos que já
 * existem, e é aqui que se confere se o que ela grava chega inteiro na tela.
 */
describe('série convertida de assinatura para compra parcelada', () => {
  /** O que `convertToInstallment` grava: posição pela ordem das datas. */
  function convertida(total: number, meses: string[]): Transaction[] {
    return meses.map((mes, index) =>
      tx({
        kind: 'expense',
        amountCents: 9935,
        date: `${mes}-22`,
        description: 'dorinhos - loja 42 - d guarulhos bra',
        source: 'imported',
        seriesId: 's1',
        seriesKind: 'installment',
        installment: { index: index + 1, total },
      }),
    )
  }

  it('mostra as parcelas que faltam quando o total informado é maior', () => {
    const [compra] = installmentPurchases(
      convertida(8, ['2026-06', '2026-07', '2026-08']),
      DEFAULT_CATEGORIES,
      HOJE,
    )

    expect(compra.totalCount).toBe(8)
    expect(compra.parcels).toHaveLength(8)
    expect(compra.parcels.filter((parcela) => parcela.projected)).toHaveLength(5)
    expect(compra.totalCents).toBe(9935 * 8)
    expect(compra.done).toBe(false)
  })

  it('fecha a compra quando o total informado é o que já existe', () => {
    const [compra] = installmentPurchases(
      convertida(3, ['2026-05', '2026-06', '2026-07']),
      DEFAULT_CATEGORIES,
      HOJE,
    )

    expect(compra.totalCount).toBe(3)
    expect(compra.remainingCents).toBe(0)
    expect(compra.done).toBe(true)
  })
})
