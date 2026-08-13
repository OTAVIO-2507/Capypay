import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { FullPageLoader } from '@/components/FullPageLoader'
import { useAuthStore } from '@/store/authStore'
import { useFinanceStore } from '@/store/financeStore'
import { useFinanceStatus } from '@/store/hooks'
import { AdminShell } from './AdminShell'
import { AppShell } from './AppShell'
import { resolveGuardOutcome } from './guardLogic'

/**
 * Porta do painel financeiro. Único lugar que administra o ciclo de vida da
 * `financeStore` junto com a sessão — dispara `loadForUser()` ao entrar como
 * usuário, e `reset()` sempre que deixar de ser esse caso, para que uma
 * segunda pessoa logando na mesma aba nunca herde os dados da primeira.
 */
export function RequireUser() {
  const authStatus = useAuthStore((state) => state.status)
  const role = useAuthStore((state) => state.role)
  const financeStatus = useFinanceStatus()
  const loadForUser = useFinanceStore((state) => state.loadForUser)
  const reset = useFinanceStore((state) => state.reset)

  useEffect(() => {
    if (authStatus === 'signedIn' && role === 'user') {
      if (financeStatus === 'idle') void loadForUser()
    } else if (financeStatus !== 'idle') {
      reset()
    }
  }, [authStatus, role, financeStatus, loadForUser, reset])

  const outcome = resolveGuardOutcome({ status: authStatus, role }, 'user')

  if (outcome === 'loading') return <FullPageLoader />
  if (outcome === 'redirect-login') return <Navigate to="/login" replace />
  if (outcome === 'redirect-admin-home') return <Navigate to="/admin" replace />
  // outcome === 'allow': falta só os dados financeiros, que carregam à parte.
  if (financeStatus !== 'ready') return <FullPageLoader />

  return <AppShell />
}

/**
 * Porta do painel admin. Sem nenhum envolvimento da `financeStore` — um
 * admin nunca dispara `loadForUser()`, nem para os próprios dados.
 */
export function RequireAdmin() {
  const authStatus = useAuthStore((state) => state.status)
  const role = useAuthStore((state) => state.role)

  const outcome = resolveGuardOutcome({ status: authStatus, role }, 'admin')

  if (outcome === 'loading') return <FullPageLoader />
  if (outcome === 'redirect-login') return <Navigate to="/login" replace />
  if (outcome === 'redirect-user-home') return <Navigate to="/" replace />

  return <AdminShell />
}
