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

/** Aspas duplicadas e campo entre aspas: o escape padrão do formato. */
function escapeCell(value: string): string {
  return `"${value.replace(/"/g, '""')}"`
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
