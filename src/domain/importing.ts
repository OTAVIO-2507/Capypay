import { categoriesFor } from './categories'
import { detectSeries, type SeriesHint } from './detectSeries'
import type { AccountKind, Category, Transaction, TransactionKind } from './types'
import type { OfxStatement } from '@/lib/ofx'
import type { IsoDate } from '@/lib/date'
import type { Cents } from '@/lib/money'

/**
 * O que fazer com lançamentos vindos de fora, seja qual for a origem.
 *
 * O leitor de cada origem responde "o que a fonte diz". Este módulo responde as
 * duas perguntas seguintes, que são de domínio e não de formato: **isto já está
 * no histórico?** e **de que categoria é?**. Nenhuma das duas pode ser
 * respondida dentro do `lib/`, que não conhece transação nem categoria.
 *
 * **O domínio não conhece OFX nem Pluggy.** As duas origens convertem para
 * `ImportBatch` antes de chegar aqui, e é por isso que a conferência, a
 * deduplicação e a sugestão de categoria são as mesmas nas duas. A alternativa
 * seria duplicar a regra de duplicata por origem, e duas cópias divergem na
 * primeira correção feita de um lado só.
 *
 * Nada aqui grava. A importação inteira produz uma lista de candidatos que a
 * tela mostra para conferência, e só o que a pessoa confirmar vira lançamento.
 * Importação que escreve direto no histórico é irreversível na prática: são
 * dezenas de linhas de uma vez, e desfazer uma a uma não é uma opção real.
 */

/** Um lançamento de fora, já livre do formato em que chegou. */
export interface ImportEntry {
  /** Identificador na origem. `FITID` no OFX, `id` na Pluggy. */
  key: string
  date: IsoDate
  /** **Com sinal**: negativo é saída. Vira `kind` ao virar candidato. */
  amountCents: Cents
  description: string
  /**
   * Parcelamento **declarado** pela origem, em campo próprio.
   *
   * A Pluggy entrega isto em `creditCardMetadata`, e é evidência de primeira
   * classe: não depende de o banco escrever "3/10" na descrição, coisa que
   * muitos não fazem. Quando existe, dispensa a leitura por texto, que é
   * palpite ao lado de um dado declarado.
   *
   * O OFX não tem equivalente, e por isso lá a leitura por texto continua sendo
   * a única evidência disponível.
   */
  declaredInstallment?: {
    index: number
    total: number
    /** Valor da compra inteira, quando a instituição informa. */
    totalAmountCents?: Cents | null
  } | null
}

/** Um lote de lançamentos de uma conta só. */
export interface ImportBatch {
  /**
   * Identificador da conta na origem.
   *
   * Entra no `externalId` de cada candidato porque bancos reiniciam a
   * numeração por conta: dois "0001" de contas diferentes são compras
   * diferentes, e uma chave só com o id do lançamento fundiria as duas.
   */
  accountKey: string
  /** Como a conta se apresenta na tela de conferência. */
  accountLabel: string
  entries: ImportEntry[]
  start?: IsoDate | null
  end?: IsoDate | null
  /**
   * A conta de onde o lote veio, quando a origem sabe dizer.
   *
   * O arquivo OFX identifica a conta por número; a Pluggy devolve nome, tipo e
   * saldo. Com isso a importação consegue abrir a conta no produto em vez de
   * despejar lançamentos sem dono.
   */
  account?: {
    kind: AccountKind
    number?: string | null
    balanceCents?: Cents | null
  }
}

/** Converte um extrato OFX no lote neutro que o domínio entende. */
export function batchFromOfx(statement: OfxStatement): ImportBatch {
  const conta = statement.account

  return {
    accountKey: conta?.id ?? 'sem-conta',
    accountLabel: conta
      ? `${conta.kind === 'credit_card' ? 'Cartão' : 'Conta'} ${conta.id}`
      : 'Extrato',
    entries: statement.transactions.map((item) => ({
      key: item.fitId,
      date: item.date,
      amountCents: item.amountCents,
      description: item.description,
    })),
    start: statement.start,
    end: statement.end,
    account: conta
      ? { kind: conta.kind === 'credit_card' ? 'credit_card' : 'checking', number: conta.id }
      : undefined,
  }
}

/**
 * Por que um candidato é suspeito de já existir.
 *
 * `exact` é certeza: o mesmo `FITID` da mesma conta já foi importado antes, e
 * reimportar criaria a cópia que `externalId` existe para impedir.
 *
 * `possible` é suspeita, e vale mais do que parece: é o caso de quem lançou a
 * compra na mão no dia e depois importou o extrato do mês. Não há identificador
 * em comum, então só data e valor aproximam os dois. Confundir isso com certeza
 * apagaria lançamentos legítimos (duas passadas iguais no mesmo café), então a
 * decisão fica com a pessoa.
 */
export type DuplicateReason = 'exact' | 'possible' | null

export interface ImportCandidate {
  /** Chave estável no histórico: conta e identificador na instituição. */
  externalId: string
  /**
   * A conta de onde este lançamento veio.
   *
   * Sem isto, uma conexão que traz conta e cartão juntos perdia a separação na
   * hora de gravar: os dois viravam uma lista só, e todo lançamento acabava
   * pendurado na primeira conta. O cartão nem chegava a existir no produto.
   */
  accountKey: string
  kind: TransactionKind
  description: string
  /** Sempre positivo, como no modelo. O sinal virou `kind`. */
  amountCents: Cents
  date: IsoDate
  categoryId: string
  duplicate: DuplicateReason
  /** O que já existe no histórico e motivou a suspeita. */
  duplicateOf: string | null
  /**
   * Série reconhecida no extrato, quando há.
   *
   * Sem isto, Parcelamentos e Assinaturas ficam vazias com um extrato
   * importado: as duas telas partem de série, e o banco entrega linhas soltas.
   */
  series?: SeriesHint
  /**
   * Id do lançamento já gravado que esta linha vem **completar**.
   *
   * Existe por causa de um beco sem saída real: um lançamento já importado é
   * reconhecido como duplicata e descartado, o que está certo enquanto a origem
   * não tem nada de novo a dizer. Mas quando ela passa a declarar o
   * parcelamento que antes não vinha, a duplicata carrega informação que falta
   * no histórico, e recusá-la deixaria a pessoa sem nenhum caminho: reimportar
   * não traz, e o texto da descrição não tem o dado.
   */
  enriches?: string | null
  /**
   * Id do lançamento já gravado cujo **valor ou tipo** estão diferentes da
   * origem.
   *
   * Uma duplicata normalmente não tem nada a acrescentar, e recusá-la é o certo.
   * Mas quando a origem passa a dizer outra coisa sobre o mesmo lançamento — um
   * sinal que estava invertido, um valor que o banco ajustou depois — o
   * histórico guarda um número que a fonte já não sustenta, e não existe outro
   * caminho de correção: reimportar esbarra na deduplicação, e corrigir na mão
   * centenas de linhas não é uma opção real.
   */
  corrects?: string | null
}

/**
 * Palavras que identificam a categoria pelo texto do extrato.
 *
 * A ordem importa: a primeira regra que casar vence, então o específico vem
 * antes do genérico. São palavras que aparecem em memorando de banco de
 * verdade, não nomes bonitos de categoria, e a lista é curta de propósito. Um
 * catálogo grande acerta mais no papel e erra de formas que a pessoa não
 * consegue prever, e conferir uma sugestão errada custa mais que preencher o
 * campo vazio.
 */
const REGRAS: readonly (readonly [string, readonly string[]])[] = [
  /*
   * Fragmentos curtos foram deliberadamente evitados. "99" casaria com "LOJA
   * 1999", "max" com "MAX BURGER" e "tim" com "ULTIMO" e "MULTIMARCAS": num
   * catálogo de palavras soltas, quanto mais curto o pedaço, mais silencioso o
   * erro. Marca ambígua entra com o nome inteiro ou não entra.
   */
  ['assinaturas', ['netflix', 'spotify', 'disney', 'hbo max', 'amazon prime', 'prime video', 'youtube premium', 'icloud', 'google one', 'dropbox', 'adobe', 'hostinger', 'hospedagem', 'openai', 'chatgpt', 'canva', 'microsoft 365', 'office 365', 'deezer', 'globoplay', 'paramount', 'crunchyroll', 'apple.com/bill']],
  // "mercad" sem espaço no fim, e é o que faltava para "Mercadinho" cair aqui:
  // a lista anterior exigia a palavra inteira seguida de espaço, então acertava
  // "mercado central" e errava tudo que o banco escreve grudado ou no
  // diminutivo, que é a maioria das mercearias de bairro.
  ['alimentacao', ['ifood', 'rappi', 'mercad', 'supermerc', 'padaria', 'restaurante', 'lanchonete', 'pizza', 'burger', 'cafe', 'hortifruti', 'acougue', 'atacad', 'sonda', 'assai', 'carrefour', 'pao de acucar', 'tenda atacado', 'sacolao', 'emporio', 'delicatessen', 'confeitaria', 'churrascaria', 'sushi', 'lanches', 'burguer', 'doceria', 'dorinhos', 'subway', 'mcdonald', 'bk ', 'habib', 'outback', 'divino fogao', 'coco bambu']],
  ['transporte', ['uber', '99app', '99 pop', 'combustivel', 'gasolina', 'posto ', 'auto posto', 'ipiranga', 'shell', 'petrobras', 'br mania', 'estacionamento', 'pedagio', 'onibus', 'passagem', 'cabify', 'indriver', 'localiza', 'movida', 'unidas', 'sem parar', 'conectcar', 'veloe', 'detran', 'ipva']],
  ['saude', ['farmacia', 'drogaria', 'drogasil', 'raia', 'pacheco', 'pague menos', 'nissei', 'panvel', 'hospital', 'clinica', 'laboratorio', 'unimed', 'amil ', 'hapvida', 'dentista', 'odonto', 'psicolog', 'terapia', 'fisioterapia', 'oftalmo', 'exame']],
  ['moradia', ['aluguel', 'condominio', 'energia eletrica', 'eletropaulo', 'enel', 'cemig', 'copel', 'cpfl', 'light servicos', 'sabesp', 'saneamento', 'sanepar', 'copasa', 'comgas', 'gas natural', 'internet', 'vivo fibra', 'claro ', 'oi fibra', 'net servicos', 'iptu', 'imobiliaria', 'leroy merlin', 'telhanorte', 'obramax']],
  ['educacao', ['faculdade', 'universidade', 'curso ', 'escola', 'colegio', 'alura', 'udemy', 'coursera', 'rocketseat', 'livraria', 'papelaria', 'kumon', 'wizard', 'cna ', 'fisk', 'estacio', 'anhanguera', 'unip ', 'senai', 'sebrae']],
  ['lazer', ['cinema', 'cinemark', 'teatro', 'ingresso', 'ticket', 'sympla', 'academia', 'smartfit', 'bluefit', 'hotel', 'airbnb', 'booking', 'decolar', 'latam', 'gol linhas', 'azul linhas', 'parque', 'clube', 'bar e ', 'pub ', 'boliche']],
  ['compras', ['mercado livre', 'mercadolivre', 'amazon', 'shopee', 'aliexpress', 'magalu', 'magazine luiza', 'americanas', 'casas bahia', 'renner', 'riachuelo', 'shopping', 'c&a', 'marisa', 'centauro', 'netshoes', 'decathlon', 'kalunga', 'fast shop', 'ponto frio', 'extra ', 'shein', 'temu']],
  ['salario', ['salario', 'folha de pagamento', 'proventos', 'remuneracao', 'pagamento de salario', 'pro labore', 'ferias', 'decimo terceiro']],
  ['investimentos', ['rendimento', 'dividendo', 'resgate', 'cdb', 'tesouro', 'poupanca', 'juros sobre capital', 'jcp', 'renda fixa', 'b3 ', 'corretora', 'clear', 'rico invest', 'nuinvest', 'btg pactual']],
]

/** Sem acento e em minúsculas: "Alimentação" e "ALIMENTACAO" viram a mesma coisa. */
function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    // Escrito por código, e não com os caracteres literais: a faixa de acentos
    // combinantes é invisível no editor e já foi corrompida por shell antes.
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

/**
 * Sugere a categoria pelo texto, caindo em "Outros" quando nada casa.
 *
 * A sugestão respeita `appliesTo`: uma regra de despesa nunca é aplicada a uma
 * entrada. Sem isso, um estorno do Mercado Livre entraria como receita da
 * categoria "Compras", que nenhuma tela do produto sabe somar.
 */
export function suggestCategory(
  description: string,
  kind: TransactionKind,
  categories: readonly Category[],
  /**
   * O que já foi categorizado antes, para a sugestão aprender com a pessoa.
   *
   * Nenhum catálogo de palavras vai conhecer a padaria da esquina, e cada
   * extrato tem dezenas dessas. Sem memória, quem corrige "Mercadinho Aruja"
   * para Alimentação hoje corrige de novo no mês que vem, e no seguinte — a
   * mesma decisão, repetida para sempre, que é o jeito mais rápido de fazer
   * alguém desistir de categorizar.
   */
  aprendidas?: ReadonlyMap<string, string>,
): string {
  const permitidas = new Set(categoriesFor(categories, kind).map((item) => item.id))
  const texto = normalizar(description)

  // O que a pessoa decidiu vence o catálogo: ela conhece o estabelecimento, e
  // a lista de palavras só conhece marca grande.
  const aprendida = aprendidas?.get(chaveDeEstabelecimento(texto))
  if (aprendida && permitidas.has(aprendida)) return aprendida

  for (const [categoryId, palavras] of REGRAS) {
    if (!permitidas.has(categoryId)) continue
    if (palavras.some((palavra) => texto.includes(palavra))) return categoryId
  }

  return permitidas.has('outros') ? 'outros' : (categoriesFor(categories, kind)[0]?.id ?? 'outros')
}

/**
 * Reduz a descrição ao nome do estabelecimento, para reconhecê-lo de novo.
 *
 * Tira números, prefixos de operação e pontuação, que é o que muda entre duas
 * compras no mesmo lugar: "Compra no débito - Mercadinho Aruja Bra" e "COMPRA
 * NO DEBITO - MERCADINHO ARUJA BRA 0293" precisam cair na mesma chave, senão a
 * memória nunca reconhece nada.
 */
function chaveDeEstabelecimento(textoNormalizado: string): string {
  return textoNormalizado
    .replace(/compra no debito|compra no credito|compra com cartao|pagamento de|pix (enviado|recebido)|debito automatico|tarifa/g, ' ')
    .replace(/\d+/g, ' ')
    .replace(/[^a-z\s]/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/**
 * Monta a memória de categorias a partir do histórico.
 *
 * Só olha o que a pessoa **mudou**: um lançamento importado que continua na
 * categoria sugerida não ensina nada, e realimentar a própria sugestão faria
 * um erro inicial se perpetuar sozinho. A última decisão vence, porque é a mais
 * recente sobre o mesmo lugar.
 */
export function learnCategories(transactions: readonly Transaction[]): Map<string, string> {
  const memoria = new Map<string, string>()

  const ordenadas = [...transactions].sort((a, b) => a.updatedAt - b.updatedAt)

  for (const transaction of ordenadas) {
    if (transaction.kind === 'contribution') continue
    if (transaction.categoryId === 'outros') continue

    const chave = chaveDeEstabelecimento(normalizar(transaction.description))
    if (chave.length < 3) continue

    memoria.set(chave, transaction.categoryId)
  }

  return memoria
}

/** Distância em dias entre duas datas de calendário, sem construir `Date`. */
function diasEntre(a: IsoDate, b: IsoDate): number {
  const paraDias = (iso: IsoDate) => Date.UTC(
    Number(iso.slice(0, 4)),
    Number(iso.slice(5, 7)) - 1,
    Number(iso.slice(8, 10)),
  ) / 86_400_000

  return Math.abs(paraDias(a) - paraDias(b))
}

/** Quantos dias de folga a suspeita de duplicata aceita. */
const JANELA_DE_SUSPEITA = 2

/**
 * Transforma o lote lido em candidatos, já cruzados com o histórico.
 *
 * O `externalId` é composto pela conta **e** pelo identificador do lançamento,
 * pelo motivo documentado em `ImportBatch.accountKey`.
 */
export function buildImportCandidates(
  batch: ImportBatch,
  existing: readonly Transaction[],
  categories: readonly Category[],
): ImportCandidate[] {
  const porExternalId = new Map<string, Transaction>()
  for (const transacao of existing) {
    if (transacao.externalId) porExternalId.set(transacao.externalId, transacao)
  }

  // A detecção recebe o lote inteiro, e não uma linha de cada vez: reconhecer
  // assinatura exige ver a repetição, que só existe no conjunto.
  const series = detectSeries(batch.entries)
  const aprendidas = learnCategories(existing)

  return batch.entries.map((lancamento) => {
    const externalId = `${batch.accountKey}:${lancamento.key}`
    const kind: TransactionKind = lancamento.amountCents < 0 ? 'expense' : 'income'
    const amountCents = Math.abs(lancamento.amountCents)

    const serie = series.get(lancamento.key)
    const exato = porExternalId.get(externalId)
    const parecido = exato
      ? null
      : existing.find(
          (transacao) =>
            transacao.amountCents === amountCents &&
            transacao.kind === kind &&
            diasEntre(transacao.date, lancamento.date) <= JANELA_DE_SUSPEITA,
        )

    return {
      externalId,
      accountKey: batch.accountKey,
      kind,
      description: lancamento.description,
      amountCents,
      date: lancamento.date,
      categoryId: suggestCategory(lancamento.description, kind, categories, aprendidas),
      duplicate: exato ? 'exact' : parecido ? 'possible' : null,
      duplicateOf: exato?.id ?? parecido?.id ?? null,
      series: serie,
      // Só completa quem já existe **sem** série e agora chega com uma. Mexer
      // num lançamento que já tem série trocaria uma classificação existente
      // por outra sem que ninguém tenha pedido.
      enriches: exato && serie && !exato.seriesId ? exato.id : null,
      corrects:
        exato && (exato.kind !== kind || exato.amountCents !== amountCents) ? exato.id : null,
    }
  })
}

/** Resumo para o cabeçalho da conferência. */
export interface ImportSummary {
  total: number
  novos: number
  jaImportados: number
  suspeitos: number
  incomeCents: Cents
  expenseCents: Cents
}

export function summarizeCandidates(candidates: readonly ImportCandidate[]): ImportSummary {
  return {
    total: candidates.length,
    novos: candidates.filter((item) => item.duplicate === null).length,
    jaImportados: candidates.filter((item) => item.duplicate === 'exact').length,
    suspeitos: candidates.filter((item) => item.duplicate === 'possible').length,
    incomeCents: candidates
      .filter((item) => item.kind === 'income')
      .reduce((soma, item) => soma + item.amountCents, 0),
    expenseCents: candidates
      .filter((item) => item.kind === 'expense')
      .reduce((soma, item) => soma + item.amountCents, 0),
  }
}
