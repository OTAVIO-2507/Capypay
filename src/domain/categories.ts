import type { Category, CategoryId, TransactionKind } from './types'

/**
 * Catálogo de categorias.
 *
 * A versão anterior repetia listas de categoria em cinco lugares do código, e
 * elas divergiram: o formulário oferecia oito opções e o filtro da tabela
 * mostrava seis, então "Transporte" e "Saúde" eram lançáveis mas não filtráveis.
 * Aqui a lista é dado, existe uma vez, e todo seletor deriva dela.
 */
export const DEFAULT_CATEGORIES: Category[] = [
  // Despesas
  { id: 'alimentacao', label: 'Alimentação', icon: 'utensils', appliesTo: ['expense'], builtin: true },
  { id: 'moradia', label: 'Moradia', icon: 'house', appliesTo: ['expense'], builtin: true },
  { id: 'transporte', label: 'Transporte', icon: 'bus', appliesTo: ['expense'], builtin: true },
  { id: 'saude', label: 'Saúde', icon: 'heart-pulse', appliesTo: ['expense'], builtin: true },
  { id: 'educacao', label: 'Educação', icon: 'graduation-cap', appliesTo: ['expense'], builtin: true },
  { id: 'lazer', label: 'Lazer', icon: 'clapperboard', appliesTo: ['expense'], builtin: true },
  { id: 'compras', label: 'Compras', icon: 'shopping-bag', appliesTo: ['expense'], builtin: true },
  { id: 'assinaturas', label: 'Assinaturas', icon: 'repeat', appliesTo: ['expense'], builtin: true },

  // Receitas
  { id: 'salario', label: 'Salário', icon: 'briefcase', appliesTo: ['income'], builtin: true },
  { id: 'freelance', label: 'Freelance', icon: 'laptop', appliesTo: ['income'], builtin: true },
  { id: 'investimentos', label: 'Investimentos', icon: 'trending-up', appliesTo: ['income'], builtin: true },

  // Aporte em meta: categoria única, atribuída automaticamente
  { id: 'meta', label: 'Aporte em meta', icon: 'target', appliesTo: ['contribution'], builtin: true },

  // Curinga, aceito em receita e despesa
  { id: 'outros', label: 'Outros', icon: 'circle-dashed', appliesTo: ['income', 'expense'], builtin: true },
]

/** Categoria usada quando um lançamento importado não tem correspondência. */
export const FALLBACK_CATEGORY_ID: CategoryId = 'outros'
export const CONTRIBUTION_CATEGORY_ID: CategoryId = 'meta'

export function categoriesFor(
  categories: readonly Category[],
  kind: TransactionKind,
): Category[] {
  return categories.filter((category) => category.appliesTo.includes(kind))
}

export function findCategory(
  categories: readonly Category[],
  id: CategoryId | undefined | null,
): Category | undefined {
  if (!id) return undefined
  return categories.find((category) => category.id === id)
}

export function categoryLabel(
  categories: readonly Category[],
  id: CategoryId | undefined | null,
): string {
  return findCategory(categories, id)?.label ?? 'Sem categoria'
}

export function categoryIcon(
  categories: readonly Category[],
  id: CategoryId | undefined | null,
): string {
  return findCategory(categories, id)?.icon ?? 'circle-dashed'
}

/**
 * Mapeia os rótulos livres da versão anterior para os identificadores atuais.
 * Fora dessa tabela, o texto vira slug e, se ainda assim não bater, cai em
 * "Outros" — nenhum lançamento antigo pode se perder na migração.
 */
export const LEGACY_CATEGORY_MAP: Record<string, CategoryId> = {
  alimentacao: 'alimentacao',
  moradia: 'moradia',
  transporte: 'transporte',
  saude: 'saude',
  educacao: 'educacao',
  lazer: 'lazer',
  compras: 'compras',
  trabalho: 'salario',
  investimentos: 'investimentos',
  meta: 'meta',
  outros: 'outros',
}
