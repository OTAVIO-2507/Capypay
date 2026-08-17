import { describe, expect, it } from 'vitest'
import { DEFAULT_CATEGORIES } from './categories'
import {
  batchFromOfx,
  buildImportCandidates,
  suggestCategory,
  summarizeCandidates,
} from './importing'
import type { Transaction } from './types'
import type { OfxStatement } from '@/lib/ofx'

function extrato(transactions: OfxStatement['transactions'], accountId = '1234') {
  return batchFromOfx({
    account: { id: accountId, bankId: '077', kind: 'checking' },
    transactions,
    start: null,
    end: null,
  })
}

function lancamento(
  fitId: string,
  date: string,
  amountCents: number,
  description = 'Compra',
) {
  return { fitId, date, amountCents, description, type: 'DEBIT' }
}

function existente(partial: Partial<Transaction>): Transaction {
  return {
    id: 't1',
    kind: 'expense',
    description: 'Já lançado',
    amountCents: 1000,
    date: '2026-08-10',
    categoryId: 'outros',
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

describe('buildImportCandidates', () => {
  it('converte o sinal em kind e deixa o valor positivo', () => {
    const candidatos = buildImportCandidates(
      extrato([lancamento('a', '2026-08-15', -4590), lancamento('b', '2026-08-05', 320000)]),
      [],
      DEFAULT_CATEGORIES,
    )

    expect(candidatos[0]).toMatchObject({ kind: 'expense', amountCents: 4590 })
    expect(candidatos[1]).toMatchObject({ kind: 'income', amountCents: 320000 })
  })

  it('compõe o externalId com a conta, para o FITID não colidir entre contas', () => {
    // Bancos reiniciam a numeração por conta: dois "0001" de contas diferentes
    // são compras diferentes, e uma chave só com o FITID fundiria as duas.
    const daConta = buildImportCandidates(extrato([lancamento('0001', '2026-08-01', -100)], '111'), [], DEFAULT_CATEGORIES)
    const doCartao = buildImportCandidates(extrato([lancamento('0001', '2026-08-01', -100)], '222'), [], DEFAULT_CATEGORIES)

    expect(daConta[0].externalId).not.toBe(doCartao[0].externalId)
  })
})

describe('detecção de duplicata', () => {
  it('marca como exata o que já foi importado antes', () => {
    const jaImportado = existente({ externalId: '1234:abc', amountCents: 4590 })

    const [candidato] = buildImportCandidates(
      extrato([lancamento('abc', '2026-08-15', -4590)]),
      [jaImportado],
      DEFAULT_CATEGORIES,
    )

    expect(candidato.duplicate).toBe('exact')
    expect(candidato.duplicateOf).toBe(jaImportado.id)
  })

  /*
   * O caso que a importação encontra na vida real: a pessoa lançou a compra na
   * mão no dia e agora importa o extrato do mês. Não há identificador em comum,
   * só data e valor, e por isso a suspeita nunca vira certeza.
   */
  it('suspeita do lançamento manual de mesmo valor em data próxima', () => {
    const manual = existente({ amountCents: 4590, date: '2026-08-14', externalId: null })

    const [candidato] = buildImportCandidates(
      extrato([lancamento('novo', '2026-08-15', -4590)]),
      [manual],
      DEFAULT_CATEGORIES,
    )

    expect(candidato.duplicate).toBe('possible')
    expect(candidato.duplicateOf).toBe(manual.id)
  })

  it('não suspeita quando a data está longe ou o valor difere', () => {
    const antigo = existente({ amountCents: 4590, date: '2026-07-01' })
    const outroValor = existente({ id: 't2', amountCents: 100, date: '2026-08-15' })

    const [candidato] = buildImportCandidates(
      extrato([lancamento('novo', '2026-08-15', -4590)]),
      [antigo, outroValor],
      DEFAULT_CATEGORIES,
    )

    expect(candidato.duplicate).toBeNull()
  })

  it('não confunde uma entrada com uma saída de mesmo valor', () => {
    // Um estorno e a compra que ele estorna têm o mesmo valor e datas vizinhas.
    const saida = existente({ kind: 'expense', amountCents: 4590, date: '2026-08-15' })

    const [candidato] = buildImportCandidates(
      extrato([lancamento('estorno', '2026-08-15', 4590)]),
      [saida],
      DEFAULT_CATEGORIES,
    )

    expect(candidato.duplicate).toBeNull()
  })
})

describe('suggestCategory', () => {
  const paraDespesa = (texto: string) => suggestCategory(texto, 'expense', DEFAULT_CATEGORIES)

  it('reconhece os estabelecimentos comuns do extrato', () => {
    expect(paraDespesa('IFOOD *RESTAURANTE')).toBe('alimentacao')
    expect(paraDespesa('UBER   *TRIP')).toBe('transporte')
    expect(paraDespesa('DROGARIA SAO PAULO')).toBe('saude')
    expect(paraDespesa('NETFLIX.COM')).toBe('assinaturas')
    expect(paraDespesa('ALUGUEL AGOSTO')).toBe('moradia')
  })

  it('ignora acento e caixa', () => {
    expect(paraDespesa('Farmácia Popular')).toBe('saude')
    expect(paraDespesa('PEDÁGIO AUTOBAN')).toBe('transporte')
  })

  /*
   * O grupo que justifica as palavras terem sido alongadas. Cada uma destas
   * casava com uma regra por acidente quando a lista usava fragmentos curtos, e
   * o erro é do tipo que ninguém percebe: a categoria errada aparece
   * preenchida, com cara de sugestão pensada.
   */
  it('não casa por pedaço de palavra', () => {
    expect(paraDespesa('LOJA 1999 CONFECCOES')).not.toBe('transporte')
    expect(paraDespesa('MAX BURGER')).not.toBe('assinaturas')
    expect(paraDespesa('MULTIMARCAS MODA')).not.toBe('moradia')
    expect(paraDespesa('PRIMEIRA IGREJA')).not.toBe('assinaturas')
  })

  it('cai em Outros quando nada casa', () => {
    expect(paraDespesa('TRANSFERENCIA PARA JOAO')).toBe('outros')
    expect(paraDespesa('')).toBe('outros')
  })

  /*
   * Uma regra de despesa não pode ser aplicada a uma entrada: um estorno da
   * Amazon viraria receita da categoria "Compras", que só existe para despesa e
   * que nenhuma tela do produto sabe somar como entrada.
   */
  it('respeita o que a categoria aceita', () => {
    expect(suggestCategory('AMAZON ESTORNO', 'income', DEFAULT_CATEGORIES)).toBe('outros')
    expect(suggestCategory('SALARIO AGOSTO', 'income', DEFAULT_CATEGORIES)).toBe('salario')
    expect(suggestCategory('SALARIO AGOSTO', 'expense', DEFAULT_CATEGORIES)).toBe('outros')
  })
})

describe('summarizeCandidates', () => {
  it('conta cada situação e soma os dois lados', () => {
    const candidatos = buildImportCandidates(
      extrato([
        lancamento('a', '2026-08-01', -1000),
        lancamento('b', '2026-08-02', -2000),
        lancamento('c', '2026-08-03', 5000),
      ]),
      [existente({ externalId: '1234:a', amountCents: 1000 })],
      DEFAULT_CATEGORIES,
    )

    expect(summarizeCandidates(candidatos)).toEqual({
      total: 3,
      novos: 2,
      jaImportados: 1,
      suspeitos: 0,
      incomeCents: 5000,
      expenseCents: 3000,
    })
  })
})

/**
 * O beco sem saída que este grupo resolve: um lançamento já importado é
 * reconhecido como duplicata e descartado, o que está certo enquanto a origem
 * não tem nada de novo a dizer. Quando ela passa a declarar o parcelamento que
 * antes não vinha, recusar a duplicata deixaria a pessoa sem nenhum caminho.
 */
describe('lançamento que completa o que já existe', () => {
  const comParcela = (accountId = '1234') =>
    batchFromOfx({
      account: { id: accountId, bankId: '077', kind: 'credit_card' },
      transactions: [
        { fitId: 'abc', date: '2026-08-15', amountCents: -41650, description: 'MAGAZINE (3/10)', type: 'DEBIT' },
      ],
      start: null,
      end: null,
    })

  it('aponta o lançamento a completar quando ele não tem série', () => {
    const jaImportado = existente({ externalId: '1234:abc', amountCents: 41650, seriesId: null })

    const [candidato] = buildImportCandidates(comParcela(), [jaImportado], DEFAULT_CATEGORIES)

    expect(candidato.duplicate).toBe('exact')
    expect(candidato.enriches).toBe(jaImportado.id)
  })

  it('não mexe no que já faz parte de uma série', () => {
    // Trocaria uma classificação existente por outra sem ninguém ter pedido.
    const jaEmSerie = existente({
      externalId: '1234:abc',
      amountCents: 41650,
      seriesId: 's1',
      seriesKind: 'installment',
    })

    const [candidato] = buildImportCandidates(comParcela(), [jaEmSerie], DEFAULT_CATEGORIES)

    expect(candidato.enriches).toBeNull()
  })

  it('não aponta nada quando a origem não traz série', () => {
    const semSerie = batchFromOfx({
      account: { id: '1234', bankId: '077', kind: 'checking' },
      transactions: [
        { fitId: 'abc', date: '2026-08-15', amountCents: -1000, description: 'PADARIA', type: 'DEBIT' },
      ],
      start: null,
      end: null,
    })
    const jaImportado = existente({ externalId: '1234:abc', amountCents: 1000 })

    const [candidato] = buildImportCandidates(semSerie, [jaImportado], DEFAULT_CATEGORIES)

    expect(candidato.enriches).toBeNull()
  })
})
