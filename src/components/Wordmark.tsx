import { Logo } from '@/components/Logo'
import { cn } from '@/lib/cn'

interface WordmarkProps {
  size?: 'sm' | 'md'
  className?: string
}

/**
 * O logotipo: a capivara ao lado do nome.
 *
 * Esta é a **única** exceção à regra de uma família só. A interface inteira é
 * Geist, uma face de trabalho escolhida para desaparecer; um logotipo tem o
 * trabalho oposto, que é ser reconhecido. Figtree entra pesada e geométrica,
 * com o desenho fechado que o nome pede — e não sai daqui: nenhum outro texto
 * do produto usa esta face.
 *
 * O nome vai em um peso só. Diferenciar "Capy" de "Pay" por peso é o tipo de
 * truque que parece esperto no primeiro dia e vira ruído no centésimo.
 */
export function Wordmark({ size = 'md', className }: WordmarkProps) {
  return (
    <span className={cn('flex items-center', size === 'sm' ? 'gap-2.5' : 'gap-3', className)}>
      {/* Decorativa aqui: o nome está escrito ao lado e já é anunciado. */}
      <Logo decorative size={size === 'sm' ? 26 : 30} />
      <span
        className={cn(
          'font-[Figtree_Variable,var(--font-sans)] font-extrabold tracking-[-0.035em]',
          size === 'sm' ? 'text-[1.0625rem]' : 'text-[1.1875rem]',
        )}
      >
        CapyPay
      </span>
    </span>
  )
}
