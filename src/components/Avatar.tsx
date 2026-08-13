import { AVATAR_IMAGE_SRC } from '@/components/avatarImages'
import type { Profile } from '@/domain/types'
import { cn } from '@/lib/cn'

interface AvatarProps {
  profile: Profile
  size?: number
  className?: string
}

/**
 * O raio do retrato, exportado.
 *
 * Quem envolve o avatar num botão precisa do mesmo raio para o anel de foco
 * e de hover acompanhar o formato escolhido: anel redondo em volta de retrato
 * quadrado é o tipo de desencontro que só aparece depois que alguém troca a
 * forma. Uma fórmula só, num lugar só.
 */
export function avatarRadius(shape: Profile['avatar']['shape'], size: number): string {
  // O quadrado arredondado acompanha o tamanho: raio fixo num avatar pequeno
  // vira quase círculo, e num grande vira quase quadrado.
  return shape === 'circle' ? '9999px' : `${Math.round(size * 0.32)}px`
}

/**
 * O avatar: um dos vinte retratos ilustrados embutidos no aplicativo, num
 * formato circular ou quadrado arredondado — artes prontas, não um upload.
 *
 * É a única exceção de cor do sistema inteiro, que fora daqui é só preto,
 * branco e cinza. Ela fica contida aqui porque um retrato é a única coisa na
 * tela que representa uma pessoa, e não um dado.
 */
export function Avatar({ profile, size = 40, className }: AvatarProps) {
  const { image, shape } = profile.avatar

  return (
    <span
      aria-hidden="true"
      style={{ width: size, height: size, borderRadius: avatarRadius(shape, size) }}
      className={cn(
        'inline-block shrink-0 overflow-hidden bg-sunken transition-[border-radius] duration-200',
        className,
      )}
    >
      <img src={AVATAR_IMAGE_SRC[image]} alt="" className="size-full object-cover" />
    </span>
  )
}
