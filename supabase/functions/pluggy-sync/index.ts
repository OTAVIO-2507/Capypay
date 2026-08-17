// Edge Function (Deno) — fora de `src/`, fora do typecheck/test/build do
// projeto. Segundo lugar autorizado a usar `PLUGGY_CLIENT_ID` e
// `PLUGGY_CLIENT_SECRET`. Deploy manual: `supabase functions deploy pluggy-sync`.
//
// Lê as contas e os lançamentos de uma conexão já existente. É o caminho do
// **Meu Pluggy**: a pessoa conecta os bancos no portal (meu.pluggy.ai), e o
// aplicativo só lê o que já está lá com as credenciais do Dashboard. Nada aqui
// cria conexão — o widget Connect é o outro caminho, e é justamente o que o
// plano gratuito não deixa fazer.
//
// Contrato da API, fixado da documentação:
//
//   POST https://api.pluggy.ai/auth              { clientId, clientSecret } -> { apiKey }
//   GET  https://api.pluggy.ai/items/{id}        X-API-KEY -> { id, connector, status }
//   GET  https://api.pluggy.ai/accounts?itemId=  X-API-KEY -> { results: [...] }
//   GET  https://api.pluggy.ai/v2/transactions?accountId=&dateFrom=&after=
//                                                X-API-KEY -> { results: [...], next }
//
// `/v2/transactions` e não `/transactions`: a versão paginada por número de
// página está marcada como descontinuada e sai do ar em 31/12/2026. Nascer já
// no cursor evita uma migração daqui a alguns meses.
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const PLUGGY_CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID') ?? ''
const PLUGGY_CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET') ?? ''

const PLUGGY_API = 'https://api.pluggy.ai'

/** Teto de páginas por conta. Guarda contra laço infinito, não contra volume. */
const MAXIMO_DE_PAGINAS = 20

/** Quantos dias para trás, quando quem chama não diz. */
const JANELA_PADRAO_EM_DIAS = 90

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

let apiKeyCache: { key: string; expiraEm: number } | null = null

const VALIDADE_API_KEY_MS = 2 * 60 * 60 * 1000
const MARGEM_MS = 5 * 60 * 1000

async function obterApiKey(): Promise<string> {
  if (apiKeyCache && Date.now() < apiKeyCache.expiraEm) return apiKeyCache.key

  const resposta = await fetch(`${PLUGGY_API}/auth`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientId: PLUGGY_CLIENT_ID, clientSecret: PLUGGY_CLIENT_SECRET }),
  })

  // O corpo do erro não é repassado: resposta de autenticação pode ecoar o que
  // foi enviado, e o que foi enviado é o segredo.
  if (!resposta.ok) throw new Error(`auth falhou com ${resposta.status}`)

  const { apiKey } = (await resposta.json()) as { apiKey?: string }
  if (!apiKey) throw new Error('auth respondeu sem apiKey')

  apiKeyCache = { key: apiKey, expiraEm: Date.now() + VALIDADE_API_KEY_MS - MARGEM_MS }
  return apiKey
}

/** GET na Pluggy com uma segunda tentativa quando a chave em cache morreu. */
async function pluggyGet(caminho: string): Promise<Record<string, unknown>> {
  const chamar = async (chave: string) =>
    await fetch(`${PLUGGY_API}${caminho}`, { headers: { 'X-API-KEY': chave } })

  let resposta = await chamar(await obterApiKey())

  if (resposta.status === 401 || resposta.status === 403) {
    apiKeyCache = null
    resposta = await chamar(await obterApiKey())
  }

  if (!resposta.ok) throw new Error(`${caminho} falhou com ${resposta.status}`)
  return (await resposta.json()) as Record<string, unknown>
}

interface ContaPluggy {
  id: string
  type?: string
  subtype?: string
  name?: string
  marketingName?: string
  number?: string
  balance?: number
}

interface LancamentoPluggy {
  id: string
  date?: string
  description?: string
  descriptionRaw?: string
  amount?: number
  type?: string
}

/**
 * Converte para centavos inteiros a partir do número decimal da Pluggy.
 *
 * `Math.round` é obrigatório e não decorativo: a API entrega `-45.9` como
 * ponto flutuante, e `-45.9 * 100` é `-4589.999999999999` em binário. Truncar
 * perderia um centavo por lançamento, o que só apareceria no saldo que deixa de
 * fechar. Este é o mesmo cuidado que `lib/ofx.ts` toma fatiando a string, e
 * aqui a string não existe: o JSON já chegou como número.
 */
function paraCentavos(valor: number): number {
  return Math.round(valor * 100)
}

function dataDeCalendario(bruta: string): string {
  // A Pluggy devolve ISO completo com fuso. Só a data importa, e interpretar o
  // carimbo faria a compra da madrugada cair no dia anterior.
  return bruta.slice(0, 10)
}

function diasAtras(dias: number): string {
  return new Date(Date.now() - dias * 86_400_000).toISOString().slice(0, 10)
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin')

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders(origin) })
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
  if (!authHeader) return json({ ok: false, error: 'Sessão ausente.' }, 401, origin)

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
  const { data: caller, error: callerError } = await admin.auth.getUser(
    authHeader.replace(/^Bearer\s+/i, ''),
  )
  if (callerError || !caller.user) {
    return json({ ok: false, error: 'Sessão inválida.' }, 401, origin)
  }

  let corpo: { action?: string; itemId?: string; dateFrom?: string }
  try {
    corpo = await req.json()
  } catch {
    return json({ ok: false, error: 'Corpo inválido.' }, 400, origin)
  }

  const itemId = String(corpo.itemId ?? '').trim()
  if (!itemId) return json({ ok: false, error: 'Informe a conexão do Meu Pluggy.' }, 400, origin)

  try {
    /*
     * `register` valida o item **antes** de gravá-lo.
     *
     * O identificador é digitado à mão, copiado do portal, e um engano de
     * digitação gravaria uma conexão que nunca vai sincronizar — a pessoa
     * ficaria olhando para uma linha na tela esperando dados que não existem.
     * Perguntar à Pluggy custa uma chamada e transforma o erro em mensagem na
     * hora da digitação.
     */
    if (corpo.action === 'register') {
      await pluggyGet(`/items/${encodeURIComponent(itemId)}`)

      const { error } = await admin.from('bank_connections').upsert(
        {
          user_id: caller.user.id,
          provider: 'pluggy',
          item_id: itemId,
          pending_sync: true,
          last_error: null,
        },
        { onConflict: 'item_id' },
      )
      if (error) throw new Error(`upsert falhou: ${error.message}`)

      return json({ ok: true, itemId }, 200, origin)
    }

    /*
     * Toda leitura exige que a conexão já pertença a quem pede.
     *
     * O `itemId` chega do navegador, e sem esta consulta bastaria conhecer o
     * identificador de outra pessoa para ler o extrato dela através da nossa
     * função — as credenciais são da aplicação, não de quem chamou, então a
     * Pluggy responderia normalmente. A tabela é a única coisa que amarra uma
     * conexão a um usuário, e é por isso que ela existe.
     */
    const { data: conexao, error: conexaoError } = await admin
      .from('bank_connections')
      .select('item_id')
      .eq('item_id', itemId)
      .eq('user_id', caller.user.id)
      .maybeSingle()

    if (conexaoError) throw new Error(`consulta falhou: ${conexaoError.message}`)
    if (!conexao) {
      return json({ ok: false, error: 'Esta conexão não está vinculada à sua conta.' }, 403, origin)
    }

    const dateFrom = corpo.dateFrom?.match(/^\d{4}-\d{2}-\d{2}$/)
      ? corpo.dateFrom
      : diasAtras(JANELA_PADRAO_EM_DIAS)

    const contasResposta = await pluggyGet(`/accounts?itemId=${encodeURIComponent(itemId)}`)
    const contas = (contasResposta.results ?? []) as ContaPluggy[]

    const extratos = []

    for (const conta of contas) {
      const lancamentos: LancamentoPluggy[] = []
      let caminho = `/v2/transactions?accountId=${encodeURIComponent(conta.id)}&dateFrom=${dateFrom}`

      for (let pagina = 0; pagina < MAXIMO_DE_PAGINAS; pagina += 1) {
        const resposta = await pluggyGet(caminho)
        lancamentos.push(...((resposta.results ?? []) as LancamentoPluggy[]))

        const proxima = resposta.next
        if (typeof proxima !== 'string' || proxima === '') break
        // `next` já vem como query string pronta; só falta o caminho na frente.
        caminho = proxima.startsWith('/') ? proxima : `/v2/transactions?${proxima.replace(/^\?/, '')}`
      }

      extratos.push({
        accountKey: conta.id,
        accountLabel:
          conta.marketingName ?? conta.name ?? (conta.type === 'CREDIT' ? 'Cartão' : 'Conta'),
        kind: conta.type === 'CREDIT' ? 'credit_card' : 'checking',
        /*
         * O saldo vai junto porque o aplicativo calcula saldo somando o
         * histórico, e um histórico que começa há noventa dias produz um número
         * que não é o da conta. Com o saldo real, a importação consegue abrir a
         * conta pelo valor certo em vez de deixar a tela mentir com convicção.
         *
         * `null` quando a instituição não informa: melhor não ter saldo do que
         * ter um zero que parece saldo.
         */
        balanceCents: typeof conta.balance === 'number' ? paraCentavos(conta.balance) : null,
        number: conta.number ?? null,
        entries: lancamentos
          .filter((item) => typeof item.amount === 'number' && item.date)
          .map((item) => ({
            key: item.id,
            date: dataDeCalendario(item.date as string),
            amountCents: paraCentavos(item.amount as number),
            description: item.description ?? item.descriptionRaw ?? 'Lançamento sem descrição',
          })),
      })
    }

    await admin
      .from('bank_connections')
      .update({ pending_sync: false, last_error: null })
      .eq('item_id', itemId)
      .eq('user_id', caller.user.id)

    return json({ ok: true, dateFrom, statements: extratos }, 200, origin)
  } catch (erro) {
    const mensagem = erro instanceof Error ? erro.message : String(erro)
    // A mensagem interna nomeia etapa e status da Pluggy: é diagnóstico de
    // servidor, e fica no log. O 404 do item é a exceção, porque é erro de
    // digitação de quem está na tela e só ele pode corrigir.
    console.error('pluggy-sync:', mensagem)

    if (mensagem.includes('/items/') && mensagem.includes('404')) {
      return json(
        { ok: false, error: 'Conexão não encontrada. Confira o identificador no Meu Pluggy.' },
        404,
        origin,
      )
    }

    return json({ ok: false, error: 'Não foi possível buscar os dados no banco.' }, 502, origin)
  }
})
