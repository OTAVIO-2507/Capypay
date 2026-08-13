import { CONTRIBUTION_CATEGORY_ID, FALLBACK_CATEGORY_ID, LEGACY_CATEGORY_MAP } from '@/domain/categories'
import type {
  AvatarImageId,
  CategoryId,
  FinanceData,
  Goal,
  Transaction,
  TransactionKind,
} from '@/domain/types'
import { isValidIsoDate, todayIso } from '@/lib/date'
import { createId, slugify } from '@/lib/id'
import { toCents } from '@/lib/money'
import { createEmptyData, SCHEMA_VERSION } from './defaults'

/**
 * Migração da base gravada pela versão anterior.
 *
 * O formato antigo guardava reais em ponto flutuante, categorias como texto
 * livre acentuado, e o progresso das metas em um campo persistido. Nada disso
 * sobrevive — mas nenhum lançamento pode se perder no caminho, porque são dados
 * reais que o usuário digitou ao longo de meses.
 */

interface LegacyTransaction {
  id?: unknown
  description?: unknown
  amount?: unknown
  type?: unknown
  category?: unknown
  goalId?: unknown
  date?: unknown
}

interface LegacyGoal {
  id?: unknown
  name?: unknown
  icon?: unknown
  target?: unknown
}

interface LegacyData {
  user?: { name?: unknown }
  settings?: {
    theme?: unknown
    privacyMode?: unknown
    budgets?: Record<string, unknown>
    budgetsByMonth?: Record<string, Record<string, unknown>>
  }
  transactions?: unknown
  goals?: unknown
}

const LEGACY_KIND: Record<string, TransactionKind> = {
  income: 'income',
  expense: 'expense',
  goal: 'contribution',
}

/** Ícones de meta que o catálogo atual não tem mais; caem no alvo genérico. */
const LEGACY_GOAL_ICONS = new Set([
  'target',
  'plane',
  'car',
  'house',
  'smartphone',
  'heart',
  'shield-alert',
  'piggy-bank',
])

function asString(value: unknown, fallback = ''): string {
  return typeof value === 'string' ? value : fallback
}

function asNumber(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return 0
}

/** `2024-3-5` e `2024-03-05` chegam ao mesmo lugar; lixo vira hoje. */
function normalizeIsoDate(value: unknown): string {
  const raw = asString(value)
  const match = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(raw)
  if (!match) {
    const now = new Date()
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
  }
  const [, year, month, day] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/**
 * Resolve o texto livre de categoria em um identificador do catálogo.
 * Tenta a tabela explícita, depois o slug, e só então desiste para "Outros" —
 * perder a categoria é aceitável, perder o lançamento não é.
 */
function resolveCategoryId(raw: unknown, kind: TransactionKind): CategoryId {
  if (kind === 'contribution') return CONTRIBUTION_CATEGORY_ID

  const slug = slugify(asString(raw))
  if (!slug) return FALLBACK_CATEGORY_ID

  return LEGACY_CATEGORY_MAP[slug] ?? FALLBACK_CATEGORY_ID
}

function migrateTransactions(raw: unknown, goalIdMap: Map<string, string>): Transaction[] {
  if (!Array.isArray(raw)) return []
  const now = Date.now()

  return raw.flatMap((entry: LegacyTransaction, index): Transaction[] => {
    const amount = asNumber(entry.amount)
    if (amount <= 0) return []

    const kind = LEGACY_KIND[asString(entry.type)] ?? 'expense'
    const legacyGoalId = asString(entry.goalId)
    const goalId = legacyGoalId ? (goalIdMap.get(legacyGoalId) ?? null) : null

    // Um aporte cuja meta sumiu vira despesa: o dinheiro saiu do saldo de
    // qualquer forma, e descartá-lo distorceria o histórico.
    const resolvedKind: TransactionKind = kind === 'contribution' && !goalId ? 'expense' : kind

    return [
      {
        id: asString(entry.id) || createId('tx'),
        kind: resolvedKind,
        description: asString(entry.description) || 'Lançamento sem descrição',
        amountCents: toCents(amount),
        date: normalizeIsoDate(entry.date),
        categoryId: resolveCategoryId(entry.category, resolvedKind),
        goalId: resolvedKind === 'contribution' ? goalId : null,
        accountId: null,
        source: 'manual',
        externalId: null,
        seriesId: null,
        installment: null,
        notes: null,
        createdAt: now - index,
        updatedAt: now - index,
      },
    ]
  })
}

function migrateGoals(raw: unknown): { goals: Goal[]; idMap: Map<string, string> } {
  const idMap = new Map<string, string>()
  if (!Array.isArray(raw)) return { goals: [], idMap }

  const now = Date.now()
  const goals = raw.flatMap((entry: LegacyGoal, index): Goal[] => {
    const name = asString(entry.name)
    const target = asNumber(entry.target)
    if (!name || target <= 0) return []

    const legacyId = asString(entry.id)
    const id = legacyId || createId('goal')
    if (legacyId) idMap.set(legacyId, id)

    const icon = asString(entry.icon, 'target')

    return [
      {
        id,
        name,
        icon: LEGACY_GOAL_ICONS.has(icon) ? icon : 'target',
        targetCents: toCents(target),
        deadline: null,
        archived: false,
        createdAt: now - index,
      },
    ]
  })

  return { goals, idMap }
}

function migrateBudgets(legacy: LegacyData['settings']): FinanceData['budgets'] {
  const result: FinanceData['budgets'] = {}
  const byMonth = legacy?.budgetsByMonth
  if (!byMonth || typeof byMonth !== 'object') return result

  for (const [month, limits] of Object.entries(byMonth)) {
    if (!/^\d{4}-\d{2}$/.test(month) || !limits || typeof limits !== 'object') continue

    const converted: Record<CategoryId, number> = {}
    for (const [category, limit] of Object.entries(limits)) {
      const value = asNumber(limit)
      if (value <= 0) continue
      const categoryId = resolveCategoryId(category, 'expense')
      // Duas categorias antigas podem colapsar na mesma atual; somar preserva
      // o valor total que o usuário havia reservado para aquele mês.
      converted[categoryId] = (converted[categoryId] ?? 0) + toCents(value)
    }

    if (Object.keys(converted).length > 0) result[month] = converted
  }

  return result
}

/** Converte a base da v1 no formato atual. Nunca lança: no pior caso devolve vazio. */
export function migrateLegacyData(rawJson: string): FinanceData | null {
  let parsed: LegacyData
  try {
    parsed = JSON.parse(rawJson) as LegacyData
  } catch {
    return null
  }

  if (!parsed || typeof parsed !== 'object') return null

  const hasContent =
    (Array.isArray(parsed.transactions) && parsed.transactions.length > 0) ||
    (Array.isArray(parsed.goals) && parsed.goals.length > 0) ||
    Boolean(parsed.settings?.budgetsByMonth)

  if (!hasContent) return null

  const base = createEmptyData()
  const { goals, idMap } = migrateGoals(parsed.goals)
  const legacyTheme = asString(parsed.settings?.theme)

  return {
    ...base,
    profile: { ...base.profile, name: asString(parsed.user?.name) },
    settings: {
      theme: legacyTheme === 'dark' || legacyTheme === 'light' ? legacyTheme : 'system',
      privacyMode: parsed.settings?.privacyMode === true,
    },
    goals,
    transactions: migrateTransactions(parsed.transactions, idMap),
    budgets: migrateBudgets(parsed.settings),
  }
}

/**
 * Aplica migrações entre versões do formato atual e completa campos que
 * versões futuras venham a adicionar. Um dado salvo por uma versão anterior
 * nunca deve derrubar a aplicação por falta de propriedade.
 */
export function reconcileData(raw: unknown): FinanceData {
  const base = createEmptyData()
  if (!raw || typeof raw !== 'object') return base

  const data = raw as Partial<FinanceData>

  return {
    schemaVersion: SCHEMA_VERSION,
    profile: reconcileProfile(data.profile),
    settings: {
      theme: data.settings?.theme ?? 'system',
      privacyMode: data.settings?.privacyMode === true,
    },
    accounts: Array.isArray(data.accounts) ? data.accounts : [],
    // O catálogo nativo pode ganhar categorias entre versões; unir por id
    // preserva as personalizadas sem duplicar as que já existem.
    categories: mergeCategories(base.categories, data.categories),
    transactions: sanitizeTransactions(data.transactions),
    goals: Array.isArray(data.goals) ? data.goals : [],
    budgets: data.budgets && typeof data.budgets === 'object' ? data.budgets : {},
  }
}

/**
 * Preenche o perfil com os padrões que versões anteriores não gravavam.
 *
 * Uma base salva antes de a personalização existir não tem `avatar` nem
 * `greeting`. Ler esses campos direto daria `undefined` no meio da
 * renderização; completar aqui mantém o resto do código livre de checagem.
 */
const AVATAR_IMAGE_IDS: readonly AvatarImageId[] = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
]

function isAvatarImageId(value: unknown): value is AvatarImageId {
  return typeof value === 'string' && (AVATAR_IMAGE_IDS as readonly string[]).includes(value)
}

function reconcileProfile(raw: unknown): FinanceData['profile'] {
  const padrao = createEmptyData().profile
  if (!raw || typeof raw !== 'object') return padrao

  const perfil = raw as Partial<FinanceData['profile']>
  const shape = perfil.avatar?.shape
  const image = perfil.avatar?.image

  return {
    name: asString(perfil.name),
    nickname: asString(perfil.nickname),
    avatar: {
      shape: shape === 'squircle' ? 'squircle' : 'circle',
      // Um id fora da lista — arquivo removido numa versão futura, base salva
      // antes de as ilustrações existirem, ou base adulterada à mão — não
      // pode virar caminho de imagem de valor arbitrário. Cai no primeiro retrato.
      image: isAvatarImageId(image) ? image : padrao.avatar.image,
    },
    greeting: perfil.greeting !== false,
    /*
     * Uma base gravada antes de o tour existir não tem este campo. Ler como
     * `null` mandaria quem já usa o produto de volta para a apresentação —
     * por isso quem já tem nome cadastrado conta como apresentado, mesmo sem
     * a marca de data. Só base realmente vazia cai no tour.
     */
    onboardedAt:
      typeof perfil.onboardedAt === 'number'
        ? perfil.onboardedAt
        : asString(perfil.name).trim()
          ? 0
          : null,
  }
}

/**
 * Repara os lançamentos na leitura.
 *
 * Aceitar o que estava salvo sem conferir custou caro: bastava uma data que não
 * fosse `AAAA-MM-DD` para a formatação lançar durante a renderização e derrubar
 * a aplicação inteira, sem caminho de volta. A camada de datas agora aguenta
 * entrada ruim, mas consertar aqui é melhor do que aguentar para sempre — o
 * dado se cura na primeira abertura e o resto do sistema volta a poder confiar
 * no formato.
 *
 * A data quebrada vira hoje, e não é descartada: perder a data de um lançamento
 * é ruim, perder o lançamento é pior.
 */
function sanitizeTransactions(raw: unknown): Transaction[] {
  if (!Array.isArray(raw)) return []

  return raw.flatMap((entry: unknown): Transaction[] => {
    if (!entry || typeof entry !== 'object') return []
    const transaction = entry as Transaction

    const amountCents = Math.round(asNumber(transaction.amountCents))
    if (!Number.isFinite(amountCents) || amountCents <= 0) return []

    return [
      {
        ...transaction,
        amountCents,
        date: isValidIsoDate(transaction.date) ? transaction.date : todayIso(),
        kind:
          transaction.kind === 'income' || transaction.kind === 'contribution'
            ? transaction.kind
            : 'expense',
        description: asString(transaction.description) || 'Lançamento sem descrição',
        categoryId: asString(transaction.categoryId) || FALLBACK_CATEGORY_ID,
      },
    ]
  })
}

function mergeCategories(
  defaults: FinanceData['categories'],
  saved: FinanceData['categories'] | undefined,
): FinanceData['categories'] {
  if (!Array.isArray(saved) || saved.length === 0) return defaults

  const byId = new Map(defaults.map((category) => [category.id, category]))
  for (const category of saved) {
    if (!category?.id) continue
    // Categoria criada pelo usuário entra; nativa mantém a definição atual do
    // catálogo, para que renomear um rótulo nativo chegue a quem já usava.
    if (!byId.has(category.id)) byId.set(category.id, category)
  }

  return [...byId.values()]
}
