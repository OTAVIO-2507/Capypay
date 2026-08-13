import type { NavDestination } from './navigation'

/**
 * Dois destinos: como está a plataforma e quem tem acesso a ela.
 *
 * `end` no primeiro é obrigatório, e não estilo: `/admin` é prefixo de
 * `/admin/usuarios`, então sem ele o item Painel ficaria marcado como ativo
 * junto com Usuários, e a aba deslizante teria dois lugares para parar.
 */
export const ADMIN_NAV: NavDestination[] = [
  { to: '/admin', label: 'Painel', icon: 'layout-dashboard', end: true, tour: 'admin-nav-painel' },
  { to: '/admin/usuarios', label: 'Usuários', icon: 'users', tour: 'admin-nav-usuarios' },
  {
    to: '/admin/relatorios',
    label: 'Relatórios',
    icon: 'chart-column',
    tour: 'admin-nav-relatorios',
  },
  { to: '/admin/auditoria', label: 'Auditoria', icon: 'list-filter', tour: 'admin-nav-auditoria' },
]

/** Separado no rodapé da barra, como Ajustes do lado do usuário. */
export const ADMIN_SETTINGS_NAV: NavDestination = {
  to: '/admin/ajustes',
  label: 'Ajustes',
  icon: 'settings',
  tour: 'admin-nav-ajustes',
}
