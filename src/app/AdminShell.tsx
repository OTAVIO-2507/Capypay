import { useEffect } from 'react'
import { Outlet } from 'react-router-dom'
import { AdminTopBar } from '@/features/admin/AdminTopBar'
import { ADMIN_TOUR_STEPS, ADMIN_TOUR_TEXTOS } from '@/features/onboarding/adminTourSteps'
import { OnboardingTour } from '@/features/onboarding/OnboardingTour'
import { useAdminPreferences, useAdminProfile } from '@/store/adminPreferences'
import { useAuthStore } from '@/store/authStore'
import { ADMIN_NAV, ADMIN_SETTINGS_NAV } from './adminNavigation'
import { Shell } from './Shell'

/**
 * A moldura do painel de administração.
 *
 * Mesma `Shell` do app financeiro, com outra lista de destinos: a barra de
 * tinta, a aba deslizante e a moldura arredondada são as mesmas peças, não
 * uma imitação delas.
 *
 * O que muda é a barra de topo. Lá existem notificações, tema e modo
 * privacidade; os três leem ou escrevem `FinanceData.settings`, e uma sessão
 * de administração não tem (nem deve ter) esse documento carregado. Sobram o
 * e-mail de quem está logado e a saída.
 *
 * O tour de boas-vindas é o mesmo componente do lado do usuário, com outro
 * roteiro: ele ilumina a moldura de verdade, então precisa dela desenhada
 * atrás de si, e é por isso que mora aqui e não numa rota própria.
 */
export function AdminShell() {
  const perfil = useAdminProfile()
  const setProfile = useAdminPreferences((state) => state.setProfile)
  const adotarDono = useAdminPreferences((state) => state.adotarDono)
  const precisaDeTour = useAdminPreferences((state) => state.onboardedAt) === null
  const userId = useAuthStore((state) => state.session?.user.id)

  /*
   * As preferências de administração moram no navegador, então precisam saber
   * de quem são: duas contas de administração no mesmo computador dividiriam
   * nome, avatar e o marcador de tour sem isto.
   */
  useEffect(() => {
    if (userId) adotarDono(userId)
  }, [userId, adotarDono])

  return (
    <>
      <Shell
        nav={ADMIN_NAV}
        footerNav={ADMIN_SETTINGS_NAV}
        navLabel="Navegação do painel de administração"
        topBar={<AdminTopBar />}
      >
        <Outlet />
      </Shell>

      {precisaDeTour ? (
        <OnboardingTour
          roteiro={ADMIN_TOUR_STEPS}
          textos={ADMIN_TOUR_TEXTOS}
          perfil={perfil}
          onGravarNome={(name, nickname) => setProfile({ name, nickname })}
          onConcluir={(name, nickname) =>
            setProfile({ name, nickname, onboardedAt: Date.now() })
          }
        />
      ) : null}
    </>
  )
}
