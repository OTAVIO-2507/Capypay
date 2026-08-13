import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { listAudit, type AuditEntry } from './adminApi'

/**
 * O histórico que já chegou, guardado entre navegações.
 *
 * Mesma razão e mesma forma do cache de contas (`useAdminUsers.ts`): sem ele,
 * cada volta à página mostra uma tela de carregamento para buscar de novo o
 * que acabou de ser lido. Como Auditoria e Relatórios leem a mesma resposta,
 * o cache também evita que a segunda página repita a consulta da primeira.
 *
 * Guardado junto com o dono, porque duas contas de administração podem se
 * revezar na mesma aba e a segunda não pode ver o que a primeira carregou.
 */
let cache: { userId: string; entries: AuditEntry[] } | null = null

function adminAtual(): string | undefined {
  return useAuthStore.getState().session?.user.id
}

function cacheDaSessao(): AuditEntry[] | null {
  const userId = adminAtual()
  return cache && userId && cache.userId === userId ? cache.entries : null
}

export function useAdminAudit() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(cacheDaSessao)
  const [error, setError] = useState<string | null>(null)

  const buscar = useCallback(async (aceitar: () => boolean) => {
    try {
      const resultado = await listAudit()
      const userId = adminAtual()
      if (userId) cache = { userId, entries: resultado }
      if (!aceitar()) return
      setEntries(resultado)
      setError(null)
    } catch (cause) {
      if (!aceitar()) return
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o histórico.')
    }
  }, [])

  const reload = useCallback(() => buscar(() => true), [buscar])

  useEffect(() => {
    let ativo = true

    void buscar(() => ativo)

    return () => {
      ativo = false
    }
  }, [buscar])

  return { entries, loading: entries === null && error === null, error, reload }
}
