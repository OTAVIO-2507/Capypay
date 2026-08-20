import type { ReactElement } from 'react'
import aluraArte from '@/assets/brands/alura.png'
import amazonArte from '@/assets/brands/amazon.png'
import anthropicArte from '@/assets/brands/anthropic.png'
import boticarioArte from '@/assets/brands/boticario.png'
import dorinhosArte from '@/assets/brands/dorinhos.png'
import eniacArte from '@/assets/brands/eniac.png'
import googleArte from '@/assets/brands/google.png'
import hostingerArte from '@/assets/brands/hostinger.png'
import ironLegacyArte from '@/assets/brands/ironlegacy-training-center.png'
import localizaArte from '@/assets/brands/localiza.png'
import primeVideoArte from '@/assets/brands/prime-video.png'
import vivoArte from '@/assets/brands/vivo.png'
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

/**
 * Três formas de identificar, nesta ordem de preferência.
 *
 * `imagem` é a arte oficial da marca, guardada em `src/assets/brands/` e
 * servida pelo próprio aplicativo. Continua valendo que nada é buscado de
 * terceiro: o arquivo viaja no pacote, então ninguém de fora fica sabendo o
 * que esta pessoa assina. `logo` é o desenho em SVG, para marca cuja forma se
 * reconstitui com honestidade em poucas figuras geométricas. Sem os dois,
 * sobra a inicial sobre a cor, que identifica sem reproduzir nada.
 */
const MARCAS: readonly {
  chave: string
  nome: string
  cor: string
  logo?: Desenho
  imagem?: string
}[] = [
  { chave: 'netflix', nome: 'Netflix', cor: '#E50914', logo: NetflixLogo },
  { chave: 'spotify', nome: 'Spotify', cor: '#1DB954', logo: SpotifyLogo },
  { chave: 'youtube', nome: 'YouTube', cor: '#FF0000', logo: YoutubeLogo },
  { chave: 'disney', nome: 'Disney+', cor: '#113CCF', logo: StreamLogo },
  { chave: 'hbo', nome: 'Max', cor: '#0046FF', logo: StreamLogo },
  { chave: 'prime video', nome: 'Prime Video', cor: '#1399DA', imagem: primeVideoArte },
  { chave: 'globoplay', nome: 'Globoplay', cor: '#FF4C00', logo: StreamLogo },
  { chave: 'paramount', nome: 'Paramount+', cor: '#0064FF', logo: StreamLogo },
  { chave: 'crunchyroll', nome: 'Crunchyroll', cor: '#F47521', logo: StreamLogo },
  { chave: 'deezer', nome: 'Deezer', cor: '#A238FF', logo: SpotifyLogo },
  { chave: 'amazon', nome: 'Amazon', cor: '#FF9900', imagem: amazonArte },
  { chave: 'apple', nome: 'Apple', cor: '#555555' },
  { chave: 'icloud', nome: 'iCloud', cor: '#3B82F6', logo: CloudLogo },
  { chave: 'google one', nome: 'Google One', cor: '#4285F4', imagem: googleArte },
  { chave: 'dropbox', nome: 'Dropbox', cor: '#0061FF', logo: CloudLogo },
  { chave: 'google', nome: 'Google', cor: '#4285F4', imagem: googleArte },
  { chave: 'microsoft', nome: 'Microsoft', cor: '#00A4EF' },
  { chave: 'adobe', nome: 'Adobe', cor: '#FF0000' },
  { chave: 'canva', nome: 'Canva', cor: '#00C4CC' },
  { chave: 'claude', nome: 'Claude', cor: '#D97757', imagem: anthropicArte },
  { chave: 'anthropic', nome: 'Claude', cor: '#D97757', imagem: anthropicArte },
  { chave: 'openai', nome: 'OpenAI', cor: '#10A37F', logo: ChatLogo },
  { chave: 'chatgpt', nome: 'ChatGPT', cor: '#10A37F', logo: ChatLogo },
  { chave: 'hostinger', nome: 'Hostinger', cor: '#673DE6', imagem: hostingerArte },
  { chave: 'alura', nome: 'Alura', cor: '#0E1116', imagem: aluraArte },
  { chave: 'udemy', nome: 'Udemy', cor: '#A435F0', logo: CourseLogo },
  { chave: 'coursera', nome: 'Coursera', cor: '#0056D2', logo: CourseLogo },
  { chave: 'smartfit', nome: 'Smart Fit', cor: '#FFE000', logo: GymLogo },
  { chave: 'bluefit', nome: 'Bluefit', cor: '#0B5FFF', logo: GymLogo },
  { chave: 'iron legacy', nome: 'Iron Legacy', cor: '#111111', imagem: ironLegacyArte },
  { chave: 'academia', nome: 'Academia', cor: '#3F3F46', logo: GymLogo },
  { chave: 'vivo', nome: 'Vivo', cor: '#660099', imagem: vivoArte },
  { chave: 'boticario', nome: 'O Boticário', cor: '#00706A', imagem: boticarioArte },
  { chave: 'dorinho', nome: "Dorinho's", cor: '#1A2456', imagem: dorinhosArte },
  { chave: 'eniac', nome: 'Eniac', cor: '#0E3A55', imagem: eniacArte },
  { chave: 'localiza', nome: 'Localiza', cor: '#009640', imagem: localizaArte },
  { chave: 'uber', nome: 'Uber', cor: '#000000' },
  { chave: 'ifood', nome: 'iFood', cor: '#EA1D2C' },
]

/** A marca reconhecida na descrição, ou nula quando nenhuma bate. */
export function findBrand(
  description: string,
): { nome: string; cor: string; logo?: Desenho; imagem?: string } | null {
  const texto = description
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  const encontrada = MARCAS.find((marca) => texto.includes(marca.chave))
  if (!encontrada) return null
  return {
    nome: encontrada.nome,
    cor: encontrada.cor,
    logo: encontrada.logo,
    imagem: encontrada.imagem,
  }
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

/**
 * Quadrado de canto arredondado, e não círculo.
 *
 * A pastilha do extrato é redonda porque carrega um ícone de categoria, que é
 * um desenho de linha com folga de sobra nas bordas. Aqui ela carrega arte de
 * marca, que vem quadrada e com o desenho encostando nos cantos: recortar em
 * círculo come as pontas do "prime video" e da letra que estiver na quina. O
 * formato acompanha o conteúdo, que é o mesmo motivo de todo ícone de
 * aplicativo do mundo ser um quadrado arredondado.
 */
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
        style={{
          backgroundColor: fallbackColor ?? undefined,
          width: size,
          height: size,
        }}
        className={cn(
          'inline-flex shrink-0 items-center justify-center rounded-sm',
          fallbackColor ? 'text-white' : 'bg-sunken text-faint',
          className,
        )}
      >
        <Icon name={fallbackIcon as never} size={Math.round(size * 0.44)} />
      </span>
    )
  }

  /*
    A arte oficial ocupa a pastilha inteira, borda a borda, porque ela já vem
    com o fundo da marca embutido: o branco do Claude, o roxo da Vivo. Pintar
    a pastilha por baixo só criaria uma moldura de cor errada em volta.

    O anel de hairline existe por causa das duas artes claras. Sobre a folha
    branca do tema claro, o quadrado do Claude e o do Google não têm onde
    terminar, e a marca fica boiando sem contorno.
  */
  if (marca.imagem) {
    return (
      <img
        src={marca.imagem}
        alt=""
        title={marca.nome}
        loading="lazy"
        decoding="async"
        style={{ width: size, height: size }}
        className={cn('shrink-0 rounded-sm object-cover ring-1 ring-hairline', className)}
      />
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
        'inline-flex shrink-0 items-center justify-center rounded-sm font-semibold',
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
