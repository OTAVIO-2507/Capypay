import { describe, expect, it } from 'vitest'
import { buildCsv } from './csv'

describe('buildCsv', () => {
  it('escreve cabeçalho e linhas com ponto-e-vírgula e CRLF', () => {
    const csv = buildCsv(['Data', 'Descrição'], [['2024-01-05', 'Padaria']])
    expect(csv).toBe('"Data";"Descrição"\r\n"2024-01-05";"Padaria"')
  })

  it('duplica as aspas de dentro do campo', () => {
    const csv = buildCsv(['Descrição'], [['Almoço no "Bar do Zé"']])
    expect(csv).toBe('"Descrição"\r\n"Almoço no ""Bar do Zé"""')
  })

  /*
   * A descrição de um lançamento não é escrita só por quem usa o aplicativo:
   * ela chega pronta do extrato importado, e o texto de um extrato pode ter
   * sido escolhido por quem fez a transferência. Um campo que começa por `=`
   * vira fórmula ao abrir o arquivo no Excel ou no Google Sheets, e as aspas do
   * CSV não protegem — a planilha as remove antes de olhar o conteúdo.
   */
  describe('não deixa a planilha calcular o que é texto', () => {
    const perigosos = [
      '=1+1',
      '=HYPERLINK("http://exemplo.invalido","clique")',
      '+1+1',
      '@SUM(A1:A9)',
      '-2+3+cmd|\' /c calc\'!A0',
      '\tcom tabulação',
    ]

    for (const valor of perigosos) {
      it(`marca como texto: ${JSON.stringify(valor)}`, () => {
        // As aspas de dentro do campo continuam duplicadas: as duas defesas
        // são independentes e se aplicam na mesma célula.
        const esperado = valor.replace(/"/g, '""')
        expect(buildCsv(['C'], [[valor]])).toBe(`"C"\r\n"'${esperado}"`)
      })
    }
  })

  /*
   * E o outro lado da mesma moeda: a coluna de valores é toda de números, e
   * metade deles é negativa. Marcar `-45,90` como texto faria a planilha parar
   * de somar a coluna — que é a primeira coisa que alguém faz depois de
   * exportar.
   */
  describe('deixa número em paz', () => {
    for (const valor of ['-45,90', '-45.90', '1234', '0,00']) {
      it(`não marca: ${valor}`, () => {
        expect(buildCsv(['V'], [[valor]])).toBe(`"V"\r\n"${valor}"`)
      })
    }
  })

  it('não mexe em texto comum', () => {
    expect(buildCsv(['C'], [['Mercado do bairro']])).toBe('"C"\r\n"Mercado do bairro"')
  })
})
