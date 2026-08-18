/**
 * A identidade visual do banco, para o cartão do painel parecer o cartão real.
 *
 * Um cartão desenhado em tinta neutra é o mesmo desenho para todo mundo, e quem
 * conectou o Inter espera ver laranja. O reconhecimento aqui não é enfeite: é o
 * que faz a pessoa saber de qual conta o painel está falando antes de ler
 * qualquer texto, do mesmo jeito que ela reconhece o cartão dentro da carteira.
 *
 * As cores são as institucionais de cada banco, aplicadas a um desenho que é
 * nosso. Nenhuma marca é reproduzida.
 */

export interface BankBrand {
  nome: string
  /** Fundo do cartão. */
  cor: string
  /** Tinta sobre o fundo, escolhida pela luminância da cor. */
  tinta: string
}

const BANCOS: readonly { chaves: readonly string[]; nome: string; cor: string }[] = [
  { chaves: ['inter'], nome: 'Inter', cor: '#FF7A00' },
  { chaves: ['nubank', 'nu pagamentos'], nome: 'Nubank', cor: '#820AD1' },
  { chaves: ['itau', 'itaú'], nome: 'Itaú', cor: '#EC7000' },
  { chaves: ['bradesco'], nome: 'Bradesco', cor: '#CC092F' },
  { chaves: ['banco do brasil', 'bb '], nome: 'Banco do Brasil', cor: '#FAE128' },
  { chaves: ['santander'], nome: 'Santander', cor: '#EC0000' },
  { chaves: ['caixa'], nome: 'Caixa', cor: '#0070AF' },
  { chaves: ['c6 bank', 'c6bank', 'c6 '], nome: 'C6 Bank', cor: '#242424' },
  { chaves: ['picpay'], nome: 'PicPay', cor: '#21C25E' },
  { chaves: ['mercado pago'], nome: 'Mercado Pago', cor: '#00B1EA' },
  { chaves: ['original'], nome: 'Original', cor: '#00A64F' },
  { chaves: ['safra'], nome: 'Safra', cor: '#003B71' },
  { chaves: ['btg'], nome: 'BTG Pactual', cor: '#0D2535' },
  { chaves: ['xp '], nome: 'XP', cor: '#0F0F0F' },
  { chaves: ['sicoob'], nome: 'Sicoob', cor: '#00AE9D' },
  { chaves: ['sicredi'], nome: 'Sicredi', cor: '#3FA110' },
  { chaves: ['banrisul'], nome: 'Banrisul', cor: '#0072BC' },
  { chaves: ['pan'], nome: 'Banco Pan', cor: '#00A9E0' },
  { chaves: ['neon'], nome: 'Neon', cor: '#00E5B0' },
  { chaves: ['will bank', 'willbank'], nome: 'Will Bank', cor: '#FFD100' },
]

/**
 * Decide entre tinta clara e escura sobre a cor do banco.
 *
 * Fixar branco quebraria no amarelo do Banco do Brasil e do Will, onde o
 * contraste fica perto de 1,1:1 e o texto some. A conta é a luminância
 * relativa, a mesma que decide contraste em qualquer sistema de acessibilidade.
 */
function tintaSobre(cor: string): string {
  const hex = cor.replace('#', '')
  const canais = [0, 2, 4].map((inicio) => Number.parseInt(hex.slice(inicio, inicio + 2), 16) / 255)
  const [r, g, b] = canais.map((canal) =>
    canal <= 0.04045 ? canal / 12.92 : ((canal + 0.055) / 1.055) ** 2.4,
  )

  return 0.2126 * r + 0.7152 * g + 0.0722 * b > 0.45 ? '#111111' : '#ffffff'
}

/**
 * Reconhece o banco pelo nome da conta ou da instituição.
 *
 * Devolve `null` quando nada bate, e aí o cartão volta ao bloco de tinta do
 * sistema — que continua correto, só não é reconhecível de longe.
 */
export function findBankBrand(...textos: (string | null | undefined)[]): BankBrand | null {
  const alvo = textos
    .filter((texto): texto is string => Boolean(texto))
    .join(' ')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()

  const banco = BANCOS.find((item) => item.chaves.some((chave) => alvo.includes(chave)))
  if (!banco) return null

  return { nome: banco.nome, cor: banco.cor, tinta: tintaSobre(banco.cor) }
}
