import { categoriesFor } from './categories'
import type { Category, Transaction, TransactionKind } from './types'
import type { OfxStatement, OfxTransaction } from '@/lib/ofx'
import type { IsoDate } from '@/lib/date'
import type { Cents } from '@/lib/money'

/**
 * O que fazer com um extrato depois de lido.
 *
 * O parser responde "o que o arquivo diz". Este módulo responde as duas
 * perguntas seguintes, que são de domínio e não de formato: **isto já está no
 * histórico?** e **de que categoria é?**. Nenhuma das duas pode ser respondida
 * dentro do `lib/`, que não conhece transação nem categoria.
 *
 * Nada aqui grava. A importação inteira produz uma lista de candidatos que a
 * tela mostra para conferência, e só o que a pessoa confirmar vira lançamento.
 * Importação que escreve direto no histórico é irreversível na prática: são
 * dezenas de linhas de uma vez, e desfazer uma a uma não é uma opção real.
 */

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
  kind: TransactionKind
  description: string
  /** Sempre positivo, como no modelo. O sinal virou `kind`. */
  amountCents: Cents
  date: IsoDate
  categoryId: string
  duplicate: DuplicateReason
  /** O que já existe no histórico e motivou a suspeita. */
  duplicateOf: string | null
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
  ['assinaturas', ['netflix', 'spotify', 'disney', 'hbo max', 'amazon prime', 'prime video', 'youtube premium', 'icloud', 'google one', 'dropbox', 'adobe']],
  ['alimentacao', ['ifood', 'rappi', 'mercado ', 'supermerc', 'padaria', 'restaurante', 'lanchonete', 'pizza', 'burger', 'cafe', 'hortifruti', 'acougue', 'atacad']],
  ['transporte', ['uber', '99app', '99 pop', 'combustivel', 'gasolina', 'posto ', 'ipiranga', 'shell', 'petrobras', 'estacionamento', 'pedagio', 'onibus', 'passagem']],
  ['saude', ['farmacia', 'drogaria', 'drogasil', 'hospital', 'clinica', 'laboratorio', 'unimed', 'dentista', 'psicolog']],
  ['moradia', ['aluguel', 'condominio', 'energia eletrica', 'eletropaulo', 'cemig', 'copel', 'sabesp', 'saneamento', 'comgas', 'gas natural', 'internet', 'vivo fibra', 'claro ', 'iptu']],
  ['educacao', ['faculdade', 'universidade', 'curso ', 'escola', 'colegio', 'alura', 'udemy', 'livraria']],
  ['lazer', ['cinema', 'teatro', 'ingresso', 'academia', 'smartfit', 'hotel', 'airbnb']],
  ['compras', ['mercado livre', 'mercadolivre', 'amazon', 'shopee', 'aliexpress', 'magalu', 'americanas', 'casas bahia', 'renner', 'riachuelo', 'shopping']],
  ['salario', ['salario', 'folha de pagamento', 'proventos', 'remuneracao']],
  ['investimentos', ['rendimento', 'dividendo', 'resgate', 'cdb', 'tesouro', 'poupanca']],
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
): string {
  const permitidas = new Set(categoriesFor(categories, kind).map((item) => item.id))
  const texto = normalizar(description)

  for (const [categoryId, palavras] of REGRAS) {
    if (!permitidas.has(categoryId)) continue
    if (palavras.some((palavra) => texto.includes(palavra))) return categoryId
  }

  return permitidas.has('outros') ? 'outros' : (categoriesFor(categories, kind)[0]?.id ?? 'outros')
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
 * Transforma o extrato lido em candidatos, já cruzados com o histórico.
 *
 * O `externalId` é composto pela conta **e** pelo identificador do lançamento:
 * bancos reiniciam a numeração por conta, e duas contas do mesmo banco podem
 * emitir o mesmo `FITID` para compras diferentes.
 */
export function buildImportCandidates(
  statement: OfxStatement,
  existing: readonly Transaction[],
  categories: readonly Category[],
): ImportCandidate[] {
  const conta = statement.account?.id ?? 'sem-conta'

  const porExternalId = new Map<string, Transaction>()
  for (const transacao of existing) {
    if (transacao.externalId) porExternalId.set(transacao.externalId, transacao)
  }

  return statement.transactions.map((lancamento: OfxTransaction) => {
    const externalId = `${conta}:${lancamento.fitId}`
    const kind: TransactionKind = lancamento.amountCents < 0 ? 'expense' : 'income'
    const amountCents = Math.abs(lancamento.amountCents)

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
      kind,
      description: lancamento.description,
      amountCents,
      date: lancamento.date,
      categoryId: suggestCategory(lancamento.description, kind, categories),
      duplicate: exato ? 'exact' : parecido ? 'possible' : null,
      duplicateOf: exato?.id ?? parecido?.id ?? null,
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
