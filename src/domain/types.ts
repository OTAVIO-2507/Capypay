import type { IsoDate, MonthKey } from '@/lib/date'
import type { Cents } from '@/lib/money'

/**
 * Modelo de domínio.
 *
 * O eixo que organiza este arquivo é a sincronização bancária que ainda não
 * existe. Três decisões foram tomadas por causa dela e não fazem sentido
 * completo sem esse contexto:
 *
 * 1. `Transaction.source` distingue o que o usuário digitou do que veio de um
 *    agregador. Sem isso, uma sincronização não sabe o que pode sobrescrever.
 * 2. `Transaction.externalId` guarda o identificador da instituição, que é a
 *    única chave confiável para não duplicar a mesma compra a cada sincronia.
 * 3. `Account` existe como entidade desde já, mesmo com uso manual, porque
 *    transformar transações soltas em transações-por-conta depois do fato é uma
 *    migração destrutiva.
 */

export type TransactionId = string
export type GoalId = string
export type AccountId = string
export type CategoryId = string
export type SeriesId = string

/**
 * Os três movimentos que o produto reconhece.
 * `contribution` é dinheiro que saiu do saldo sem ter sido gasto — vai para uma
 * meta. Não é despesa, e tratá-lo como tal distorceria o gráfico de gastos.
 */
export type TransactionKind = 'income' | 'expense' | 'contribution'

/**
 * De onde o lançamento veio. Hoje só `manual` e `recurring` são produzidos;
 * `imported` e `synced` são os destinos de quem chegar por arquivo ou por API.
 */
export type TransactionSource = 'manual' | 'recurring' | 'imported' | 'synced'

export type RecurrenceFrequency = 'weekly' | 'monthly' | 'yearly'

export interface Installment {
  /** Posição desta parcela, começando em 1. */
  index: number
  total: number
}

/**
 * As duas coisas que "repetir lançamento" cria, e que o produto trata em
 * páginas separadas.
 *
 * `installment` é uma compra fatiada: o total é fixo, já foi decidido na
 * compra, e a pergunta é quanto falta pagar. `subscription` é um serviço que
 * cobra de novo: não há total, e a pergunta é quanto ele ocupa por mês.
 * Somar as duas num número só não responde nenhuma das duas perguntas.
 */
export type SeriesKind = 'installment' | 'subscription'

export interface Transaction {
  id: TransactionId
  kind: TransactionKind
  description: string
  /** Sempre positivo. O sinal é responsabilidade de `kind`, não do valor. */
  amountCents: Cents
  date: IsoDate
  categoryId: CategoryId
  /** Preenchido apenas quando `kind === 'contribution'`. */
  goalId?: GoalId | null
  /** Conta ou cartão de origem. Opcional enquanto o uso for só manual. */
  accountId?: AccountId | null
  source: TransactionSource
  /** Identificador na instituição financeira. Chave de deduplicação. */
  externalId?: string | null
  /** Agrupa as parcelas geradas por um mesmo lançamento recorrente. */
  seriesId?: SeriesId | null
  /**
   * O que a série é. Sem isto, parcelamento e assinatura ficam idênticos no
   * histórico — as duas nascem do mesmo campo do formulário e as duas viram N
   * lançamentos com o mesmo `seriesId` — e nenhuma tela consegue separá-los
   * sem adivinhar pelo nome ou pela categoria, que erraria calado.
   */
  seriesKind?: SeriesKind | null
  installment?: Installment | null
  notes?: string | null
  createdAt: number
  updatedAt: number
}

export type AccountKind = 'checking' | 'credit_card' | 'cash' | 'investment'

export interface CreditCardTerms {
  /** Dia do mês em que a fatura fecha. */
  closingDay: number
  /** Dia do mês do vencimento. */
  dueDay: number
  limitCents: Cents | null
}

/** Vínculo entre uma conta local e a conta correspondente no agregador. */
export interface AccountSyncLink {
  provider: string
  itemId: string
  lastSyncedAt: number | null
}

/**
 * Uma autorização de Open Finance concedida pelo usuário.
 *
 * O widget do agregador devolve um `itemId` e some. Esse identificador é a
 * única coisa que sobra da conexão inteira: é por ele que se pedem contas e
 * lançamentos depois, e perdê-lo significa refazer todo o consentimento no
 * banco. Por isso ele é gravado no instante em que chega, antes de qualquer
 * importação existir.
 *
 * Fica separado de `Account.sync` de propósito: uma autorização cobre o
 * vínculo com a instituição, que costuma render **várias** contas. O `sync`
 * de cada conta aponta de volta para o mesmo `itemId` quando a importação
 * criar as contas — a autorização vem primeiro e existe sozinha.
 */
export interface BankConnection {
  /** Sempre `'pluggy'` hoje. Nomeado para o dia em que houver outro. */
  provider: string
  itemId: string
  connectedAt: number
  lastSyncedAt: number | null
}

export interface Account {
  id: AccountId
  name: string
  kind: AccountKind
  institution?: string | null
  /** Últimos quatro dígitos, quando fizer sentido identificar o cartão. */
  last4?: string | null
  creditCard?: CreditCardTerms | null
  sync?: AccountSyncLink | null
  /**
   * Saldo informado pela instituição, quando a conta veio de importação.
   *
   * Fica **fora** do cálculo de saldo do produto, que soma lançamentos, e isso
   * é deliberado. Transformá-lo num lançamento de abertura faria o valor
   * aparecer como receita do mês em que caísse, inflando "entrou" com dinheiro
   * que ninguém recebeu ali. Aqui ele é o que é: o número que o banco diz, com
   * a data em que disse.
   */
  balanceCents?: Cents | null
  balanceUpdatedAt?: number | null
  archived: boolean
  createdAt: number
}

export interface Goal {
  id: GoalId
  name: string
  /** Nome de um ícone do catálogo em `domain/icons.ts`. */
  icon: string
  targetCents: Cents
  /** Data-alvo opcional; alimenta o ritmo mensal necessário. */
  deadline?: IsoDate | null
  archived: boolean
  createdAt: number
}

export interface Category {
  id: CategoryId
  label: string
  icon: string
  /** Em quais tipos de lançamento esta categoria pode ser escolhida. */
  appliesTo: TransactionKind[]
  /** Categorias nativas não podem ser excluídas, só ocultadas. */
  builtin: boolean
}

/** Limites de gasto por mês e por categoria, em centavos. */
export type BudgetsByMonth = Record<MonthKey, Record<CategoryId, Cents>>

export type ThemePreference = 'light' | 'dark' | 'system'

export interface Settings {
  theme: ThemePreference
  /** Mascara todo valor monetário na tela. */
  privacyMode: boolean
}

/** Contorno do avatar. */
export type AvatarShape = 'circle' | 'squircle'

/** Um dos vinte retratos ilustrados embutidos no aplicativo — não um upload. */
export type AvatarImageId =
  | '1'
  | '2'
  | '3'
  | '4'
  | '5'
  | '6'
  | '7'
  | '8'
  | '9'
  | '10'
  | '11'
  | '12'
  | '13'
  | '14'
  | '15'
  | '16'
  | '17'
  | '18'
  | '19'
  | '20'

export interface Profile {
  /** Nome completo. Vai para o titular impresso no cartão. */
  name: string
  /**
   * Como quer ser chamado na saudação. Vazio cai no primeiro nome — ninguém
   * quer ser cumprimentado pelo nome que está no cartão.
   */
  nickname: string
  avatar: {
    image: AvatarImageId
    shape: AvatarShape
  }
  /** Saudação no topo do painel. Nem todo mundo quer ser cumprimentado. */
  greeting: boolean
  /**
   * Quando a pessoa terminou (ou dispensou) o tour de boas-vindas. `null`
   * significa "ainda não passou por ele" e é o que dispara a abertura.
   *
   * Mora no perfil, e não em `settings`, porque a primeira etapa do tour é
   * justamente se apresentar — quem já tem nome cadastrado já passou por aqui.
   */
  onboardedAt: number | null
}

/** Raiz persistida. Tudo que o aplicativo sabe cabe aqui. */
export interface FinanceData {
  schemaVersion: number
  profile: Profile
  settings: Settings
  accounts: Account[]
  /** Autorizações de Open Finance ativas. Vazio enquanto ninguém conectou. */
  connections: BankConnection[]
  categories: Category[]
  transactions: Transaction[]
  goals: Goal[]
  budgets: BudgetsByMonth
}

/** Campos que o formulário produz; o restante é derivado no repositório. */
export type TransactionDraft = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'source'> &
  Partial<Pick<Transaction, 'source'>>

export interface RecurrenceDraft {
  kind: SeriesKind
  frequency: RecurrenceFrequency
  /** Total de ocorrências, incluindo a primeira. */
  occurrences: number
}
