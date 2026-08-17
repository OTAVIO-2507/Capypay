import type { ImportEntry } from './importing'
import type { Transaction } from './types'

/**
 * Reconhece parcelamentos e assinaturas dentro de um extrato.
 *
 * As duas telas do produto que dependem de série ficariam vazias com um extrato
 * importado, porque o banco entrega linhas soltas: uma compra em dez vezes
 * chega como dez despesas sem parentesco, e a pergunta que Parcelamentos existe
 * para responder ("quanto ainda falta") não tem como ser feita.
 *
 * **As duas evidências são de qualidade muito diferente, e isso decide o
 * desenho.** A parcela vem carimbada pelo próprio banco: "3/10" no texto é
 * declaração, não interpretação. Já a assinatura é inferência nossa, a partir de
 * uma cobrança que se repete mês a mês pelo mesmo valor — e "repetiu três vezes"
 * não prova recorrência, só sugere. Por isso o parcelamento é reconhecido a
 * partir de **uma** ocorrência, e a assinatura exige um histórico que se sustente.
 *
 * Nada aqui decide sozinho: o resultado alimenta a tela de conferência, onde
 * cada marcação continua podendo ser desfeita antes de gravar.
 */

/** O que foi reconhecido sobre um lançamento do extrato. */
export interface SeriesHint {
  kind: 'installment' | 'subscription'
  /** Descrição sem o "(3/10)", que é o nome da compra. */
  label: string
  /** Agrupa as ocorrências da mesma série dentro deste extrato. */
  groupKey: string
  /** Só em parcelamento: posição e total, como o banco declarou. */
  index?: number
  total?: number
}

/**
 * As formas como banco brasileiro escreve parcela.
 *
 * Cada uma foi vista em extrato real. A ordem importa: a mais específica vem
 * primeiro, porque "PARCELA 3 DE 10" também casaria com um padrão mais frouxo
 * de dois números soltos, e o frouxo pegaria "COMPRA 2 UN 50" como parcela.
 */
const PADROES_DE_PARCELA: readonly { padrao: RegExp; explicito: boolean }[] = [
  { padrao: /\bparc(?:ela)?\s*(\d{1,2})\s*(?:\/|\s+de\s+)\s*(\d{1,2})\b/i, explicito: true },
  { padrao: /\((\d{1,2})\s*\/\s*(\d{1,2})\)/, explicito: true },
  { padrao: /\b(\d{1,2})\s*\/\s*(\d{1,2})\b(?!\s*\/)/, explicito: false },
]

/** Uma marca de parcela lida do texto, antes de qualquer juízo sobre aceitá-la. */
export interface InstallmentTag {
  index: number
  total: number
  label: string
  /**
   * Se a marca veio de uma escrita que **só** pode ser parcela.
   *
   * "PARC 03/10" e "(3/10)" não são outra coisa. Já dois números soltos são
   * ambíguos: "05/12" tanto é a parcela cinco de doze quanto cinco de dezembro,
   * e nenhuma leitura da linha sozinha decide qual. Quem decide é
   * `detectSeries`, que enxerga o extrato inteiro.
   */
  explicit: boolean
}

/**
 * Extrai posição e total de uma descrição de parcela.
 *
 * Faz leitura, não política: devolve o que está escrito e marca se a escrita é
 * inequívoca. As guardas aqui recusam só o que não forma parcela em hipótese
 * alguma, como total menor que dois ou posição maior que o total.
 */
export function parseInstallmentTag(description: string): InstallmentTag | null {
  for (const { padrao, explicito } of PADROES_DE_PARCELA) {
    const encontrado = padrao.exec(description)
    if (!encontrado) continue

    const index = Number(encontrado[1])
    const total = Number(encontrado[2])

    if (!Number.isFinite(index) || !Number.isFinite(total)) continue
    if (total < 2 || index < 1 || index > total) continue

    const label = description.replace(encontrado[0], ' ').replace(/\s{2,}/g, ' ').trim()
    return { index, total, label: label || description.trim(), explicit: explicito }
  }

  return null
}

/**
 * Acima disto, dois números soltos não podem ser dia e mês.
 *
 * É o que permite aceitar "15/30" sem marcação: não existe mês trinta. Abaixo
 * do limite a leitura é ambígua e precisa de outra evidência.
 */
const MES_MAXIMO = 12

/**
 * Normaliza a descrição para agrupar ocorrências da mesma origem.
 *
 * Tira acento, caixa, pontuação e os números que variam entre cobranças (data
 * no texto, número de autorização). O que sobra é o nome do estabelecimento,
 * que é o que se repete de um mês para o outro.
 */
function chaveDeAgrupamento(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\d+/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Distância em meses entre duas datas de calendário. */
function mesesEntre(a: string, b: string): number {
  const [anoA, mesA] = [Number(a.slice(0, 4)), Number(a.slice(5, 7))]
  const [anoB, mesB] = [Number(b.slice(0, 4)), Number(b.slice(5, 7))]
  return Math.abs((anoB - anoA) * 12 + (mesB - mesA))
}

/** Quantas cobranças mensais sustentam a inferência de assinatura. */
const MINIMO_DE_COBRANCAS = 3

/**
 * Quanto o valor pode variar entre cobranças e ainda ser a mesma assinatura.
 *
 * Serviço reajusta, e câmbio move o preço de quem cobra em dólar. Zero de
 * tolerância perderia justamente as assinaturas mais caras; tolerância larga
 * juntaria compras diferentes no mesmo lugar. Cinco por cento cobre reajuste
 * anual sem alcançar dois jantares no mesmo restaurante.
 */
const TOLERANCIA_DE_VALOR = 0.05

export function detectSeries(entries: readonly ImportEntry[]): Map<string, SeriesHint> {
  const achados = new Map<string, SeriesHint>()

  /*
   * Primeiro os parcelamentos, que são declarados pelo próprio banco.
   *
   * Uma ocorrência basta quando a escrita é inequívoca: "(3/10)" diz que
   * existem dez, mesmo que só uma tenha caído no período importado, e esperar
   * por uma segunda seria exigir prova do que já veio escrito.
   *
   * Dois números soltos são outra história. "05/12" tanto é a parcela cinco de
   * doze quanto cinco de dezembro, e transformar uma data de PIX em compra
   * parcelada inventaria uma dívida que não existe. Nesse caso é preciso uma
   * segunda evidência: ou o total não caber em um mês, ou o mesmo par
   * descrição-total aparecer mais de uma vez, que é o que uma compra parcelada
   * de verdade faz e uma data não.
   */
  const candidatas = entries
    .map((entrada) => {
      /*
       * O que a origem declara vence o que o texto sugere.
       *
       * A Pluggy entrega posição e total em campo próprio para cartão de
       * crédito, e vários bancos não repetem essa informação na descrição — o
       * Inter entre eles. Procurar "3/10" no texto acerta em uns e falha calada
       * em outros, e falhar calado aqui significa a tela de Parcelamentos vazia
       * sem nenhuma pista do motivo.
       */
      const declarado = entrada.declaredInstallment
      if (declarado && declarado.total > 1 && declarado.index >= 1) {
        return {
          entrada,
          marca: {
            index: declarado.index,
            total: declarado.total,
            // A descrição já é o nome da compra: o total vive em campo próprio,
            // então não há sufixo a remover.
            label: entrada.description.trim(),
            explicit: true,
          } satisfies InstallmentTag,
        }
      }

      return { entrada, marca: parseInstallmentTag(entrada.description) }
    })
    .filter((item): item is { entrada: ImportEntry; marca: InstallmentTag } => item.marca !== null)
    .map((item) => ({
      ...item,
      groupKey: `parc:${chaveDeAgrupamento(item.marca.label)}:${item.marca.total}`,
    }))

  const ocorrencias = new Map<string, number>()
  for (const { groupKey } of candidatas) {
    ocorrencias.set(groupKey, (ocorrencias.get(groupKey) ?? 0) + 1)
  }

  for (const { entrada, marca, groupKey } of candidatas) {
    const corroborada = marca.total > MES_MAXIMO || (ocorrencias.get(groupKey) ?? 0) > 1
    if (!marca.explicit && !corroborada) continue

    achados.set(entrada.key, {
      kind: 'installment',
      label: marca.label,
      // O total entra na chave: duas compras no mesmo lugar, uma em 3x e outra
      // em 10x, são compras diferentes e não podem cair na mesma série.
      groupKey,
      index: marca.index,
      total: marca.total,
    })
  }

  /*
   * Depois as assinaturas, entre o que sobrou.
   *
   * Uma parcela também se repete todo mês pelo mesmo valor, então testá-la aqui
   * a classificaria como assinatura — e as duas telas passariam a mostrar a
   * mesma compra, cada uma respondendo uma pergunta errada sobre ela.
   */
  const porChave = new Map<string, ImportEntry[]>()

  for (const entrada of entries) {
    if (achados.has(entrada.key)) continue
    // Entrada de dinheiro não é assinatura. Salário é a cobrança mais regular
    // que existe num extrato, e é o oposto de uma despesa recorrente.
    if (entrada.amountCents >= 0) continue

    const chave = chaveDeAgrupamento(entrada.description)
    if (chave.length < 3) continue

    const grupo = porChave.get(chave)
    if (grupo) grupo.push(entrada)
    else porChave.set(chave, [entrada])
  }

  for (const [chave, grupo] of porChave) {
    if (grupo.length < MINIMO_DE_COBRANCAS) continue

    const ordenado = [...grupo].sort((a, b) => (a.date < b.date ? -1 : 1))

    // Uma por mês, em meses seguidos. Três compras no mesmo mês são três
    // compras no mesmo lugar, não três meses de assinatura.
    const mensal = ordenado.every(
      (item, indice) => indice === 0 || mesesEntre(ordenado[indice - 1].date, item.date) === 1,
    )
    if (!mensal) continue

    const valores = ordenado.map((item) => Math.abs(item.amountCents))
    const maior = Math.max(...valores)
    const menor = Math.min(...valores)
    if (maior > 0 && (maior - menor) / maior > TOLERANCIA_DE_VALOR) continue

    for (const item of ordenado) {
      achados.set(item.key, {
        kind: 'subscription',
        label: item.description.trim(),
        groupKey: `assin:${chave}`,
      })
    }
  }

  return achados
}

/** Uma série reconhecida em lançamentos que já estão no histórico. */
export interface SeriesPlan {
  kind: 'installment' | 'subscription'
  label: string
  /** Ids dos lançamentos que passam a formar esta série. */
  transactionIds: string[]
  /** Posição declarada de cada lançamento, só em parcelamento. */
  indexById: Record<string, { index: number; total: number }>
}

/**
 * Reconhece séries no que **já foi gravado**.
 *
 * A detecção normal acontece durante a importação, e só alcança o que passa por
 * ela. Quem importou antes de a detecção existir ficou com o histórico correto
 * e as duas telas vazias, sem caminho de volta: reimportar não resolve, porque
 * a deduplicação reconhece tudo como já existente — e ela está certa.
 *
 * Só mexe em lançamento **sem série**. Uma compra parcelada cadastrada à mão já
 * respondeu essa pergunta pela vontade de quem cadastrou, e reclassificar por
 * cima trocaria uma decisão explícita por um palpite.
 */
export function planSeriesForHistory(transactions: readonly Transaction[]): SeriesPlan[] {
  const elegiveis = transactions.filter((item) => !item.seriesId && item.kind === 'expense')

  const achados = detectSeries(
    elegiveis.map((item) => ({
      key: item.id,
      date: item.date,
      // O sinal precisa voltar: o histórico guarda valor absoluto com o tipo
      // ao lado, e a detecção lê despesa pelo negativo.
      amountCents: -item.amountCents,
      description: item.description,
    })),
  )

  const porGrupo = new Map<string, SeriesPlan>()

  for (const [transactionId, hint] of achados) {
    const existente = porGrupo.get(hint.groupKey)
    const plano = existente ?? {
      kind: hint.kind,
      label: hint.label,
      transactionIds: [],
      indexById: {},
    }

    plano.transactionIds.push(transactionId)
    if (hint.kind === 'installment' && hint.index && hint.total) {
      plano.indexById[transactionId] = { index: hint.index, total: hint.total }
    }

    if (!existente) porGrupo.set(hint.groupKey, plano)
  }

  return [...porGrupo.values()]
}
