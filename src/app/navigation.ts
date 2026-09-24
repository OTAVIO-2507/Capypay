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
  { to: '/', label: 'Visão geral', icon: 'layout-dashboard', tour: 'nav-painel' },
  { to: '/transacoes', label: 'Transações', icon: 'arrow-left-right', tour: 'nav-transacoes' },
  { to: '/parcelamentos', label: 'Parcelamentos', icon: 'credit-card' },
  { to: '/assinaturas', label: 'Assinaturas', icon: 'repeat' },
  { to: '/categorias', label: 'Categorias', icon: 'tags', tour: 'nav-categorias' },
  { to: '/metas', label: 'Metas', icon: 'target', tour: 'nav-metas' },
  { to: '/contas', label: 'Contas', icon: 'credit-card', tour: 'nav-contas' },
]

/**
 * Os destinos da barra lateral. Não são seções — são ferramentas, e é isso
 * que a lateral guarda (ver `Shell`).
 *
 * "Importar extrato" só era alcançável por dentro de Ajustes, e é das ações
 * mais pontuais e mais procuradas do produto: quem acabou de conectar o banco
 * vem direto para cá.
 */
export const RAIL_NAV: NavDestination[] = [
  { to: '/importar', label: 'Importar extrato', icon: 'upload' },
]

export const SETTINGS_NAV: NavDestination = {
  to: '/ajustes',
  label: 'Ajustes',
  icon: 'settings',
  tour: 'nav-ajustes',
}
