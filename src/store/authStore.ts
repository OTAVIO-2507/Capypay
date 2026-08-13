import type { Session } from '@supabase/supabase-js'
import { create } from 'zustand'
import { supabase } from '@/data/supabaseClient'
import {
  descartarInscricao,
  devolverOferta,
  precisaDeSegundaEtapa,
  verificarNoLogin,
} from '@/features/security/twoFactor'
import { mapAuthError } from './authErrors'

/**
 * `mfaRequired` é uma sessão pela metade: a senha passou, mas a conta exige
 * um segundo fator que ainda não foi apresentado. Vale como "não entrou" para
 * todo guarda de rota, e só a tela de login sabe o que fazer com ela.
 */
export type AuthStatus = 'loading' | 'signedIn' | 'signedOut' | 'mfaRequired'
export type Role = 'user' | 'admin'

interface AuthState {
  status: AuthStatus
  session: Session | null
  role: Role | null
  authError: string | null

  signIn: (email: string, password: string) => Promise<{ error: string | null }>
  /** Segunda etapa do login, quando a conta exige aplicativo autenticador. */
  submitSecondFactor: (codigo: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
}

/**
 * Identidade e papel, separados de `financeStore` de propósito.
 *
 * Uma conta admin precisa ser estruturalmente incapaz de carregar dados
 * financeiros — não só impedida pela UI. Manter as duas lojas separadas é o
 * que torna isso verdade: nada aqui importa `financeStore`, e `financeStore`
 * só reage a este estado através de `RequireUser` (`app/routeGuards.tsx`).
 */
export const useAuthStore = create<AuthState>()((set) => ({
  status: 'loading',
  session: null,
  role: null,
  authError: null,

  signIn: async (email, password) => {
    // Cada entrada é uma pergunta nova sobre a verificação em duas etapas.
    // Um "agora não" vale para a entrada em que foi dito, e não para todas as
    // seguintes até o navegador fechar.
    devolverOferta()
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    return { error: error ? mapAuthError(error) : null }
  },

  submitSecondFactor: async (codigo) => {
    try {
      await verificarNoLogin(codigo)
      // `challengeAndVerify` eleva a sessão para AAL2 mas não dispara o
      // listener de sessão: o token é o mesmo, só o nível mudou. Sem reavaliar
      // à mão, a tela ficaria presa pedindo o código que já foi aceito.
      await syncSession(useAuthStore.getState().session)
      return { error: null }
    } catch (cause) {
      return { error: cause instanceof Error ? cause.message : 'Não foi possível verificar.' }
    }
  },

  signOut: async () => {
    // Limpo aqui, antes do listener reagir — evita que um erro antigo de
    // "conta não confirmada" sobreviva a uma saída manual e comum.
    set({ authError: null })
    await supabase.auth.signOut()
  },
}))

/**
 * Toda transição de sessão passa por aqui, e só por aqui — é o único lugar
 * que decide `status`, para as duas ações acima nunca poderem divergir do
 * listener sobre o que está de fato acontecendo.
 */
async function syncSession(session: Session | null) {
  /*
   * O QR guardado pertence a uma conta, e o cache dele é de módulo: sem
   * descartá-lo aqui, quem entrasse depois de outra pessoa na mesma aba
   * receberia o código de inscrição alheio. O cadastro falharia (o fator não
   * é da conta nova), mas só depois de a pessoa ter guardado no aplicativo
   * autenticador dela o segredo de outra conta.
   *
   * Descarta em toda troca de identidade, e não só na saída: entrar
   * diretamente com outra conta, sem sair antes, é o mesmo caso.
   */
  const anterior = useAuthStore.getState().session?.user.id
  if (session?.user.id !== anterior) descartarInscricao()

  if (!session) {
    // Preserva `authError`: quando este ramo roda por causa do `signOut()`
    // disparado abaixo (perfil não encontrado), o aviso não pode desaparecer
    // antes da pessoa lê-lo.
    useAuthStore.setState((state) => ({
      status: 'signedOut',
      session: null,
      role: null,
      authError: state.authError,
    }))
    return
  }

  /*
   * Mesma pessoa, entrada já resolvida: guarda o token novo e não mexe em
   * mais nada.
   *
   * O Supabase reemite a sessão sempre que a aba volta ao foco e sempre que
   * renova o token, sem que nada tenha mudado de verdade. Passar por baixo
   * levava `status` a `loading`, e `loading` faz os guardas de rota trocarem
   * a tela inteira pelo carregador e a `financeStore` se resetar — voltar de
   * outra aba custava o app inteiro recarregado, e o lugar onde a pessoa
   * estava.
   *
   * Papel e segundo fator não são reconsultados aqui de propósito: os dois
   * pertencem à identidade, e identidade não muda no meio de uma sessão sem
   * passar por uma entrada nova.
   */
  const atual = useAuthStore.getState()
  if (atual.status === 'signedIn' && atual.session?.user.id === session.user.id) {
    useAuthStore.setState({ session })
    return
  }

  useAuthStore.setState({ status: 'loading', session })

  /*
   * A segunda etapa é checada antes do perfil, e a ordem importa: enquanto a
   * sessão está em AAL1 ela não deve ser tratada como entrada completa em
   * lugar nenhum, nem para ler o próprio papel.
   */
  if (await precisaDeSegundaEtapa()) {
    useAuthStore.setState({ status: 'mfaRequired', session, role: null })
    return
  }

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', session.user.id)
    .maybeSingle()

  if (error || !profile) {
    useAuthStore.setState({
      status: 'signedOut',
      session: null,
      role: null,
      authError: 'Não foi possível confirmar sua conta. Tente entrar novamente.',
    })
    void supabase.auth.signOut()
    return
  }

  useAuthStore.setState({
    status: 'signedIn',
    session,
    role: profile.role as Role,
    authError: null,
  })
}

// Dispara uma vez, de imediato, com a sessão persistida (se houver) — e de
// novo a cada login/logout depois disso. É a única fonte de verdade das
// transições, em todo o app.
supabase.auth.onAuthStateChange((_event, session) => {
  void syncSession(session)
})
