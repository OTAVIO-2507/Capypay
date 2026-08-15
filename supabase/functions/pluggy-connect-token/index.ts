// Edge Function (Deno) — fora de `src/`, fora do typecheck/test/build do
// projeto. Único lugar autorizado a usar `PLUGGY_CLIENT_ID` e
// `PLUGGY_CLIENT_SECRET`, que nunca podem chegar ao navegador. Deploy manual:
// `supabase functions deploy pluggy-connect-token`.
//
// Emite o Connect Token que o widget da Pluggy precisa para abrir. A troca tem
// dois passos na API deles: as credenciais viram uma API Key de vida curta, e
// a API Key vira o Connect Token que vai para o frontend. Só o segundo pode
// sair daqui.
//
// Sem SDK de propósito. `pluggy-sdk` é pacote de Node, e esta função roda em
// Deno; importá-lo por `npm:` provavelmente funcionaria, mas são duas
// chamadas HTTP com corpo JSON — uma dependência a mais para não escrever
// vinte linhas de `fetch` é dívida, não economia. O contrato está fixado nos
// testes de contrato da própria documentação, colados abaixo.
//
//   POST https://api.pluggy.ai/auth           { clientId, clientSecret } -> { apiKey }
//   POST https://api.pluggy.ai/connect_token  X-API-KEY, { options: { clientUserId } } -> { accessToken }
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const PLUGGY_CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID') ?? ''
const PLUGGY_CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET') ?? ''

const PLUGGY_API = 'https://api.pluggy.ai'

function isAllowedOrigin(origin: string): boolean {
  try {
    const { hostname } = new URL(origin)
    return hostname === 'localhost' || hostname.endsWith('.github.io')
  } catch {
    return false
  }
}

const CABECALHOS_PERMITIDOS = 'authorization, content-type, apikey, x-client-info'

function corsHeaders(origin: string | null): HeadersInit {
  return {
    'Access-Control-Allow-Origin': origin && isAllowedOrigin(origin) ? origin : 'null',
    'Access-Control-Allow-Headers': CABECALHOS_PERMITIDOS,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    Vary: 'Origin',
  }
}

function json(body: unknown, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(origin), 'Content-Type': 'application/json' },
  })
}

/**
 * A API Key da Pluggy, guardada entre chamadas.
 *
 * Ela vale cerca de duas horas, e pedir uma nova a cada Connect Token dobraria
 * a latência de abrir o widget sem nenhum ganho. A margem de cinco minutos
 * existe porque o relógio daqui e o de lá não são o mesmo: renovar em cima da
 * hora é como uma chave expira no meio de uma requisição.
 *
 * O cache vive na memória da instância. Instância nova começa sem ele e pede
 * outra — que é o comportamento correto, e não uma falha a contornar.
 */
let apiKeyCache: { key: string; expiraEm: number } | null = null

const VALIDADE_API_KEY_MS = 2 * 60 * 60 * 1000
const MARGEM_MS = 5 * 60 * 1000

async function obterApiKey(): Promise<string> {
  if (apiKeyCache && Date.now() < apiKeyCache.expiraEm) return apiKeyCache.key

  const resposta = await fetch(`${PLUGGY_API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      clientId: PLUGGY_CLIENT_ID,
      clientSecret: PLUGGY_CLIENT_SECRET,
    }),
  })

  if (!resposta.ok) {
    // O corpo do erro não é repassado ao navegador: resposta de autenticação
    // pode ecoar o que foi enviado, e o que foi enviado é o segredo.
    throw new Error(`auth falhou com ${resposta.status}`)
  }

  const { apiKey } = (await resposta.json()) as { apiKey?: string }
  if (!apiKey) throw new Error('auth respondeu sem apiKey')

  apiKeyCache = { key: apiKey, expiraEm: Date.now() + VALIDADE_API_KEY_MS - MARGEM_MS }
  return apiKey
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders(origin) })
  }
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Método não suportado.' }, 405, origin)
  }

  if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
    return json(
      { ok: false, error: 'Integração bancária não configurada neste ambiente.' },
      503,
      origin,
    )
  }

  const authHeader = req.headers.get('authorization')
  if (!authHeader) {
    return json({ ok: false, error: 'Sessão ausente.' }, 401, origin)
  }
  const jwt = authHeader.replace(/^Bearer\s+/i, '')

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  const { data: callerData, error: callerError } = await admin.auth.getUser(jwt)
  if (callerError || !callerData.user) {
    return json({ ok: false, error: 'Sessão inválida.' }, 401, origin)
  }

  /*
   * O `clientUserId` é o id da sessão, e **nunca** o que o corpo pedir.
   *
   * A documentação da Pluggy passa esse campo a partir do corpo da requisição.
   * Aqui isso seria um buraco: quem chamasse a função com o id de outra pessoa
   * abriria uma conexão bancária carimbada como dela, e a partir daí as contas
   * conectadas chegariam vinculadas à conta errada. O id de quem chama já está
   * provado pelo JWT — não há motivo para perguntar de novo, e perguntar é o
   * que cria a brecha.
   */
  const clientUserId = callerData.user.id

  try {
    const apiKey = await obterApiKey()

    const resposta = await fetch(`${PLUGGY_API}/connect_token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-API-KEY': apiKey },
      body: JSON.stringify({ options: { clientUserId } }),
    })

    if (resposta.status === 401 || resposta.status === 403) {
      // A chave em cache pode ter sido revogada antes da hora. Uma segunda
      // tentativa com chave nova resolve; duas seguidas é problema de verdade,
      // e aí o erro sobe.
      apiKeyCache = null
      const nova = await obterApiKey()
      const repetida = await fetch(`${PLUGGY_API}/connect_token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-API-KEY': nova },
        body: JSON.stringify({ options: { clientUserId } }),
      })
      if (!repetida.ok) throw new Error(`connect_token falhou com ${repetida.status}`)
      const { accessToken } = (await repetida.json()) as { accessToken?: string }
      if (!accessToken) throw new Error('connect_token respondeu sem accessToken')
      return json({ ok: true, accessToken }, 200, origin)
    }

    if (!resposta.ok) {
      throw new Error(`connect_token falhou com ${resposta.status}`)
    }

    const { accessToken } = (await resposta.json()) as { accessToken?: string }
    if (!accessToken) throw new Error('connect_token respondeu sem accessToken')

    // Só o token sai daqui. Nem a API Key, nem as credenciais, nem o corpo
    // original da Pluggy — que pode crescer campos entre versões e levar junto
    // algo que não deveria atravessar.
    return json({ ok: true, accessToken }, 200, origin)
  } catch (erro) {
    // A mensagem interna fica no log da função, não na resposta: ela nomeia
    // etapa e status da Pluggy, que é diagnóstico de servidor.
    console.error('pluggy-connect-token:', erro instanceof Error ? erro.message : erro)
    return json({ ok: false, error: 'Não foi possível iniciar a conexão bancária.' }, 502, origin)
  }
})
