import { useFinanceStore } from './financeStore'

/**
 * Seletores nomeados sobre o store.
 *
 * Assinar o objeto inteiro faria todo componente re-renderizar a cada tecla
 * digitada em qualquer formulário. Cada hook aqui assina só a fatia que usa.
 */

export const useTransactions = () => useFinanceStore((state) => state.data.transactions)
export const useGoals = () => useFinanceStore((state) => state.data.goals)
export const useAccounts = () => useFinanceStore((state) => state.data.accounts)
export const useConnections = () => useFinanceStore((state) => state.data.connections)
export const useCategories = () => useFinanceStore((state) => state.data.categories)
export const useProfile = () => useFinanceStore((state) => state.data.profile)
export const useSettings = () => useFinanceStore((state) => state.data.settings)
export const usePrivacy = () => useFinanceStore((state) => state.data.settings.privacyMode)
export const useSelectedMonth = () => useFinanceStore((state) => state.selectedMonth)
export const useFinanceStatus = () => useFinanceStore((state) => state.status)

/** Verdadeiro quando não existe nenhum lançamento, meta ou conta. */
export const useIsEmpty = () =>
  useFinanceStore(
    (state) =>
      state.data.transactions.length === 0 &&
      state.data.goals.length === 0 &&
      state.data.accounts.length === 0,
  )
