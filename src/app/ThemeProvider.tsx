import { useEffect } from 'react'
import { useAdminPreferences } from '@/store/adminPreferences'
import { useAuthStore } from '@/store/authStore'
import { useSettings } from '@/store/hooks'

/**
 * Aplica o tema à raiz do documento.
 *
 * `'system'` é uma preferência viva, não uma leitura única: quem deixa no
 * automático espera que a tela acompanhe o sistema operacional mudando ao
 * anoitecer, sem recarregar a página. Por isso o listener no media query.
 *
 * A preferência vem de uma de duas fontes, conforme quem está logado. Sessão
 * de uso lê `FinanceData.settings`, que viaja com a conta entre dispositivos.
 * Sessão de administração lê `adminPreferences`, no armazenamento local,
 * porque um admin nunca carrega o documento financeiro de ninguém, nem o
 * próprio. Ler a fonte errada não daria erro visível: daria um tema que
 * ignora a escolha da pessoa, que é pior de diagnosticar.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const ehAdmin = useAuthStore((state) => state.role) === 'admin'
  const temaDoUsuario = useSettings().theme
  const temaDoAdmin = useAdminPreferences((state) => state.theme)
  const theme = ehAdmin ? temaDoAdmin : temaDoUsuario

  useEffect(() => {
    const media = window.matchMedia('(prefers-color-scheme: dark)')

    const apply = () => {
      const isDark = theme === 'dark' || (theme === 'system' && media.matches)
      document.documentElement.classList.toggle('dark', isDark)
      document
        .querySelector('meta[name="theme-color"]')
        ?.setAttribute('content', isDark ? '#0c0d10' : '#edeef0')
    }

    apply()
    if (theme !== 'system') return

    media.addEventListener('change', apply)
    return () => media.removeEventListener('change', apply)
  }, [theme])

  return children
}
