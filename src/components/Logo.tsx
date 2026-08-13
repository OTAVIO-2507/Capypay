import logoUrl from '@/assets/logo.png'
import { cn } from '@/lib/cn'

interface LogoProps {
  /** Lado do quadrado da marca, em pixels. */
  size?: number
  /**
   * Marca decorativa: some para o leitor de tela. Use quando o nome já estiver
   * escrito ao lado — anunciar "CapyPay CapyPay" é pior que não anunciar nada.
   */
  decorative?: boolean
  className?: string
}

/**
 * A marca do projeto — uma capivara com uma pilha de moedas.
 *
 * O arquivo entra como **máscara CSS**, e não como elemento de imagem. A arte
 * é traço em cor única, e a barra lateral inverte de tinta para papel entre os
 * temas: uma imagem comum ficaria branca sobre fundo branco em metade dos
 * casos. Como máscara, ela pinta com `currentColor` e acompanha o contexto
 * sozinha, sem precisar de duas versões do arquivo nem de filtro de inversão.
 *
 * O `role="img"` com rótulo existe porque, para o navegador, isto é uma caixa
 * vazia com fundo — sem ele a marca simplesmente não existiria para quem usa
 * leitor de tela.
 */
export function Logo({ size = 28, decorative = false, className }: LogoProps) {
  return (
    <span
      role={decorative ? undefined : 'img'}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : 'CapyPay'}
      style={{
        width: size,
        height: size,
        maskImage: `url(${logoUrl})`,
        WebkitMaskImage: `url(${logoUrl})`,
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
      className={cn('inline-block shrink-0 bg-current', className)}
    />
  )
}
