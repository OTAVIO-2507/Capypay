import { describe, expect, it } from 'vitest'
import { OfxError, decodeOfxBytes, parseAmountToCents, parseOfx, parseOfxDate } from './ofx'

/** Extrato SGML, como Inter, C6 e PicPay exportam: tags folha sem fechamento. */
const SGML = `OFXHEADER:100
DATA:OFXSGML
VERSION:102
CHARSET:1252

<OFX>
<BANKMSGSRSV1><STMTTRNRS><STMTRS>
<CURDEF>BRL
<BANKACCTFROM><BANKID>077<ACCTID>1234567-8<ACCTTYPE>CHECKING</BANKACCTFROM>
<BANKTRANLIST>
<DTSTART>20260801
<DTEND>20260831
<STMTTRN><TRNTYPE>DEBIT<DTPOSTED>20260815120000[-3:BRT]<TRNAMT>-45.90<FITID>ABC123<MEMO>MERCADO CENTRAL</STMTTRN>
<STMTTRN><TRNTYPE>CREDIT<DTPOSTED>20260805<TRNAMT>3200.00<FITID>DEF456<MEMO>SALARIO</STMTTRN>
</BANKTRANLIST>
</STMTRS></STMTTRNRS></BANKMSGSRSV1>
</OFX>`

/** OFX 2.x, com tudo fechado. Mesmo conteúdo, outra encarnação. */
const XML = `<?xml version="1.0" encoding="UTF-8"?>
<?OFX OFXHEADER="200" VERSION="220"?>
<OFX>
  <CREDITCARDMSGSRSV1><CCSTMTTRNRS><CCSTMTRS>
    <CCACCTFROM><ACCTID>5555</ACCTID></CCACCTFROM>
    <BANKTRANLIST>
      <DTSTART>20260701</DTSTART>
      <STMTTRN>
        <TRNTYPE>DEBIT</TRNTYPE>
        <DTPOSTED>20260710</DTPOSTED>
        <TRNAMT>-120.50</TRNAMT>
        <FITID>XYZ789</FITID>
        <NAME>PADARIA &amp; CIA</NAME>
      </STMTTRN>
    </BANKTRANLIST>
  </CCSTMTRS></CCSTMTTRNRS></CREDITCARDMSGSRSV1>
</OFX>`

describe('parseOfx no formato SGML', () => {
  it('lê os lançamentos mesmo sem as tags folha fecharem', () => {
    const [extrato] = parseOfx(SGML)

    expect(extrato.transactions).toHaveLength(2)
    expect(extrato.transactions[0]).toMatchObject({
      fitId: 'ABC123',
      date: '2026-08-15',
      amountCents: -4590,
      description: 'MERCADO CENTRAL',
      type: 'DEBIT',
    })
    expect(extrato.transactions[1].amountCents).toBe(320000)
  })

  it('identifica a conta corrente e o período', () => {
    const [extrato] = parseOfx(SGML)

    expect(extrato.account).toEqual({ id: '1234567-8', bankId: '077', kind: 'checking' })
    expect(extrato.start).toBe('2026-08-01')
    expect(extrato.end).toBe('2026-08-31')
  })
})

describe('parseOfx no formato XML', () => {
  it('lê o extrato de cartão e resolve as entidades do memorando', () => {
    const [extrato] = parseOfx(XML)

    expect(extrato.account).toEqual({ id: '5555', bankId: null, kind: 'credit_card' })
    expect(extrato.transactions[0].description).toBe('PADARIA & CIA')
    expect(extrato.transactions[0].amountCents).toBe(-12050)
  })
})

describe('parseOfx com vários extratos', () => {
  it('devolve um extrato por conta quando o arquivo traz conta e cartão', () => {
    const juntos = `<OFX>
      <STMTRS><BANKACCTFROM><ACCTID>111</ACCTID></BANKACCTFROM>
      <STMTTRN><DTPOSTED>20260801<TRNAMT>-10.00<FITID>A<MEMO>Conta</STMTTRN>
      </STMTRS>
      <CCSTMTRS><CCACCTFROM><ACCTID>222</ACCTID></CCACCTFROM>
      <STMTTRN><DTPOSTED>20260802<TRNAMT>-20.00<FITID>B<MEMO>Cartão</STMTTRN>
      </CCSTMTRS>
    </OFX>`

    const extratos = parseOfx(juntos)

    expect(extratos).toHaveLength(2)
    expect(extratos.map((item) => item.account?.kind)).toEqual(['checking', 'credit_card'])
  })
})

describe('parseOfx rejeitando entrada ruim', () => {
  it('recusa arquivo que não é OFX, com motivo legível', () => {
    expect(() => parseOfx('data,valor\n2026-08-01,10')).toThrow(OfxError)
    expect(() => parseOfx('')).toThrow(/não parece ser um OFX/)
  })

  it('recusa OFX sem nenhum lançamento em vez de fingir extrato vazio', () => {
    // Um mês parado e um arquivo ilegível dariam ambos "0 lançamentos" na tela.
    // Só o segundo é um problema, e o erro é o que separa os dois casos.
    expect(() => parseOfx('<OFX><STMTRS></STMTRS></OFX>')).toThrow(/nenhum lançamento/)
  })

  it('descarta o lançamento sem data ou sem valor, sem inventar zero', () => {
    const torto = `<OFX><STMTRS>
      <STMTTRN><DTPOSTED>20260801<TRNAMT>-10.00<FITID>bom<MEMO>Vale</STMTTRN>
      <STMTTRN><TRNAMT>-99.00<FITID>semData<MEMO>Sem data</STMTTRN>
      <STMTTRN><DTPOSTED>20260803<FITID>semValor<MEMO>Sem valor</STMTTRN>
    </STMTRS></OFX>`

    const [extrato] = parseOfx(torto)

    expect(extrato.transactions).toHaveLength(1)
    expect(extrato.transactions[0].fitId).toBe('bom')
  })

  it('gera uma chave própria quando o banco omite o FITID', () => {
    const semFitId = `<OFX><STMTRS>
      <STMTTRN><DTPOSTED>20260801<TRNAMT>-10.00<MEMO>Sem id</STMTTRN>
    </STMTRS></OFX>`

    expect(parseOfx(semFitId)[0].transactions[0].fitId).toBeTruthy()
  })
})

describe('montagem da descrição', () => {
  const descrever = (corpo: string) =>
    parseOfx(`<OFX><STMTRS><STMTTRN><DTPOSTED>20260801<TRNAMT>-1.00${corpo}</STMTTRN></STMTRS></OFX>`)[0]
      .transactions[0].description

  it('junta NAME e MEMO quando os dois trazem informação diferente', () => {
    expect(descrever('<NAME>PIX ENVIADO<MEMO>Maria Silva')).toBe('PIX ENVIADO · Maria Silva')
  })

  it('não repete quando são iguais ou um contém o outro', () => {
    expect(descrever('<NAME>MERCADO<MEMO>mercado')).toBe('MERCADO')
    expect(descrever('<NAME>PIX<MEMO>PIX ENVIADO PARA JOAO')).toBe('PIX ENVIADO PARA JOAO')
  })

  it('tem um rótulo para o lançamento que chega sem nenhum texto', () => {
    expect(descrever('')).toBe('Lançamento sem descrição')
  })
})

describe('parseOfxDate', () => {
  /*
   * O teste que justifica a função existir. `new Date('20260815120000[-3:BRT]')`
   * não é sequer válido, e montar a data pelo carimbo completo faria uma compra
   * da madrugada cair no dia anterior, que é o deslize que `lib/date.ts` inteiro
   * existe para evitar.
   */
  it('descarta hora e fuso, ficando com a data de calendário', () => {
    expect(parseOfxDate('20260815')).toBe('2026-08-15')
    expect(parseOfxDate('20260815120000')).toBe('2026-08-15')
    expect(parseOfxDate('20260815000000.000[-3:BRT]')).toBe('2026-08-15')
    expect(parseOfxDate('20260101235959[-3:BRT]')).toBe('2026-01-01')
  })

  it('devolve null para carimbo que não é data', () => {
    expect(parseOfxDate('')).toBeNull()
    expect(parseOfxDate('ontem')).toBeNull()
    expect(parseOfxDate('20261301')).toBeNull()
    expect(parseOfxDate('20260140')).toBeNull()
  })
})

describe('parseAmountToCents', () => {
  it('converte sem passar por float', () => {
    expect(parseAmountToCents('-45.90')).toBe(-4590)
    expect(parseAmountToCents('3200.00')).toBe(320000)
    expect(parseAmountToCents('0.01')).toBe(1)
    expect(parseAmountToCents('+12.34')).toBe(1234)
  })

  /*
   * Os valores em que `Math.round(Number(x) * 100)` erra por um centavo. Num
   * extrato de trinta linhas o erro não aparece em nenhuma delas isoladamente,
   * só no saldo que deixa de fechar.
   */
  it('acerta os valores em que a multiplicação binária erra', () => {
    // `Math.round(8.115 * 100)` devolve 811. A terceira casa arredonda para cima.
    expect(parseAmountToCents('8.115')).toBe(812)
    expect(parseAmountToCents('1.005')).toBe(101)
    expect(parseAmountToCents('1234567.89')).toBe(123456789)
  })

  it('aceita vírgula como separador decimal', () => {
    expect(parseAmountToCents('-45,90')).toBe(-4590)
    expect(parseAmountToCents('0,05')).toBe(5)
  })

  /*
   * A decisão de maior consequência da função. O padrão OFX define TRNAMT como
   * decimal simples, sem agrupamento, então um separador só é sempre decimal.
   * Ler "1.005" como mil e cinco erraria por cem vezes em todo arquivo que
   * obedece o padrão, que são quase todos.
   */
  it('trata um separador só como decimal, mesmo com três dígitos depois', () => {
    expect(parseAmountToCents('1.234')).toBe(123)
  })

  it('só reconhece milhar quando os dois separadores aparecem', () => {
    expect(parseAmountToCents('1.234,56')).toBe(123456)
    expect(parseAmountToCents('1,234.56')).toBe(123456)
  })

  it('completa a fração de um dígito só', () => {
    expect(parseAmountToCents('10.5')).toBe(1050)
  })

  it('devolve null para o que não é número', () => {
    expect(parseAmountToCents('')).toBeNull()
    expect(parseAmountToCents('  ')).toBeNull()
    expect(parseAmountToCents('abc')).toBeNull()
    expect(parseAmountToCents('R$ 10,00')).toBeNull()
  })
})

/**
 * O grupo que existe porque banco brasileiro ainda exporta em Windows-1252.
 *
 * Ler esses bytes como UTF-8 não lança: entrega "PÃO DE AÇÚCAR" como
 * "P�O DE A��CAR" e segue em frente. O extrato importa inteiro, com todos os
 * valores certos, e só os nomes ficam ilegíveis — um defeito que passa por
 * todos os testes que não olham para o texto.
 */
describe('decodeOfxBytes', () => {
  /** Codifica em Windows-1252, que coincide com latin-1 nos acentos do pt-BR. */
  function bytes1252(texto: string): ArrayBuffer {
    const saida = new Uint8Array(texto.length)
    for (let i = 0; i < texto.length; i += 1) saida[i] = texto.charCodeAt(i) & 0xff
    return saida.buffer
  }

  const COM_ACENTO = 'PÃO DE AÇÚCAR · FARMÁCIA SÃO JOÃO'

  it('decodifica pelo charset que o cabeçalho declara', () => {
    const arquivo = `OFXHEADER:100\nCHARSET:1252\n\n<OFX><MEMO>${COM_ACENTO}</OFX>`

    expect(decodeOfxBytes(bytes1252(arquivo))).toContain(COM_ACENTO)
  })

  it('decodifica UTF-8 quando é o declarado', () => {
    const arquivo = `OFXHEADER:100\nENCODING:UTF-8\n\n<OFX><MEMO>${COM_ACENTO}</OFX>`

    expect(decodeOfxBytes(new TextEncoder().encode(arquivo).buffer as ArrayBuffer)).toContain(
      COM_ACENTO,
    )
  })

  it('respeita o BOM de UTF-8 mesmo sem o cabeçalho declarar', () => {
    const arquivo = `<OFX><MEMO>${COM_ACENTO}</OFX>`
    const comBom = new Uint8Array([0xef, 0xbb, 0xbf, ...new TextEncoder().encode(arquivo)])

    const lido = decodeOfxBytes(comBom.buffer as ArrayBuffer)

    expect(lido).toContain(COM_ACENTO)
    // O BOM não pode sobrar no texto: `<OFX>` precisa começar a string, senão a
    // primeira tag deixa de casar com a expressão que procura por ela.
    expect(lido.startsWith('<OFX>')).toBe(true)
  })

  it('sobrevive a arquivo sem cabeçalho nenhum', () => {
    expect(() => decodeOfxBytes(bytes1252('<OFX></OFX>'))).not.toThrow()
  })

  /*
   * A ida e volta que prova o encaixe: bytes de banco em 1252 entram, e o
   * lançamento sai do parser com o acento no lugar.
   */
  it('entrega ao parser um texto que preserva o acento do memorando', () => {
    const arquivo = `OFXHEADER:100\nCHARSET:1252\n\n<OFX><STMTRS>
<STMTTRN><DTPOSTED>20260814<TRNAMT>-218.63<FITID>A1<MEMO>SUPERMERCADO PÃO DE AÇÚCAR</STMTTRN>
</STMTRS></OFX>`

    const [extrato] = parseOfx(decodeOfxBytes(bytes1252(arquivo)))

    expect(extrato.transactions[0].description).toBe('SUPERMERCADO PÃO DE AÇÚCAR')
  })
})
