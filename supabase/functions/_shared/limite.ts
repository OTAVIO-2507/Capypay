/*
 * Freio de repetição, por chamador.
 *
 * O que ele é: uma barreira contra laço — script que repete a mesma ação mil
 * vezes por minuto, seja por bug de cliente ou por tentativa de abuso.
 *
 * O que ele **não** é: uma garantia. O estado mora na memória da instância, e
 * a plataforma sobe quantas instâncias quiser; quem distribui as chamadas
 * passa por baixo. Um limite de verdade exigiria contador compartilhado, com
 * uma escrita no banco por requisição — custo que só se justifica quando esta
 * barreira provar não bastar. Dizer isso aqui é mais honesto do que deixar o
 * próximo leitor supor uma garantia que não existe.
 */

interface Janela {
  contagem: number
  reiniciaEm: number
}

const janelas = new Map<string, Janela>()

/** Limpeza preguiçosa: sem ela o mapa cresce com cada chave que nunca voltou. */
function limpar(agora: number): void {
  if (janelas.size < 1000) return
  for (const [chave, janela] of janelas) {
    if (janela.reiniciaEm <= agora) janelas.delete(chave)
  }
}

/**
 * Consome uma vaga da janela e diz se ela ainda cabia.
 *
 * @param chave quem está sendo contado — o id da conta, nunca o IP: atrás de
 *   um provedor de internet móvel, milhares de pessoas dividem o mesmo IP, e
 *   limitar por ele pune a rua inteira pelo excesso de uma casa.
 */
export function dentroDoLimite(chave: string, maximo: number, janelaMs: number): boolean {
  const agora = Date.now()
  limpar(agora)

  const atual = janelas.get(chave)
  if (!atual || atual.reiniciaEm <= agora) {
    janelas.set(chave, { contagem: 1, reiniciaEm: agora + janelaMs })
    return true
  }

  atual.contagem += 1
  return atual.contagem <= maximo
}
