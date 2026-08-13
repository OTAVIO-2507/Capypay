import { createBrowserRouter } from 'react-router-dom'
import { RequireAdmin, RequireUser } from './routeGuards'
import { AccountsPage } from '@/pages/AccountsPage'
import { AdminAuditPage } from '@/pages/AdminAuditPage'
import { AdminDashboardPage } from '@/pages/AdminDashboardPage'
import { AdminReportsPage } from '@/pages/AdminReportsPage'
import { AdminSettingsPage } from '@/pages/AdminSettingsPage'
import { AdminUsersPage } from '@/pages/AdminUsersPage'
import { BudgetPage } from '@/pages/BudgetPage'
import { DashboardPage } from '@/pages/DashboardPage'
import { ErrorPage } from '@/pages/ErrorPage'
import { GoalsPage } from '@/pages/GoalsPage'
import { LoginPage } from '@/pages/LoginPage'
import { NotFoundPage } from '@/pages/NotFoundPage'
import { SettingsPage } from '@/pages/SettingsPage'
import { TransactionsPage } from '@/pages/TransactionsPage'

/**
 * `BASE_URL` vem do `base` do Vite: em produção o GitHub Pages serve a partir
 * de `/Capypay/`, e sem o `basename` todo link apontaria para a
 * raiz do domínio. No dev ele é `/` e nada muda.
 *
 * O `basename` traz um risco que vale nomear: se o endereço aberto não começa
 * por ele, nada casa e o roteador cai no `errorElement` da raiz — sem shell,
 * sem navegação, sem caminho de volta. É por isso que a `ErrorPage` mostra o
 * caminho aberto e a base esperada, e volta por `<a href>` em vez de `<Link>`.
 */
export const router = createBrowserRouter(
  [
    { path: '/login', element: <LoginPage />, errorElement: <ErrorPage /> },
    {
      path: '/',
      // `RequireUser` só renderiza o `AppShell` depois de confirmar sessão e
      // papel — ver `src/app/routeGuards.tsx`.
      element: <RequireUser />,
      // Cobre exceção de renderização e rota não encontrada — a própria página
      // distingue os dois casos, que pedem ações diferentes.
      errorElement: <ErrorPage />,
      children: [
        { index: true, element: <DashboardPage /> },
        { path: 'transacoes', element: <TransactionsPage /> },
        { path: 'orcamento', element: <BudgetPage /> },
        { path: 'metas', element: <GoalsPage /> },
        { path: 'contas', element: <AccountsPage /> },
        { path: 'ajustes', element: <SettingsPage /> },
        // Caminho desconhecido *dentro* da base: aqui o shell existe, então a
        // pessoa continua navegando pelo rail em vez de ficar presa.
        { path: '*', element: <NotFoundPage /> },
      ],
    },
    {
      path: '/admin',
      element: <RequireAdmin />,
      errorElement: <ErrorPage />,
      children: [
        { index: true, element: <AdminDashboardPage /> },
        { path: 'usuarios', element: <AdminUsersPage /> },
        { path: 'relatorios', element: <AdminReportsPage /> },
        { path: 'auditoria', element: <AdminAuditPage /> },
        { path: 'ajustes', element: <AdminSettingsPage /> },
      ],
    },
  ],
  { basename: import.meta.env.BASE_URL },
)
