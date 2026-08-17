import { Icon } from '@/components/Icon'
import { cn } from '@/lib/cn'

/**
 * A marca do serviço, desenhada aqui e não baixada de fora.
 *
 * A tentação é buscar o logo por uma API de logotipos, e o custo disso não
 * aparece na tela: cada imagem carregada conta a um terceiro que **esta**
 * pessoa assina **este** serviço, e uma lista de assinaturas é um retrato
 * bastante fiel de alguém. Num produto cujo argumento é que o extrato não sai
 * do dispositivo, isso seria contradizer a promessa por causa de um enfeite.
 *
 * O que dá para fazer sem nenhuma requisição é o essencial do reconhecimento:
 * a cor da marca e a inicial. É como se lê um ícone de aplicativo na tela do
 * celular a um metro de distância, e chega para varrer uma lista.
 *
 * Redistribuir o logo oficial embutido no código também não seria de graça:
 * são marcas registradas, com regras próprias de uso.
 */

/**
 * As marcas reconhecidas, com a cor de cada uma.
 *
 * A chave é procurada dentro da descrição normalizada, então "NETFLIX.COM" e
 * "Netflix Brasil" caem na mesma. A lista é curta de propósito: cobre o que
 * aparece com frequência em fatura brasileira, e quem não está aqui cai no
 * ícone da categoria, que continua dizendo do que se trata.
 */
const MARCAS: readonly { chave: string; nome: string; cor: string }[] = [
  { chave: 'netflix', nome: 'Netflix', cor: '#E50914' },
  { chave: 'spotify', nome: 'Spotify', cor: '#1DB954' },
  { chave: 'disney', nome: 'Disney+', cor: '#113CCF' },
  { chave: 'hbo', nome: 'Max', cor: '#0046FF' },
  { chave: 'prime video', nome: 'Prime Video', cor: '#00A8E1' },
  { chave: 'amazon', nome: 'Amazon', cor: '#FF9900' },
  { chave: 'youtube', nome: 'YouTube', cor: '#FF0000' },
  { chave: 'globoplay', nome: 'Globoplay', cor: '#FF4C00' },
  { chave: 'deezer', nome: 'Deezer', cor: '#A238FF' },
  { chave: 'paramount', nome: 'Paramount+', cor: '#0064FF' },
  { chave: 'crunchyroll', nome: 'Crunchyroll', cor: '#F47521' },
  { chave: 'apple', nome: 'Apple', cor: '#555555' },
  { chave: 'icloud', nome: 'iCloud', cor: '#3B82F6' },
  { chave: 'google', nome: 'Google', cor: '#4285F4' },
  { chave: 'microsoft', nome: 'Microsoft', cor: '#00A4EF' },
  { chave: 'adobe', nome: 'Adobe', cor: '#FF0000' },
  { chave: 'canva', nome: 'Canva', cor: '#00C4CC' },
  { chave: 'dropbox', nome: 'Dropbox', cor: '#0061FF' },
  { chave: 'openai', nome: 'OpenAI', cor: '#10A37F' },
  { chave: 'chatgpt', nome: 'ChatGPT', cor: '#10A37F' },
  { chave: 'hostinger', nome: 'Hostinger', cor: '#673DE6' },
  { chave: 'alura', nome: 'Alura', cor: '#00C86F' },
  { chave: 'udemy', nome: 'Udemy', cor: '#A435F0' },
  { chave: 'smartfit', nome: 'Smart Fit', cor: '#FFE000' },
  { chave: 'uber', nome: 'Uber', cor: '#000000' },
  { chave: 'ifood', nome: 'iFood', cor: '#EA1D2C' },
]

/** A marca reconhecida na descrição, ou nula quando nenhuma bate. */
export function findBrand(description: string): { nome: string; cor: string } | null {
  const texto = description
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  const encontrada = MARCAS.find((marca) => texto.includes(marca.chave))
  return encontrada ? { nome: encontrada.nome, cor: encontrada.cor } : null
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
      {marca.nome.charAt(0).toUpperCase()}
    </span>
  )
}
