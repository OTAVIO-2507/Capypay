import { DEFAULT_CATEGORIES } from '@/domain/categories'
import type { FinanceData } from '@/domain/types'

export const SCHEMA_VERSION = 2

/** Chave usada pela versão anterior. Só é lida, para migrar. */
export const LEGACY_STORAGE_KEY = 'financeFlowData'

export const STORAGE_KEY = 'controle-financeiro/v2'

export function createEmptyData(): FinanceData {
  return {
    schemaVersion: SCHEMA_VERSION,
    profile: {
      name: '',
      nickname: '',
      avatar: { image: '1', shape: 'circle' },
      greeting: true,
      onboardedAt: null,
    },
    settings: { theme: 'system', privacyMode: false },
    accounts: [],
    connections: [],
    categories: DEFAULT_CATEGORIES.map((category) => ({ ...category })),
    transactions: [],
    goals: [],
    budgets: {},
  }
}
