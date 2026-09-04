/*
 * Validação das entradas que chegam do navegador.
 *
 * Nenhuma destas checagens existe na tela por acaso — todas existem lá também.
 * A diferença é que a tela é uma das formas de chamar estas funções, e não a
 * única: `curl` com um JWT válido chega no mesmo lugar sem passar por
 * formulário nenhum. Validar aqui é o que faz a regra ser regra.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function ehUuid(valor: unknown): valor is string {
  return typeof valor === 'string' && UUID.test(valor)
}

/**
 * E-mail bom o bastante para recusar o que é claramente inválido.
 *
 * Não tenta ser a RFC 5322 — validador de e-mail perfeito por expressão
 * regular não existe, e quem tenta acaba recusando endereços legítimos. O que
 * importa aqui é barrar o que nunca poderia ser um endereço e limitar o
 * tamanho, não adivinhar se a caixa existe.
 */
export function ehEmail(valor: unknown): valor is string {
  return (
    typeof valor === 'string' &&
    valor.length <= 254 &&
    /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)+$/.test(valor)
  )
}

export function ehPapel(valor: unknown): valor is 'user' | 'admin' {
  return valor === 'user' || valor === 'admin'
}

/**
 * Texto dentro de um teto de tamanho.
 *
 * Serve para o que vai parar no banco vindo de fora — nome de evento, detalhe
 * de erro. Sem teto, uma coluna `text` aceita megabytes por linha, e o custo
 * de escrever isso é de quem hospeda, não de quem envia.
 */
export function textoLimitado(valor: unknown, maximo: number): string | null {
  if (typeof valor !== 'string') return null
  const limpo = valor.trim()
  if (limpo === '') return null
  return limpo.length > maximo ? limpo.slice(0, maximo) : limpo
}

/**
 * Tamanho aproximado de um JSON, para recusar documento grande demais.
 *
 * `JSON.stringify` pode lançar em estrutura circular — o que já é motivo de
 * recusa por si só, e por isso a falha devolve `null` em vez de subir.
 */
export function tamanhoDeJson(valor: unknown): number | null {
  try {
    return JSON.stringify(valor)?.length ?? null
  } catch {
    return null
  }
}

/** Data no formato `AAAA-MM-DD`, e que existe de fato no calendário. */
export function ehDataIso(valor: unknown): valor is string {
  if (typeof valor !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const data = new Date(`${valor}T00:00:00Z`)
  return !Number.isNaN(data.getTime()) && data.toISOString().slice(0, 10) === valor
}

/**
 * Um endereço de redirecionamento que seja de fato nosso.
 *
 * O link de convite carrega um token de uso único na URL. Se o destino depois
 * dele puder ser escolhido por quem chama, o token chega em servidor alheio —
 * e quem clicou no convite entregou a própria conta achando que a estava
 * criando. A lista de origens é a mesma do CORS, e é por isso que ela é
 * parâmetro: as duas nunca podem divergir.
 */
export function redirecionamentoPermitido(
  valor: unknown,
  origemPermitida: (origem: string) => boolean,
): string | null {
  if (typeof valor !== 'string' || valor.length > 2048) return null
  try {
    const url = new URL(valor)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') return null
    return origemPermitida(url.origin) ? url.toString() : null
  } catch {
    return null
  }
}
