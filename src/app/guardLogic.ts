import type { AuthStatus, Role } from '@/store/authStore'

export type GuardOutcome =
  | 'loading'
  | 'redirect-login'
  | 'redirect-user-home'
  | 'redirect-admin-home'
  | 'allow'

/**
 * A decisão de roteamento por papel, isolada como função pura.
 *
 * Separada de `routeGuards.tsx` de propósito: aquele arquivo importa
 * `AppShell`/`AdminShell`, que arrastam a `financeStore` e o cliente
 * Supabase — importá-los num teste exigiria credenciais reais só para
 * checar uma tabela de decisão. Este arquivo só importa tipos (apagados na
 * compilação), então testar isto aqui não toca em nada com efeito colateral
 * — o mesmo espírito dos outros testes do projeto.
 */
export function resolveGuardOutcome(
  auth: { status: AuthStatus; role: Role | null },
  requiredRole: Role,
): GuardOutcome {
  if (auth.status === 'loading') return 'loading'
  /*
   * `mfaRequired` é senha aceita e segundo fator pendente. Vale como fora,
   * e não como um estado intermediário com acesso reduzido: meio acesso a um
   * app de finanças é acesso.
   */
  if (auth.status === 'signedOut' || auth.status === 'mfaRequired') return 'redirect-login'
  if (auth.role === requiredRole) return 'allow'
  return auth.role === 'admin' ? 'redirect-admin-home' : 'redirect-user-home'
}
