import type { ReactElement } from 'react'
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/cn'
import {
  ChatLogo,
  CloudLogo,
  CourseLogo,
  GymLogo,
  NetflixLogo,
  SpotifyLogo,
  StreamLogo,
  YoutubeLogo,
} from './brandLogos'

/**
 * A marca do serviço, desenhada aqui e não baixada de fora.
 *
 * A tentação é buscar o logo por uma API de logotipos, e o custo disso não
 * aparece na tela: cada imagem carregada conta a um terceiro que **esta**
 * pessoa assina **este** serviço, e uma lista de assinaturas é um retrato
 * bastante fiel de alguém. Num produto cujo argumento é que o extrato não sai
 * do dispositivo, isso seria contradizer a promessa por causa de um enfeite.
 *
 * O que viaja junto com o aplicativo é o desenho: a cor da marca e uma forma
 * redesenhada em SVG, que é como se lê um ícone de aplicativo a um metro de
 * distância. Marca cuja forma exigiria copiar o arquivo oficial fica com a
 * inicial sobre a cor, que identifica sem reproduzir nada.
 */

/**
 * As marcas reconhecidas, com a cor de cada uma.
 *
 * A chave é procurada dentro da descrição normalizada, então "NETFLIX.COM" e
 * "Netflix Brasil" caem na mesma. A lista é curta de propósito: cobre o que
 * aparece com frequência em fatura brasileira, e quem não está aqui cai no
 * ícone da categoria, que continua dizendo do que se trata.
 */
type Desenho = () => ReactElement

const MARCAS: readonly { chave: string; nome: string; cor: string; logo?: Desenho }[] = [
  { chave: 'netflix', nome: 'Netflix', cor: '#E50914', logo: NetflixLogo },
  { chave: 'spotify', nome: 'Spotify', cor: '#1DB954', logo: SpotifyLogo },
  { chave: 'youtube', nome: 'YouTube', cor: '#FF0000', logo: YoutubeLogo },
  { chave: 'disney', nome: 'Disney+', cor: '#113CCF', logo: StreamLogo },
  { chave: 'hbo', nome: 'Max', cor: '#0046FF', logo: StreamLogo },
  { chave: 'prime video', nome: 'Prime Video', cor: '#00A8E1', logo: StreamLogo },
  { chave: 'globoplay', nome: 'Globoplay', cor: '#FF4C00', logo: StreamLogo },
  { chave: 'paramount', nome: 'Paramount+', cor: '#0064FF', logo: StreamLogo },
  { chave: 'crunchyroll', nome: 'Crunchyroll', cor: '#F47521', logo: StreamLogo },
  { chave: 'deezer', nome: 'Deezer', cor: '#A238FF', logo: SpotifyLogo },
  { chave: 'amazon', nome: 'Amazon', cor: '#FF9900' },
  { chave: 'apple', nome: 'Apple', cor: '#555555' },
  { chave: 'icloud', nome: 'iCloud', cor: '#3B82F6', logo: CloudLogo },
  { chave: 'google one', nome: 'Google One', cor: '#4285F4', logo: CloudLogo },
  { chave: 'dropbox', nome: 'Dropbox', cor: '#0061FF', logo: CloudLogo },
  { chave: 'google', nome: 'Google', cor: '#4285F4' },
  { chave: 'microsoft', nome: 'Microsoft', cor: '#00A4EF' },
  { chave: 'adobe', nome: 'Adobe', cor: '#FF0000' },
  { chave: 'canva', nome: 'Canva', cor: '#00C4CC' },
  { chave: 'openai', nome: 'OpenAI', cor: '#10A37F', logo: ChatLogo },
  { chave: 'chatgpt', nome: 'ChatGPT', cor: '#10A37F', logo: ChatLogo },
  { chave: 'hostinger', nome: 'Hostinger', cor: '#673DE6', logo: CloudLogo },
  { chave: 'alura', nome: 'Alura', cor: '#00C86F', logo: CourseLogo },
  { chave: 'udemy', nome: 'Udemy', cor: '#A435F0', logo: CourseLogo },
  { chave: 'coursera', nome: 'Coursera', cor: '#0056D2', logo: CourseLogo },
  { chave: 'smartfit', nome: 'Smart Fit', cor: '#FFE000', logo: GymLogo },
  { chave: 'bluefit', nome: 'Bluefit', cor: '#0B5FFF', logo: GymLogo },
  { chave: 'academia', nome: 'Academia', cor: '#3F3F46', logo: GymLogo },
  { chave: 'uber', nome: 'Uber', cor: '#000000' },
  { chave: 'ifood', nome: 'iFood', cor: '#EA1D2C' },
]

/** A marca reconhecida na descrição, ou nula quando nenhuma bate. */
export function findBrand(
  description: string,
): { nome: string; cor: string; logo?: Desenho } | null {
  const texto = description
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  const encontrada = MARCAS.find((marca) => texto.includes(marca.chave))
  if (!encontrada) return null
  return { nome: encontrada.nome, cor: encontrada.cor, logo: encontrada.logo }
}

/**
 * Decide entre tinta clara e escura sobre a cor da marca.
 *
 * Fixar branco quebraria no amarelo da Smart Fit, onde o contraste fica perto
 * de 1,1:1 e a letra some. A conta é a luminância relativa da própria cor, que
 * é a mesma que decide contraste em qualquer sistema de acessibilidade.
 */
function tintaSobre(cor: string): string {
  const hex = cor.replace('#', '')
  const canais = [0, 2, 4].map((inicio) => Number.parseInt(hex.slice(inicio, inicio + 2), 16) / 255)
  const [r, g, b] = canais.map((canal) =>
    canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4,
  )
  const luminancia = 0.2126 * r + 0.7152 * g + 0.0722 * b

  return luminancia > 0.45 ? '#111111' : '#ffffff'
}

interface Props {
  /** A descrição do lançamento, de onde a marca é reconhecida. */
  label: string
  /** Ícone da categoria, usado quando a marca não é conhecida. */
  fallbackIcon: string
  fallbackColor?: string | null
  size?: number
  className?: string
}

export function BrandMark({ label, fallbackIcon, fallbackColor, size = 36, className }: Props) {
  const marca = findBrand(label)

  if (!marca) {
    return (
      <span
        style={{ backgroundColor: fallbackColor ?? undefined, width: size, height: size }}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-lg',
          fallbackColor ? 'text-white' : 'bg-sunken text-faint',
          className,
        )}
      >
        <Icon name={fallbackIcon as never} size={Math.round(size * 0.44)} />
      </span>
    )
  }

  return (
    <span
      title={marca.nome}
      style={{
        backgroundColor: marca.cor,
        color: tintaSobre(marca.cor),
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
      }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-lg font-semibold',
        className,
      )}
    >
      {/*
        O desenho quando existe, a inicial quando não. As duas formas ocupam a
        mesma pastilha e a mesma cor, então a lista continua alinhada mesmo com
        marcas de origens diferentes lado a lado.
      */}
      {marca.logo ? <marca.logo /> : marca.nome.charAt(0).toUpperCase()}
    </span>
  )
}
