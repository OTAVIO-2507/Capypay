/*
 * CORS e cabeçalhos de resposta, compartilhados pelas Edge Functions.
 *
 * Vive em `_shared/` porque a CLI do Supabase inclui no bundle de cada função
 * tudo o que ela importa por caminho relativo. Três cópias da mesma lista de
 * origens divergiam no primeiro domínio que alguém liberasse num arquivo só —
 * e uma origem esquecida numa função é uma porta a menos vigiada, não um
 * detalhe de estilo.
 */

/**
 * As origens que podem falar com estas funções por navegador.
 *
 * `ALLOWED_ORIGINS` (lista separada por vírgula) tem a palavra final, para
 * mudar de domínio não exigir publicar código. Sem ela, valem os endereços
 * reais deste projeto — e só eles.
 *
 * A versão anterior aceitava **qualquer** `*.github.io`, o que é a mesma coisa
 * que aceitar qualquer página publicada por qualquer pessoa no GitHub Pages.
 * Não era a proteção principal (a autorização por JWT é), mas era superfície
 * dada de graça.
 */
const ORIGENS_PADRAO = [
  'https://otavio-2507.github.io',
  'http://localhost:5173',
  'http://localhost:4173',
]

function origensPermitidas(): readonly string[] {
  const configurado = (Deno.env.get('ALLOWED_ORIGINS') ?? '')
    .split(',')
    .map((origem) => origem.trim())
    .filter((origem) => origem !== '')

  return configurado.length > 0 ? configurado : ORIGENS_PADRAO
}

/**
 * Comparação exata, e não por sufixo.
 *
 * `hostname.endsWith('.github.io')` casa com `evil.github.io`; comparar a
 * origem inteira não casa com nada além do que está na lista. Origem é string
 * canônica no navegador (esquema + host + porta), então a igualdade basta e é
 * a única checagem que não tem borda.
 */
export function origemPermitida(origin: string | null): boolean {
  if (!origin) return false
  return origensPermitidas().includes(origin)
}

/*
 * `authorization` e `content-type` não bastam: o `supabase-js` manda também
 * `apikey` e `x-client-info` em toda chamada. Um cabeçalho pedido no preflight
 * e ausente desta lista faz o navegador abortar a requisição real, e o
 * preflight ainda assim responde 200 — o que faz a falha parecer queda de rede
 * em vez de CORS, e foi exatamente onde a função de administração travou na
 * primeira publicação.
 */
const CABECALHOS_PERMITIDOS = 'authorization, content-type, apikey, x-client-info'

/**
 * Cabeçalhos que valem para toda resposta, inclusive as de erro.
 *
 * `nosniff` impede o navegador de adivinhar um tipo diferente do declarado, e
 * `no-store` mantém resposta com dado de conta fora de qualquer cache
 * intermediário. `frame-ancestors 'none'` recusa a função dentro de um quadro,
 * que só serviria para disfarçar a origem de uma chamada.
 */
const CABECALHOS_DE_SEGURANCA: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'Cache-Control': 'no-store',
  'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'",
}

export function corsHeaders(origin: string | null): Record<string, string> {
  return {
    ...CABECALHOS_DE_SEGURANCA,
    // Origem não reconhecida recebe `null`, que nenhum navegador aceita como
    // par da própria origem: a resposta chega e é descartada por ele.
    'Access-Control-Allow-Origin': origemPermitida(origin) ? (origin as string) : 'null',
    'Access-Control-Allow-Headers': CABECALHOS_PERMITIDOS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

export function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}

export function preflight(origin: string | null): Response {
  return new Response(null, { status: 204, headers: corsHeaders(origin) })
}

/**
 * Lê o corpo com teto de tamanho.
 *
 * Sem teto, um corpo de dezenas de megabytes é aceito e desserializado antes
 * de qualquer validação — trabalho e memória gastos por quem só quis derrubar
 * a função. O limite é generoso para o que estas funções de fato recebem
 * (nenhuma passa de alguns quilobytes) e pequeno o bastante para o abuso não
 * compensar.
 */
export const LIMITE_DE_CORPO = 256 * 1024

export async function lerCorpoJson<T>(req: Request): Promise<T | null> {
  const declarado = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declarado) && declarado > LIMITE_DE_CORPO) return null

  const texto = await req.text()
  // O `content-length` pode faltar (corpo em pedaços): o tamanho real é
  // conferido de novo aqui, que é onde ele deixa de ser promessa.
  if (texto.length > LIMITE_DE_CORPO) return null

  try {
    const corpo = JSON.parse(texto) as unknown
    // Só objeto: um `[]` ou um `"texto"` passaria pelo `JSON.parse` e
    // quebraria em cada leitura de campo depois.
    if (typeof corpo !== 'object' || corpo === null || Array.isArray(corpo)) return null
    return corpo as T
  } catch {
    return null
  }
}
