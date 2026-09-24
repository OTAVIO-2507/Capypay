import { Outlet } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { AssistantLauncher } from '@/features/assistant/AssistantLauncher'
import { OnboardingTour } from '@/features/onboarding/OnboardingTour'
import { TOUR_STEPS, TOUR_TEXTOS } from '@/features/onboarding/tourSteps'
import { NotificationsMenu } from '@/features/shell/NotificationsMenu'
import { ProfileMenu } from '@/features/shell/ProfileMenu'
import { cn } from '@/lib/cn'
import { useFinanceStore } from '@/store/financeStore'
import { useProfile, useSettings } from '@/store/hooks'
import { PRIMARY_NAV, RAIL_NAV, SETTINGS_NAV } from './navigation'
import { StorageWarning } from './Notices'
import { Shell } from './Shell'

/**
 * A moldura do app financeiro.
 *
 * A moldura em si mora em `Shell`, compartilhada com o painel de
 * administração. Aqui ficam só as partes que são deste lado: os destinos, os
 * controles globais da barra de topo, o aviso de falha de sincronia e o tour
 * de boas-vindas.
 */
export function AppShell() {
  // Só na primeira entrada de cada conta. Montado aqui, e não numa rota
  // própria, porque o tour ilumina a moldura de verdade (barra lateral,
  // cabeçalho, avatar) e precisa dela desenhada atrás de si.
  const perfil = useProfile()
  const updateProfile = useFinanceStore((state) => state.updateProfile)
  const precisaDeTour = perfil.onboardedAt === null

  return (
    <>
      <Shell
        nav={PRIMARY_NAV}
        railNav={[...RAIL_NAV, SETTINGS_NAV]}
        // O avatar no pé da barra lateral, como na referência. A partir de
        // 1024px ele sai do cabeçalho e vem para cá; abaixo disso não existe
        // barra lateral, e ele continua lá em cima.
        railFooter={<ProfileMenu placement="top" />}
        navLabel="Navegação principal"
        topBar={<TopBar />}
      >
        <StorageWarning />
        <Outlet />
      </Shell>

      <AssistantLauncher />

      {precisaDeTour ? (
        <OnboardingTour
          roteiro={TOUR_STEPS}
          textos={TOUR_TEXTOS}
          perfil={perfil}
          onGravarNome={(name, nickname) => updateProfile({ name, nickname })}
          onConcluir={(name, nickname) =>
            updateProfile({ name, nickname, onboardedAt: Date.now() })
          }
        />
      ) : null}
    </>
  )
}

/**
 * Controles globais.
 *
 * Três campos, na ordem em que se usam: avisos (o que exige atenção),
 * privacidade (como a tela se apresenta) e perfil (quem é você). O perfil vem
 * por último e separado por um divisor, porque é o único que não muda a tela:
 * ele abre um menu de conta.
 *
 * O alternador de tema morava entre avisos e privacidade, e saiu com o tema
 * único.
 */
function TopBar() {
  return (
    <div className="flex items-center gap-0.5">
      <NotificationsMenu />
      <PrivacyToggle />
      <span aria-hidden="true" className="mx-1.5 h-6 w-px bg-hairline lg:hidden" />
      <span className="lg:hidden">
        <ProfileMenu />
      </span>
    </div>
  )
}

function PrivacyToggle() {
  const privacyMode = useSettings().privacyMode
  const toggle = useFinanceStore((state) => state.togglePrivacy)

  return (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={privacyMode}
      aria-label={privacyMode ? 'Mostrar valores' : 'Ocultar valores'}
      title={privacyMode ? 'Mostrar valores' : 'Ocultar valores'}
      className={cn(
        'inline-flex size-10 items-center justify-center rounded-sm transition-colors duration-150',
        privacyMode ? 'bg-block text-block-ink' : 'text-faint hover:bg-sunken hover:text-ink',
      )}
    >
      <Icon name={privacyMode ? 'eye-off' : 'eye'} size={18} />
    </button>
  )
}

