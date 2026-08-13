import { useEffect, useState } from 'react'
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
export const useCategories = () => useFinanceStore((state) => state.data.categories)
export const useBudgets = () => useFinanceStore((state) => state.data.budgets)
export const useProfile = () => useFinanceStore((state) => state.data.profile)
export const useSettings = () => useFinanceStore((state) => state.data.settings)
export const usePrivacy = () => useFinanceStore((state) => state.data.settings.privacyMode)
export const useSelectedMonth = () => useFinanceStore((state) => state.selectedMonth)
export const useFinanceStatus = () => useFinanceStore((state) => state.status)

/**
 * O tema que está de fato na tela.
 *
 * A preferência guardada pode ser `'system'`, que não é um visual — é uma
 * delegação. Quem desenha um ícone de tema precisa saber o resultado, claro ou
 * escuro, e não a preferência; por isso a resolução mora aqui e não em cada
 * componente que quiser mostrar um sol ou uma lua.
 */
export function useResolvedTheme(): 'light' | 'dark' {
  const theme = useFinanceStore((state) => state.data.settings.theme)
  const [prefereEscuro, setPrefereEscuro] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(prefers-color-scheme: dark)').matches,
  )

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const aoMudar = () => setPrefereEscuro(media.matches)
    media.addEventListener('change', aoMudar)
    return () => media.removeEventListener('change', aoMudar)
  }, [])

  if (theme === 'dark') return 'dark'
  if (theme === 'light') return 'light'
  return prefereEscuro ? 'dark' : 'light'
}

/** Verdadeiro quando não existe nenhum lançamento, meta ou conta. */
export const useIsEmpty = () =>
  useFinanceStore(
    (state) =>
      state.data.transactions.length === 0 &&
      state.data.goals.length === 0 &&
      state.data.accounts.length === 0,
  )
