/**
 * Leitura de extrato OFX, o formato que todo banco exporta.
 *
 * OFX é a única via de importação que não pede senha de banco a ninguém: o
 * arquivo sai do internet banking, entra no navegador e morre aqui. Nenhum
 * terceiro no meio, nada guardado fora do dispositivo — o que o torna mais
 * seguro que o agregador, e não um prêmio de consolação por ele custar caro.
 *
 * O formato tem duas encarnações e este módulo lê as duas:
 *
 * - **OFX 1.x (SGML)**, o comum no Brasil. Campos folha **não fecham a tag**:
 *   `<FITID>ABC123` termina onde a próxima tag começa. Os agregados
 *   (`<STMTTRN>`, `<BANKACCTFROM>`) fecham normalmente, e é justamente isso
 *   que torna um leitor viável sem escrever um parser de SGML inteiro.
 * - **OFX 2.x (XML)**, com tudo fechado.
 *
 * Ler os dois com a mesma expressão é possível porque `<TAG>valor` seguido de
 * `<` cobre tanto `</TAG>` quanto a tag seguinte. É a única esperteza do
 * módulo, e está confinada a `campo()`.
 *
 * **Este módulo lança**, ao contrário de `lib/date.ts`. A diferença é de quem
 * produziu a entrada: uma data corrompida vem do próprio histórico e não pode
 * derrubar a tela, enquanto um arquivo OFX vem de fora e ser rejeitado com um
 * motivo é a resposta certa. Quem chama exibe a mensagem.
 */

import type { IsoDate } from './date'
import type { Cents } from './money'

/** Falha de leitura com motivo em português, pronto para a tela mostrar. */
export class OfxError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OfxError'
  }
}

/** A conta a que o extrato pertence, como o arquivo a identifica. */
export interface OfxAccount {
  /** `ACCTID`: número da conta ou do cartão na instituição. */
  id: string
  /** `BANKID`: código do banco. Ausente em extrato de cartão. */
  bankId: string | null
  kind: 'checking' | 'credit_card'
}

export interface OfxTransaction {
  /**
   * `FITID`: identificador do lançamento na instituição.
   *
   * É a chave que impede a mesma compra de entrar duas vezes quando o mesmo
   * mês é importado de novo, e o motivo de `Transaction.externalId` existir no
   * modelo desde antes de haver qualquer importação.
   */
  fitId: string
  date: IsoDate
  /** **Com sinal**: negativo é saída. O domínio converte para `kind` depois. */
  amountCents: Cents
  description: string
  /** `TRNTYPE` cru (DEBIT, CREDIT, PIX...), preservado para diagnóstico. */
  type: string
}

export interface OfxStatement {
  account: OfxAccount | null
  transactions: OfxTransaction[]
  /** Período que o extrato cobre, quando o arquivo declara. */
  start: IsoDate | null
  end: IsoDate | null
}

/**
 * Converte o valor textual em centavos **sem passar por float**.
 *
 * `Math.round(Number('8.115') * 100)` devolve 811 em vez de 812, porque a
 * multiplicação acontece em binário. Um centavo, calado, e o saldo do extrato
 * deixa de fechar sem que nenhuma linha pareça errada. Fatiar a string é exato
 * por construção.
 *
 * **Um único separador é sempre decimal, mesmo com três dígitos depois.** O
 * padrão OFX define `TRNAMT` como decimal simples, sem agrupamento de milhar,
 * e a tentação de ler "1.005" como mil e cinco erra por cem vezes quando o
 * arquivo obedece o padrão. Milhar só é reconhecido quando os **dois**
 * separadores aparecem ("1.234,56"), que é o único caso sem ambiguidade.
 */
export function parseAmountToCents(raw: string): Cents | null {
  const limpo = raw.trim().replace(/\s/g, '')
  if (!limpo) return null

  const negativo = limpo.startsWith('-')
  const semSinal = limpo.replace(/^[+-]/, '')
  if (!/^\d*[.,]?\d*(?:[.,]\d*)?$/.test(semSinal) || !/\d/.test(semSinal)) return null

  const ultimoPonto = semSinal.lastIndexOf('.')
  const ultimaVirgula = semSinal.lastIndexOf(',')
  const corte = Math.max(ultimoPonto, ultimaVirgula)

  const inteiro = (corte >= 0 ? semSinal.slice(0, corte) : semSinal).replace(/[.,]/g, '')
  const fracao = corte >= 0 ? semSinal.slice(corte + 1) : ''

  if (!/^\d*$/.test(inteiro) || !/^\d*$/.test(fracao)) return null

  /*
   * Terceira casa em diante decide o arredondamento, e não é descartada: um
   * extrato com juros ou câmbio traz três casas, e truncar sempre para baixo
   * enviesaria o total numa direção só.
   */
  const centavos =
    Number(inteiro || '0') * 100 +
    Number(fracao.slice(0, 2).padEnd(2, '0') || '0') +
    (fracao.charCodeAt(2) >= 53 /* '5' */ ? 1 : 0)

  if (!Number.isFinite(centavos)) return null

  return negativo ? -centavos : centavos
}

/**
 * `20260815`, `20260815120000` ou `20260815120000.000[-3:BRT]` viram
 * `2026-08-15`.
 *
 * A hora e o fuso são **descartados de propósito**. Interpretar o carimbo
 * completo faria uma compra da meia-noite em Brasília cair no dia anterior, que
 * é exatamente o deslize que `lib/date.ts` existe para evitar. A data de
 * calendário é o que o extrato quer dizer.
 */
export function parseOfxDate(raw: string): IsoDate | null {
  const digitos = /^\s*(\d{4})(\d{2})(\d{2})/.exec(raw)
  if (!digitos) return null

  const [, ano, mes, dia] = digitos
  const mesNumero = Number(mes)
  const diaNumero = Number(dia)
  if (mesNumero < 1 || mesNumero > 12 || diaNumero < 1 || diaNumero > 31) return null

  return `${ano}-${mes}-${dia}`
}

/** Lê `<TAG>valor` parando no primeiro `<`, o que cobre SGML e XML de uma vez. */
function campo(bloco: string, tag: string): string | null {
  const encontrado = new RegExp(`<${tag}>([^<]*)`, 'i').exec(bloco)
  if (!encontrado) return null
  const valor = encontrado[1].trim()
  return valor === '' ? null : valor
}

/** Entidades XML que aparecem em memorando de banco. */
function decodificarEntidades(texto: string): string {
  return texto
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#(\d+);/g, (_, codigo: string) => String.fromCodePoint(Number(codigo)))
}

/**
 * Junta `NAME` e `MEMO` sem repetir.
 *
 * Os bancos não concordam sobre qual dos dois é o título: uns põem o
 * estabelecimento em `NAME` e o detalhe em `MEMO`, outros usam só um. Preferir
 * um deles cegamente perderia informação em metade dos arquivos, e concatenar
 * sempre produziria "PIX ENVIADO · PIX ENVIADO" na outra metade.
 */
function montarDescricao(bloco: string): string {
  const nome = campo(bloco, 'NAME')
  const memo = campo(bloco, 'MEMO')

  const partes = [nome, memo]
    .filter((parte): parte is string => parte !== null)
    .map((parte) => decodificarEntidades(parte).replace(/\s+/g, ' ').trim())
    .filter((parte) => parte !== '')

  if (partes.length === 2) {
    const [primeiro, segundo] = partes
    const iguais = primeiro.toLowerCase() === segundo.toLowerCase()
    if (iguais) return primeiro
    // Um contém o outro: fica o mais completo.
    if (segundo.toLowerCase().includes(primeiro.toLowerCase())) return segundo
    if (primeiro.toLowerCase().includes(segundo.toLowerCase())) return primeiro
    return `${primeiro} · ${segundo}`
  }

  return partes[0] ?? 'Lançamento sem descrição'
}

function lerConta(bloco: string): OfxAccount | null {
  const cartao = /<CCACCTFROM>([\s\S]*?)<\/CCACCTFROM>/i.exec(bloco)
  const banco = /<BANKACCTFROM>([\s\S]*?)<\/BANKACCTFROM>/i.exec(bloco)
  const encontrado = cartao ?? banco
  if (!encontrado) return null

  const id = campo(encontrado[1], 'ACCTID')
  if (!id) return null

  return {
    id,
    bankId: campo(encontrado[1], 'BANKID'),
    kind: cartao ? 'credit_card' : 'checking',
  }
}

function lerLancamentos(bloco: string): OfxTransaction[] {
  const lancamentos: OfxTransaction[] = []

  for (const encontrado of bloco.matchAll(/<STMTTRN>([\s\S]*?)<\/STMTTRN>/gi)) {
    const corpo = encontrado[1]

    const data = parseOfxDate(campo(corpo, 'DTPOSTED') ?? campo(corpo, 'DTUSER') ?? '')
    const valorBruto = campo(corpo, 'TRNAMT')
    const valor = valorBruto === null ? null : parseAmountToCents(valorBruto)

    /*
     * Sem data ou sem valor o lançamento é descartado em silêncio, e não
     * importado com um zero no lugar. Um lançamento a menos a pessoa percebe
     * conferindo contra o extrato; um lançamento de R$ 0,00 no meio de trinta
     * passa despercebido e desequilibra o saldo para sempre.
     */
    if (!data || valor === null) continue

    lancamentos.push({
      fitId: campo(corpo, 'FITID') ?? `${data}:${valor}:${lancamentos.length}`,
      date: data,
      amountCents: valor,
      description: montarDescricao(corpo),
      type: (campo(corpo, 'TRNTYPE') ?? 'OTHER').toUpperCase(),
    })
  }

  return lancamentos
}

/**
 * Lê o arquivo inteiro. Um OFX pode trazer **mais de um extrato**, quando o
 * banco exporta conta e cartão juntos, então o retorno é uma lista.
 */
export function parseOfx(conteudo: string): OfxStatement[] {
  if (!/<OFX>/i.test(conteudo)) {
    throw new OfxError(
      'Este arquivo não parece ser um OFX. Baixe o extrato do banco no formato OFX e tente de novo.',
    )
  }

  const extratos: OfxStatement[] = []
  const blocos = [
    ...conteudo.matchAll(/<STMTRS>([\s\S]*?)<\/STMTRS>/gi),
    ...conteudo.matchAll(/<CCSTMTRS>([\s\S]*?)<\/CCSTMTRS>/gi),
  ]

  for (const bloco of blocos) {
    const corpo = bloco[1]
    const lancamentos = lerLancamentos(corpo)
    if (lancamentos.length === 0) continue

    const periodo = /<BANKTRANLIST>([\s\S]*?)<STMTTRN>/i.exec(corpo)?.[1] ?? ''

    extratos.push({
      account: lerConta(corpo),
      transactions: lancamentos,
      start: parseOfxDate(campo(periodo, 'DTSTART') ?? ''),
      end: parseOfxDate(campo(periodo, 'DTEND') ?? ''),
    })
  }

  /*
   * Arquivo sem bloco de extrato reconhecível, ou com blocos todos vazios: em
   * vez de devolver lista vazia e deixar a tela dizer "0 lançamentos" como se
   * fosse um extrato legítimo de mês parado, o erro nomeia a diferença.
   */
  if (extratos.length === 0) {
    const solto = lerLancamentos(conteudo)
    if (solto.length > 0) {
      return [{ account: lerConta(conteudo), transactions: solto, start: null, end: null }]
    }

    throw new OfxError('O arquivo foi lido, mas não há nenhum lançamento dentro dele.')
  }

  return extratos
}

/**
 * Decodifica os bytes do arquivo com o charset que o **próprio arquivo**
 * declara.
 *
 * Os bancos brasileiros ainda exportam em Windows-1252 com frequência, e ler
 * esses bytes como UTF-8 entrega "MERCADO CENTRAL LTDA" virado em lixo no
 * primeiro acento. O cabeçalho OFX é sempre ASCII, então dá para espiá-lo com
 * segurança antes de decidir como decodificar o resto.
 */
export function decodeOfxBytes(bytes: ArrayBuffer): string {
  const visao = new Uint8Array(bytes)

  // BOM de UTF-8: decide sozinho, sem consultar o cabeçalho.
  if (visao[0] === 0xef && visao[1] === 0xbb && visao[2] === 0xbf) {
    return new TextDecoder('utf-8').decode(visao.subarray(3))
  }

  const cabecalho = new TextDecoder('windows-1252').decode(visao.subarray(0, 2048)).toUpperCase()
  const declarado =
    /CHARSET[:=]\s*"?([\w-]+)/.exec(cabecalho)?.[1] ??
    /ENCODING[:=]\s*"?([\w-]+)/.exec(cabecalho)?.[1] ??
    ''

  const utf8 = declarado.includes('UTF')
  return new TextDecoder(utf8 ? 'utf-8' : 'windows-1252').decode(visao)
}
