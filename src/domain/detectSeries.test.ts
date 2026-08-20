import { describe, expect, it } from 'vitest'
import {
  detectSeries,
  julgarAssinatura,
  parseInstallmentTag,
  planSeriesForHistory,
  reviewSubscriptionCandidates,
} from './detectSeries'
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
  it('reconhece a assinatura de três cobranças em dia fixo', () => {
    const achados = detectSeries([
      entrada('a', 'GOOGLE ONE SAO PAULO BRA', '2026-06-13', -999),
      entrada('b', 'GOOGLE ONE SAO PAULO BRA', '2026-07-13', -999),
      entrada('c', 'GOOGLE ONE SAO PAULO BRA', '2026-08-13', -999),
    ])

    expect(achados.get('a')?.kind).toBe('subscription')
  })

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

  /*
   * Duas cobranças chegaram a bastar, quando batiam ao centavo e no mesmo dia.
   * O extrato real mostrou o preço: a segunda parcela de uma compra em três
   * vezes bate ao centavo e no mesmo dia, e o IOF de duas compras
   * internacionais também. Só a terceira ocorrência mostra padrão.
   */
  it('não aceita duas ocorrências como prova de recorrência', () => {
    const achados = detectSeries([
      entrada('a', 'SHOEBIZ COMERCIO LTDA GUARULHOS BRA', '2026-06-23', -20999),
      entrada('b', 'SHOEBIZ COMERCIO LTDA GUARULHOS BRA', '2026-07-23', -20999),
    ])

    expect(achados.size).toBe(0)
  })

  /*
   * O caso que motivou a regra do dia do mês: um mercado visitado uma vez por
   * mês, por valor parecido, passava por todos os outros testes. Um mês entre
   * compras e valor parecido é o que uma rotina produz, não o que prova
   * assinatura — quem cobra por assinatura cobra em dia fixo.
   */
  it('não confunde compra mensal de rotina com assinatura', () => {
    const achados = detectSeries([
      entrada('a', 'MERCADO HAPPY F LTDA SAO PAULO BRA', '2026-06-05', -1199),
      entrada('b', 'MERCADO HAPPY F LTDA SAO PAULO BRA', '2026-07-08', -1199),
      entrada('c', 'MERCADO HAPPY F LTDA SAO PAULO BRA', '2026-08-12', -1199),
      entrada('d', 'MERCADO HAPPY F LTDA SAO PAULO BRA', '2026-09-16', -1199),
    ])

    expect(achados.size).toBe(0)
  })

  it('aceita a cobrança que escorrega do fim de um mês para o começo do outro', () => {
    // Dia 31 e dia 1 estão a um dia de distância, e não a trinta: serviço
    // cobrado no fim do mês cai no começo do seguinte quando o mês é curto.
    const achados = detectSeries([
      entrada('a', 'HOSTINGER', '2026-05-31', -3990),
      entrada('b', 'HOSTINGER', '2026-07-01', -3990),
      entrada('c', 'HOSTINGER', '2026-07-31', -3990),
    ])

    expect(achados.get('a')?.kind).toBe('subscription')
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

  it('recusa a variação que a folga antiga deixava passar', () => {
    // Dez, quinze e doze reais no mesmo lugar, em dia fixo: cabia na folga de
    // vinte e cinco por cento e virava assinatura de mercado.
    const achados = detectSeries([
      entrada('a', 'MERCADINHO', '2026-06-10', -1000),
      entrada('b', 'MERCADINHO', '2026-07-10', -1500),
      entrada('c', 'MERCADINHO', '2026-08-10', -1200),
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

/**
 * A reclassificação do que já está gravado. Existe porque a detecção normal só
 * alcança o que passa pela importação: quem importou antes dela existir ficou
 * sem caminho de volta, já que reimportar esbarra na deduplicação — que está
 * certa em reconhecer os lançamentos como já existentes.
 */
describe('planSeriesForHistory', () => {
  const gravada = (id: string, description: string, date: string, amountCents = 3990) => ({
    id,
    kind: 'expense' as const,
    description,
    amountCents,
    date,
    categoryId: 'outros',
    goalId: null,
    accountId: null,
    source: 'imported' as const,
    externalId: `e${id}`,
    seriesId: null,
    seriesKind: null,
    installment: null,
    notes: null,
    createdAt: 0,
    updatedAt: 0,
  })

  it('agrupa as cobranças repetidas num plano de assinatura', () => {
    const planos = planSeriesForHistory([
      gravada('1', 'NETFLIX.COM', '2026-06-10'),
      gravada('2', 'NETFLIX.COM', '2026-07-10'),
      gravada('3', 'NETFLIX.COM', '2026-08-10'),
    ])

    expect(planos).toHaveLength(1)
    expect(planos[0].kind).toBe('subscription')
    expect(planos[0].transactionIds).toEqual(['1', '2', '3'])
  })

  it('guarda a posição declarada de cada parcela', () => {
    const planos = planSeriesForHistory([
      gravada('1', 'NOTEBOOK (1/10)', '2026-07-15', 41650),
      gravada('2', 'NOTEBOOK (2/10)', '2026-08-15', 41650),
    ])

    expect(planos[0].kind).toBe('installment')
    expect(planos[0].label).toBe('NOTEBOOK')
    expect(planos[0].indexById['2']).toEqual({ index: 2, total: 10 })
  })

  /*
   * O defeito que trouxe compra parcelada de volta como assinatura.
   *
   * O "3 de 8" chega da Pluggy em campo próprio e é gravado no lançamento; o
   * Inter, entre outros, não repete a parcela na descrição. Reconhecer de novo
   * sem reler esse campo perdia a única evidência que existia, e o que sobrava
   * era uma cobrança de mesmo valor, no mesmo dia, todo mês — a descrição
   * exata de uma assinatura.
   */
  it('relê a parcela declarada pelo banco, mesmo sem ela na descrição', () => {
    const comParcela = (id: string, date: string, index: number) => ({
      ...gravada(id, 'DORINHOS - LOJA 42 - D GUARULHOS BRA', date, 9935),
      installment: { index, total: 8 },
    })

    const planos = planSeriesForHistory([
      comParcela('1', '2026-06-22', 1),
      comParcela('2', '2026-07-22', 2),
      comParcela('3', '2026-08-22', 3),
    ])

    expect(planos).toHaveLength(1)
    expect(planos[0].kind).toBe('installment')
    expect(planos[0].indexById['3']).toEqual({ index: 3, total: 8 })
  })

  /*
   * Uma série cadastrada à mão já respondeu essa pergunta pela vontade de quem
   * cadastrou. Reclassificar por cima trocaria uma decisão explícita por um
   * palpite, e o palpite não tem como estar mais certo que a decisão.
   */
  it('não mexe no que já faz parte de uma série', () => {
    const jaEmSerie = [
      { ...gravada('1', 'NETFLIX.COM', '2026-06-10'), seriesId: 's1', seriesKind: 'subscription' as const },
      { ...gravada('2', 'NETFLIX.COM', '2026-07-10'), seriesId: 's1', seriesKind: 'subscription' as const },
      { ...gravada('3', 'NETFLIX.COM', '2026-08-10'), seriesId: 's1', seriesKind: 'subscription' as const },
    ]

    expect(planSeriesForHistory(jaEmSerie)).toEqual([])
  })

  it('ignora receita, que nunca é assinatura', () => {
    const salarios = ['1', '2', '3'].map((id, i) => ({
      ...gravada(id, 'SALARIO', `2026-0${6 + i}-05`, 400000),
      kind: 'income' as const,
    }))

    expect(planSeriesForHistory(salarios)).toEqual([])
  })
})

/**
 * O grupo que existe porque a leitura por texto não bastava.
 *
 * A Pluggy entrega posição e total de parcela em campo próprio, e vários bancos
 * não repetem isso na descrição. Depender do texto acertava em alguns e falhava
 * calado em outros, e falhar calado aqui é a tela de Parcelamentos vazia sem
 * nenhuma pista do motivo.
 */
describe('parcelamento declarado pela origem', () => {
  const comDeclaracao = (
    key: string,
    description: string,
    date: string,
    index: number,
    total: number,
  ): ImportEntry => ({
    key,
    description,
    date,
    amountCents: -41650,
    declaredInstallment: { index, total },
  })

  it('reconhece mesmo sem nenhuma marca na descrição', () => {
    const achados = detectSeries([comDeclaracao('a', 'MAGAZINE LUIZA', '2026-08-15', 3, 10)])

    expect(achados.get('a')).toMatchObject({ kind: 'installment', index: 3, total: 10 })
  })

  it('agrupa as parcelas da mesma compra pelo nome e pelo total', () => {
    const achados = detectSeries([
      comDeclaracao('a', 'MAGAZINE LUIZA', '2026-06-15', 1, 10),
      comDeclaracao('b', 'MAGAZINE LUIZA', '2026-07-15', 2, 10),
    ])

    expect(achados.get('a')?.groupKey).toBe(achados.get('b')?.groupKey)
  })

  it('mantém a descrição inteira como nome da compra', () => {
    // Sem sufixo a remover: o total vive em campo próprio, não no texto.
    const achados = detectSeries([comDeclaracao('a', 'MAGAZINE LUIZA', '2026-08-15', 3, 10)])

    expect(achados.get('a')?.label).toBe('MAGAZINE LUIZA')
  })

  it('ignora a declaração de compra à vista', () => {
    // Bancos preenchem 1/1 em compra à vista. Aceitar isso encheria a tela de
    // Parcelamentos de compras de uma parcela só, que não são parcelamento.
    const achados = detectSeries([comDeclaracao('a', 'PADARIA', '2026-08-15', 1, 1)])

    expect(achados.size).toBe(0)
  })

  it('a declaração vence o texto quando os dois existem', () => {
    // Uma descrição que casaria como "1/2" mas cuja origem declara 4 de 12.
    const achados = detectSeries([
      { ...comDeclaracao('a', 'LOJA 1/2', '2026-08-15', 4, 12) },
    ])

    expect(achados.get('a')).toMatchObject({ index: 4, total: 12 })
  })
})

/**
 * Os defeitos que só aparecem com histórico longo, e que por isso passaram por
 * todos os testes de três meses. Quem importa dois anos traz a evidência mais
 * forte que existe de recorrência, e era justamente esse caso que a detecção
 * descartava.
 */
describe('detectSeries com histórico longo', () => {
  const mensal = (key: string, mes: number, ano: number, cents: number) => ({
    key,
    description: 'NETFLIX.COM',
    date: `${ano}-${String(mes).padStart(2, '0')}-10`,
    amountCents: -cents,
  })

  it('sobrevive a um mês sem cobrança no meio da série', () => {
    // Falha de cobrança acontece. Antes, um único intervalo de dois meses
    // descartava dois anos de evidência.
    const doisAnos = [
      mensal('a', 1, 2026, 3990),
      mensal('b', 2, 2026, 3990),
      // março não veio
      mensal('d', 4, 2026, 3990),
      mensal('e', 5, 2026, 3990),
      mensal('f', 6, 2026, 3990),
    ]

    expect(detectSeries(doisAnos).get('a')?.kind).toBe('subscription')
  })

  it('aceita o reajuste acumulado de um histórico longo', () => {
    // De R$ 39,90 para R$ 44,90 são 11% entre a primeira e a última cobrança, e
    // nenhum salto entre vizinhas. Medir pelos extremos descartava as
    // assinaturas mais antigas, que são as mais bem documentadas.
    const comReajuste = [
      mensal('a', 1, 2026, 3990),
      mensal('b', 2, 2026, 3990),
      mensal('c', 3, 2026, 4190),
      mensal('d', 4, 2026, 4190),
      mensal('e', 5, 2026, 4490),
      mensal('f', 6, 2026, 4490),
    ]

    expect(detectSeries(comReajuste).get('a')?.kind).toBe('subscription')
  })

  it('continua recusando o salto brusco entre cobranças vizinhas', () => {
    const comSalto = [
      mensal('a', 1, 2026, 1000),
      mensal('b', 2, 2026, 1000),
      mensal('c', 3, 2026, 9000),
      mensal('d', 4, 2026, 1000),
    ]

    expect(detectSeries(comSalto).size).toBe(0)
  })

  it('continua recusando frequência num lugar só', () => {
    // Quase nenhum intervalo é de um mês, então a maioria não se sustenta.
    const noMesmoMes = [
      { key: 'a', description: 'RESTAURANTE X', date: '2026-08-03', amountCents: -5000 },
      { key: 'b', description: 'RESTAURANTE X', date: '2026-08-14', amountCents: -5000 },
      { key: 'c', description: 'RESTAURANTE X', date: '2026-08-27', amountCents: -5000 },
    ]

    expect(detectSeries(noMesmoMes).size).toBe(0)
  })
})

/*
 * A recusa precisa ser dizível. "A tela está vazia" não dá para investigar, e a
 * alternativa é afrouxar a régua no escuro até a linha aparecer.
 */
describe('julgarAssinatura', () => {
  it('nomeia o que faltou em cada recusa', () => {
    const mesmoLugar = (datas: string[], valores: number[]) =>
      datas.map((data, i) => entrada(String(i), 'LUGAR', data, valores[i]))

    expect(julgarAssinatura(mesmoLugar(['2026-08-10'], [-1000]))).toBe('poucas')

    expect(
      julgarAssinatura(mesmoLugar(['2026-08-03', '2026-08-14', '2026-08-27'], [-1000, -1000, -1000])),
    ).toBe('intervalo')

    // Intervalos todos dentro da janela mensal, mas o dia escorrega a cada
    // visita: é o desenho de quem vai ao mesmo lugar "uma vez por mês".
    expect(
      julgarAssinatura(
        mesmoLugar(
          ['2026-06-05', '2026-07-08', '2026-08-12', '2026-09-16'],
          [-1000, -1000, -1000, -1000],
        ),
      ),
    ).toBe('dia')

    expect(
      julgarAssinatura(mesmoLugar(['2026-06-10', '2026-07-10', '2026-08-10'], [-1000, -1500, -1200])),
    ).toBe('valor')

    expect(
      julgarAssinatura(mesmoLugar(['2026-06-10', '2026-07-10', '2026-08-10'], [-1000, -1000, -1000])),
    ).toBeNull()
  })
})

describe('reviewSubscriptionCandidates', () => {
  const gravado = (id: string, description: string, date: string, amountCents: number) => ({
    id,
    kind: 'expense' as const,
    description,
    amountCents,
    date,
    categoryId: 'outros',
    goalId: null,
    accountId: null,
    source: 'imported' as const,
    externalId: `e${id}`,
    seriesId: null,
    seriesKind: null,
    installment: null,
    notes: null,
    createdAt: 0,
    updatedAt: 0,
  })

  it('lista a repetição recusada com o motivo, e ignora a que virou série', () => {
    const recusas = reviewSubscriptionCandidates([
      gravado('1', 'MERCADO HAPPY', '2026-06-05', 1199),
      gravado('2', 'MERCADO HAPPY', '2026-07-08', 1199),
      gravado('3', 'MERCADO HAPPY', '2026-08-12', 1199),
      gravado('4', 'MERCADO HAPPY', '2026-09-16', 1199),
      gravado('5', 'NETFLIX.COM', '2026-06-10', 3990),
      gravado('6', 'NETFLIX.COM', '2026-07-10', 3990),
      gravado('7', 'NETFLIX.COM', '2026-08-10', 3990),
    ])

    expect(recusas).toHaveLength(1)
    expect(recusas[0]).toMatchObject({ count: 4, reason: 'dia' })
  })

  it('não reclama de compra que aconteceu uma vez só', () => {
    expect(reviewSubscriptionCandidates([gravado('1', 'PADARIA', '2026-08-10', 900)])).toEqual([])
  })
})
