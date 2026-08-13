import { useCallback, useEffect, useState } from 'react'
import { useAuthStore } from '@/store/authStore'
import { listUsers, type AdminUserSummary } from './adminApi'

/**
 * A última lista de contas que chegou, guardada entre navegações.
 *
 * Painel, Usuários e Relatórios consomem a mesma resposta, e sem isto cada
 * troca de menu voltava para o zero: tela de carregamento, ida à rede, e a
 * mesma lista de novo. Guardar o que já chegou faz a página seguinte abrir
 * pronta, e a atualização acontecer por baixo.
 *
 * Guardada junto com o dono. Duas contas de administração diferentes podem se
 * revezar na mesma aba, e a segunda nunca pode ver, nem por um quadro, a
 * lista que a primeira carregou.
 */
let cache: { userId: string; users: AdminUserSummary[] } | null = null

function adminAtual(): string | undefined {
  return useAuthStore.getState().session?.user.id
}

function cacheDaSessao(): AdminUserSummary[] | null {
  const userId = adminAtual()
  return cache && userId && cache.userId === userId ? cache.users : null
}

export function useAdminUsers() {
  // Estado inicial lido do que já foi buscado, e não `null`: é isso que
  // decide se a página nasce com conteúdo ou com carregamento.
  const [users, setUsers] = useState<AdminUserSummary[] | null>(cacheDaSessao)
  const [error, setError] = useState<string | null>(null)

  const buscar = useCallback(async (aceitar: () => boolean) => {
    try {
      const resultado = await listUsers()
      const userId = adminAtual()
      if (userId) cache = { userId, users: resultado }
      if (!aceitar()) return
      setUsers(resultado)
      setError(null)
    } catch (cause) {
      if (!aceitar()) return
      setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as contas.')
    }
  }, [])

  const reload = useCallback(() => buscar(() => true), [buscar])

  useEffect(() => {
    let ativo = true

    void buscar(() => ativo)

    // A resposta que chega depois de a pessoa sair da página não pode chamar
    // `setState` num componente desmontado, nem sobrescrever o que a página
    // seguinte já buscou.
    return () => {
      ativo = false
    }
  }, [buscar])

  return { users, loading: users === null && error === null, error, reload }
}
