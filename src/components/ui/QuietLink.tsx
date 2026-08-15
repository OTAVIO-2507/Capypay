import { Link } from 'react-router-dom'
import { Icon } from '@/components/Icon'

/**
 * A saída discreta de um painel: leva ao lugar onde o assunto tem página
 * inteira, sem competir com o conteúdo que está sendo mostrado.
 *
 * Veste tinta apagada em repouso e só ganha superfície no hover, porque um
 * botão de verdade no cabeçalho de cada painel encheria a tela de convites
 * concorrentes — e nenhum deles é a ação principal de nada.
 */
export function QuietLink({ to, children }: { to: string; children: string }) {
  return (
    <Link
      to={to}
      className="inline-flex h-9 items-center gap-1.5 rounded-full px-3.5 text-xs font-semibold text-muted transition-colors duration-150 hover:bg-sunken hover:text-ink"
    >
      {children}
      <Icon name="arrow-right" size={13} />
    </Link>
  )
}
