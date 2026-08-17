import { describe, expect, it } from 'vitest'
import { detectSeries, parseInstallmentTag } from './detectSeries'
import type { ImportEntry } from './importing'

function entrada(key: string, description: string, date: string, amountCents = -10000): ImportEntry {
  return { key, description, date, amountCents }
}

describe('parseInstallmentTag', () => {
  it('lê as formas como banco brasileiro escreve parcela', () => {
    expect(parseInstallmentTag('NOTEBOOK DELL (3/10)')).toMatchObject({ index: 3, total: 10 })
    expect(parseInstallmentTag('MAGAZINE PARC 02/06')).toMatchObject({ index: 2, total: 6 })
    expect(parseInstallmentTag('SOFA PARCELA 1 DE 12')).toMatchObject({ index: 1, total: 12 })
    expect(parseInstallmentTag('CELULAR 5/5')).toMatchObject({ index: 5, total: 5 })
  })

  it('devolve a descrição sem a marca, que é o nome da compra', () => {
    expect(parseInstallmentTag('NOTEBOOK DELL (3/10)')?.label).toBe('NOTEBOOK DELL')
    expect(parseInstallmentTag('MAGAZINE PARC 02/06')?.label).toBe('MAGAZINE')
  })

  it('marca como ambígua a escrita de dois números soltos', () => {
    // Quem decide se aceita é detectSeries, que vê o extrato inteiro.
    expect(parseInstallmentTag('NOTEBOOK (3/10)')?.explicit).toBe(true)
    expect(parseInstallmentTag('MAGAZINE PARC 02/06')?.explicit).toBe(true)
    expect(parseInstallmentTag('CELULAR 5/5')?.explicit).toBe(false)
  })

  it('recusa números que não formam parcela', () => {
    expect(parseInstallmentTag('COMPRA 12/10')).toBeNull()
    expect(parseInstallmentTag('COMPRA 0/10')).toBeNull()
    expect(parseInstallmentTag('COMPRA 1/1')).toBeNull()
    expect(parseInstallmentTag('MERCADO')).toBeNull()
    expect(parseInstallmentTag('')).toBeNull()
  })
})

describe('detectSeries com parcelamentos', () => {
  it('reconhece a partir de uma única ocorrência', () => {
    // O "3/10" é declaração do banco: existem dez, mesmo que só uma tenha caído
    // no período importado. Exigir uma segunda seria pedir prova do que veio
    // escrito.
    const achados = detectSeries([entrada('a', 'NOTEBOOK (3/10)', '2026-08-15')])

    expect(achados.get('a')).toMatchObject({ kind: 'installment', index: 3, total: 10 })
  })

  it('agrupa as parcelas da mesma compra', () => {
    const achados = detectSeries([
      entrada('a', 'NOTEBOOK DELL (3/10)', '2026-06-15'),
      entrada('b', 'NOTEBOOK DELL (4/10)', '2026-07-15'),
      entrada('c', 'NOTEBOOK DELL (5/10)', '2026-08-15'),
    ])

    const chaves = new Set(['a', 'b', 'c'].map((id) => achados.get(id)?.groupKey))
    expect(chaves.size).toBe(1)
  })

  /*
   * O grupo que impede a detecção de inventar dívida. "PIX 05/12" é cinco de
   * dezembro, e lido como parcela viraria uma compra parcelada em doze vezes
   * que nunca existiu, dentro da tela que responde "quanto eu ainda devo".
   * Uma linha sozinha não desfaz a ambiguidade, então é preciso outra evidência.
   */
  it('ignora dois números soltos que podem ser data', () => {
    const achados = detectSeries([entrada('a', 'PIX ENVIADO 05/12', '2026-08-15')])

    expect(achados.size).toBe(0)
  })

  it('aceita dois números soltos quando o total não cabe em um mês', () => {
    // Não existe mês vinte e quatro, então "3/24" só pode ser parcela.
    const achados = detectSeries([entrada('a', 'GELADEIRA 3/24', '2026-08-15')])

    expect(achados.get('a')).toMatchObject({ kind: 'installment', total: 24 })
  })

  it('aceita dois números soltos quando a compra se repete', () => {
    // Uma data não reaparece com o mesmo par de números no mês seguinte; uma
    // parcela reaparece, e é isso que desfaz a ambiguidade.
    const achados = detectSeries([
      entrada('a', 'CELULAR 1/6', '2026-06-15'),
      entrada('b', 'CELULAR 2/6', '2026-07-15'),
    ])

    expect(achados.get('a')?.kind).toBe('installment')
    expect(achados.get('b')?.kind).toBe('installment')
  })

  it('separa duas compras no mesmo lugar com totais diferentes', () => {
    // Mesma loja, duas compras: uma em 3x e outra em 10x. Somá-las numa série
    // só produziria uma compra parcelada que nunca existiu.
    const achados = detectSeries([
      entrada('a', 'MAGAZINE (1/3)', '2026-07-10'),
      entrada('b', 'MAGAZINE (1/10)', '2026-07-20'),
    ])

    expect(achados.get('a')?.groupKey).not.toBe(achados.get('b')?.groupKey)
  })
})

describe('detectSeries com assinaturas', () => {
  it('reconhece cobrança mensal de mesmo valor', () => {
    const achados = detectSeries([
      entrada('a', 'NETFLIX.COM', '2026-06-10', -3990),
      entrada('b', 'NETFLIX.COM', '2026-07-10', -3990),
      entrada('c', 'NETFLIX.COM', '2026-08-10', -3990),
    ])

    expect(achados.get('a')).toMatchObject({ kind: 'subscription' })
    expect(achados.get('c')?.groupKey).toBe(achados.get('a')?.groupKey)
  })

  it('tolera reajuste pequeno', () => {
    const achados = detectSeries([
      entrada('a', 'SPOTIFY', '2026-06-10', -2190),
      entrada('b', 'SPOTIFY', '2026-07-10', -2190),
      entrada('c', 'SPOTIFY', '2026-08-10', -2250),
    ])

    expect(achados.get('a')?.kind).toBe('subscription')
  })

  it('não aceita duas ocorrências como prova de recorrência', () => {
    const achados = detectSeries([
      entrada('a', 'ACADEMIA', '2026-07-10', -9900),
      entrada('b', 'ACADEMIA', '2026-08-10', -9900),
    ])

    expect(achados.size).toBe(0)
  })

  /*
   * Três idas ao mesmo restaurante não são três meses de assinatura. Sem a
   * exigência de meses seguidos, todo lugar frequentado viraria assinatura, e a
   * projeção anual da tela multiplicaria por doze um gasto que não se repete.
   */
  it('não confunde frequência com recorrência', () => {
    const achados = detectSeries([
      entrada('a', 'RESTAURANTE X', '2026-08-03', -5000),
      entrada('b', 'RESTAURANTE X', '2026-08-14', -5000),
      entrada('c', 'RESTAURANTE X', '2026-08-27', -5000),
    ])

    expect(achados.size).toBe(0)
  })

  it('não aceita valores muito diferentes', () => {
    const achados = detectSeries([
      entrada('a', 'PADARIA', '2026-06-10', -1000),
      entrada('b', 'PADARIA', '2026-07-10', -8000),
      entrada('c', 'PADARIA', '2026-08-10', -3000),
    ])

    expect(achados.size).toBe(0)
  })

  /*
   * Salário é a cobrança mais regular que existe num extrato, e é o oposto de
   * uma despesa recorrente. Sem esta guarda ele entraria em Assinaturas, cuja
   * projeção anual passaria a somar receita como se fosse custo.
   */
  it('nunca classifica entrada de dinheiro como assinatura', () => {
    const achados = detectSeries([
      entrada('a', 'SALARIO', '2026-06-05', 400000),
      entrada('b', 'SALARIO', '2026-07-05', 400000),
      entrada('c', 'SALARIO', '2026-08-05', 400000),
    ])

    expect(achados.size).toBe(0)
  })

  /*
   * Uma parcela também se repete todo mês pelo mesmo valor. Se ela caísse nos
   * dois lados, Parcelamentos e Assinaturas mostrariam a mesma compra, cada uma
   * respondendo uma pergunta errada sobre ela.
   */
  it('não classifica parcelamento também como assinatura', () => {
    const achados = detectSeries([
      entrada('a', 'NOTEBOOK (1/10)', '2026-06-15', -41650),
      entrada('b', 'NOTEBOOK (2/10)', '2026-07-15', -41650),
      entrada('c', 'NOTEBOOK (3/10)', '2026-08-15', -41650),
    ])

    expect([...achados.values()].every((hint) => hint.kind === 'installment')).toBe(true)
  })

  it('agrupa ignorando acento, caixa e números que variam', () => {
    const achados = detectSeries([
      entrada('a', 'ACADEMIA SÃO PAULO 001', '2026-06-10', -9900),
      entrada('b', 'academia sao paulo 002', '2026-07-10', -9900),
      entrada('c', 'ACADEMIA SAO PAULO 003', '2026-08-10', -9900),
    ])

    expect(achados.get('a')?.kind).toBe('subscription')
    expect(achados.get('c')?.groupKey).toBe(achados.get('a')?.groupKey)
  })
})
