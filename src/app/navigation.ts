import type { IconName } from '@/components/Icon'

export interface NavDestination {
  to: string
  label: string
  icon: IconName
  /**
   * Nome do alvo para o tour de boas-vindas iluminar
   * (ver `features/onboarding/tourSteps.ts`). Vira `data-tour` no link.
   * Opcional porque a navegação do admin não tem tour — lá não há o que
   * apresentar a quem só gerencia contas.
   */
  tour?: string
  /**
   * Casa só com o caminho exato. Padrão: verdadeiro apenas na raiz `/`.
   * O painel do admin precisa disto explícito porque `/admin` é prefixo de
   * `/admin/usuarios`, e sem ele os dois itens ficariam ativos ao mesmo tempo.
   */
  end?: boolean
}

/** Destinos principais, na ordem em que aparecem no rail e na barra inferior. */
export const PRIMARY_NAV: NavDestination[] = [
  { to: '/', label: 'Painel', icon: 'layout-dashboard', tour: 'nav-painel' },
  { to: '/transacoes', label: 'Transações', icon: 'arrow-left-right', tour: 'nav-transacoes' },
  { to: '/parcelamentos', label: 'Parcelamentos', icon: 'credit-card' },
  { to: '/assinaturas', label: 'Assinaturas', icon: 'repeat' },
  { to: '/orcamento', label: 'Orçamento', icon: 'chart-column', tour: 'nav-orcamento' },
  { to: '/metas', label: 'Metas', icon: 'target', tour: 'nav-metas' },
  { to: '/contas', label: 'Contas', icon: 'credit-card', tour: 'nav-contas' },
]

export const SETTINGS_NAV: NavDestination = {
  to: '/ajustes',
  label: 'Ajustes',
  icon: 'settings',
  tour: 'nav-ajustes',
}
