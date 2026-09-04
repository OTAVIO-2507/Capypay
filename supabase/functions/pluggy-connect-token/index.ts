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
import { autenticar, clienteDeServico } from '../_shared/auth.ts'
import { json, origemPermitida, preflight } from '../_shared/http.ts'
import { dentroDoLimite } from '../_shared/limite.ts'

const PLUGGY_CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID') ?? ''
const PLUGGY_CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET') ?? ''

const PLUGGY_API = 'https://api.pluggy.ai'

/*
 * Freio por conta. Connect Token é credencial: um laço aqui emite centenas
 * delas por minuto e queima a cota da aplicação na Pluggy. Abrir o widget
 * algumas vezes seguidas é uso normal; dez vezes por minuto não é.
 */
const LIMITE_DE_TOKENS = 10
const JANELA_MS = 60_000

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

  if (req.method === 'OPTIONS') return preflight(origin)
  if (req.method !== 'POST') {
    return json({ ok: false, error: 'Método não suportado.' }, 405, origin)
  }
  if (origin !== null && !origemPermitida(origin)) {
    return json({ ok: false, error: 'Origem não autorizada.' }, 403, origin)
  }

  if (!PLUGGY_CLIENT_ID || !PLUGGY_CLIENT_SECRET) {
    return json(
      { ok: false, error: 'Integração bancária não configurada neste ambiente.' },
      503,
      origin,
    )
  }

  const admin = clienteDeServico()

  const autenticacao = await autenticar(req, admin)
  if (!autenticacao.ok) {
    return json({ ok: false, error: autenticacao.erro }, autenticacao.status, origin)
  }

  /*
   * O `clientUserId` é o id da sessão, e **nunca** o que o corpo pedir.
   *
   * A documentação da Pluggy passa esse campo a partir do corpo da requisição.
   * Aqui isso seria um buraco: quem chamasse a função com o id de outra pessoa
   * abriria uma conexão bancária carimbada como dela, e a partir daí as contas
   * conectadas chegariam vinculadas à conta errada. O id de quem chama já está
   * provado pelo JWT — não há motivo para perguntar de novo, e perguntar é o
   * que cria a brecha. O corpo desta requisição não é lido em lugar nenhum.
   */
  const clientUserId = autenticacao.chamador.id

  if (!dentroDoLimite(`token:${clientUserId}`, LIMITE_DE_TOKENS, JANELA_MS)) {
    return json(
      { ok: false, error: 'Muitas tentativas em pouco tempo. Espere um minuto.' },
      429,
      origin,
    )
  }

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
