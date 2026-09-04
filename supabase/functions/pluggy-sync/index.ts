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
//
// **As credenciais são da aplicação, não de quem chama.** É a frase que
// governa este arquivo inteiro: a Pluggy responde qualquer `itemId` que ela
// conheça, sem perguntar de quem ele é. Quem responde isso é a tabela
// `bank_connections`, e é por isso que toda leitura passa por ela antes de
// passar pela Pluggy.
import { autenticar, clienteDeServico } from '../_shared/auth.ts'
import { json, lerCorpoJson, origemPermitida, preflight } from '../_shared/http.ts'
import { dentroDoLimite } from '../_shared/limite.ts'
import { ehDataIso, ehUuid } from '../_shared/validacao.ts'

const PLUGGY_CLIENT_ID = Deno.env.get('PLUGGY_CLIENT_ID') ?? ''
const PLUGGY_CLIENT_SECRET = Deno.env.get('PLUGGY_CLIENT_SECRET') ?? ''

const PLUGGY_API = 'https://api.pluggy.ai'

/** Teto de páginas por conta. Guarda contra laço infinito, não contra volume. */
const MAXIMO_DE_PAGINAS = 20

/** Quantos dias para trás, quando quem chama não diz. */
const JANELA_PADRAO_EM_DIAS = 90

/*
 * Freio por conta. Cada sincronização são dezenas de chamadas à Pluggy, que
 * tem cota própria: um laço aqui não derruba só esta função, gasta a cota da
 * aplicação inteira e deixa todo mundo sem importar.
 */
const LIMITE_DE_SYNCS = 20
const JANELA_MS = 60_000

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
  /** Só em conta de cartão. Traz a bandeira, entre outras coisas. */
  creditData?: { brand?: string; level?: string } | null
}

interface LancamentoPluggy {
  id: string
  date?: string
  description?: string
  descriptionRaw?: string
  amount?: number
  type?: string
  /**
   * O parcelamento **declarado** pela instituição, em campo próprio.
   *
   * Vale muito mais que procurar "3/10" no texto: a descrição de fatura varia
   * por banco e muitos não escrevem a posição em lugar nenhum, então a leitura
   * por texto acerta em uns e falha calada em outros. Aqui o dado é estruturado
   * e obrigatório para a instituição reportar.
   */
  creditCardMetadata?: {
    installmentNumber?: number
    totalInstallments?: number
    totalAmount?: number
    purchaseDate?: string
  } | null
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

/**
 * Conta e cartão usam convenções de sinal **opostas** na Pluggy.
 *
 * Em conta corrente, saída de dinheiro é negativa, como todo mundo espera. Em
 * cartão de crédito é ao contrário: a compra vem positiva, porque aumenta o
 * saldo devedor da fatura, e o negativo fica para pagamento e estorno, que o
 * reduzem.
 *
 * Ler as duas com a mesma regra fazia toda compra de cartão entrar como
 * **receita** no produto. O estrago era silencioso e completo: o painel somava
 * gasto como ganho, e Parcelamentos e Assinaturas descartavam tudo, porque as
 * duas telas só olham despesa. Nenhuma mensagem de erro em lugar nenhum.
 *
 * Inverter aqui mantém a conta fechando quando as duas contas são importadas: o
 * pagamento da fatura sai como despesa na corrente e entra como crédito no
 * cartão, e o líquido é o valor pago uma vez só.
 */
function normalizarSinal(centavos: number, tipoDaConta?: string): number {
  return tipoDaConta === 'CREDIT' ? -centavos : centavos
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
  const usuarioId = autenticacao.chamador.id

  if (!dentroDoLimite(`sync:${usuarioId}`, LIMITE_DE_SYNCS, JANELA_MS)) {
    return json(
      { ok: false, error: 'Muitas buscas em pouco tempo. Espere um minuto e tente de novo.' },
      429,
      origin,
    )
  }

  const corpo = await lerCorpoJson<{ action?: unknown; itemId?: unknown; dateFrom?: unknown }>(req)
  if (!corpo) return json({ ok: false, error: 'Corpo inválido.' }, 400, origin)

  /*
   * O identificador da conexão é UUID na Pluggy, e é conferido como tal.
   *
   * Não é formalidade: ele entra numa URL e numa consulta ao banco. Aceitar
   * qualquer texto obrigaria a confiar no `encodeURIComponent` como única
   * barreira, e um formato fixo é uma barreira que não depende de ninguém
   * lembrar de escapar nada.
   */
  if (!ehUuid(corpo.itemId)) {
    return json({ ok: false, error: 'Informe a conexão do Meu Pluggy.' }, 400, origin)
  }
  const itemId = corpo.itemId

  try {
    /*
     * `register` valida o item **antes** de gravá-lo, em duas frentes.
     *
     * A primeira é de digitação: o identificador é copiado à mão do portal, e
     * um engano gravaria uma conexão que nunca vai sincronizar — a pessoa
     * ficaria olhando para uma linha na tela esperando dados que não existem.
     *
     * A segunda é de posse, e é a que faltava. A versão anterior fazia
     * `upsert(..., { onConflict: 'item_id' })` com a chave de serviço, que
     * ignora RLS: quem informasse o `itemId` **de outra pessoa** reescrevia o
     * `user_id` da linha para si e, no `pull` seguinte, lia o extrato bancário
     * dela — passando por uma checagem de posse que ele mesmo tinha acabado de
     * reescrever. A linha existente decide agora, e ela nunca troca de dono.
     */
    if (corpo.action === 'register') {
      const { data: existente, error: erroExistente } = await admin
        .from('bank_connections')
        .select('user_id')
        .eq('item_id', itemId)
        .maybeSingle()

      if (erroExistente) throw new Error(`consulta falhou: ${erroExistente.message}`)

      if (existente && existente.user_id !== usuarioId) {
        /*
         * A mensagem não confirma que a conexão existe e é de outra pessoa —
         * isso transformaria esta função num verificador de identificadores
         * alheios. Ela diz o que quem digitou precisa saber: não deu, confira.
         */
        console.warn('pluggy-sync: tentativa de vincular item de outra conta', itemId)
        return json(
          { ok: false, error: 'Não foi possível vincular esta conexão a esta conta.' },
          409,
          origin,
        )
      }

      // Só depois da posse resolvida é que a Pluggy é consultada: perguntar
      // antes gastaria uma chamada para responder sobre item alheio.
      await pluggyGet(`/items/${encodeURIComponent(itemId)}`)

      const registro = {
        user_id: usuarioId,
        provider: 'pluggy',
        item_id: itemId,
        pending_sync: true,
        last_error: null,
      }

      // Linha nova é `insert`; renovar a própria é `update` com o dono fixado
      // na condição. Nenhum dos dois caminhos consegue trocar o `user_id` de
      // uma linha que já existe, que era exatamente o que o `upsert` permitia.
      const { error } = existente
        ? await admin
            .from('bank_connections')
            .update(registro)
            .eq('item_id', itemId)
            .eq('user_id', usuarioId)
        : await admin.from('bank_connections').insert(registro)

      if (error) throw new Error(`gravação falhou: ${error.message}`)

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
      .eq('user_id', usuarioId)
      .maybeSingle()

    if (conexaoError) throw new Error(`consulta falhou: ${conexaoError.message}`)
    if (!conexao) {
      return json({ ok: false, error: 'Esta conexão não está vinculada à sua conta.' }, 403, origin)
    }

    const dateFrom = ehDataIso(corpo.dateFrom)
      ? corpo.dateFrom
      : diasAtras(JANELA_PADRAO_EM_DIAS)

    /*
     * O nome da instituição vem do item, e não da conta.
     *
     * A conta chega chamada de "GOLD" ou "Conta Corrente" — nomes que não dizem
     * de que banco são. Sem isto o produto não tem como reconhecer a instituição
     * para vestir o cartão com a cor dela, e o cartão do Inter fica genérico
     * mesmo com a conexão funcionando.
     */
    let instituicao: string | null = null
    try {
      const item = await pluggyGet(`/items/${encodeURIComponent(itemId)}`)
      const conector = item.connector as { name?: string } | undefined
      instituicao = conector?.name ?? null
    } catch {
      // Nome de banco é enfeite ao lado dos lançamentos: se a consulta falhar,
      // a importação continua sem ele.
    }

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
        /*
         * `next` vem da Pluggy, mas é usado para montar um caminho nosso: um
         * valor absoluto ali (`https://outro-host/...`) faria a chamada
         * seguinte sair com a `X-API-KEY` da aplicação no cabeçalho, para um
         * servidor que não é o deles. Aceitar só caminho relativo é o que
         * mantém a chave dentro de casa.
         */
        const seguinte = proxima.replace(/^\?/, '')
        if (seguinte.includes('://') || seguinte.startsWith('//')) break
        caminho = seguinte.startsWith('/') ? seguinte : `/v2/transactions?${seguinte}`
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
        // A bandeira só existe em cartão, e nem toda instituição informa. Vai
        // como veio: quem desenha decide o que reconhece.
        brand: conta.creditData?.brand ?? null,
        institution: instituicao,
        entries: lancamentos
          .filter((item) => typeof item.amount === 'number' && item.date)
          .map((item) => {
            const parcela = item.creditCardMetadata
            const index = parcela?.installmentNumber
            const total = parcela?.totalInstallments

            return {
              key: item.id,
              date: dataDeCalendario(item.date as string),
              amountCents: normalizarSinal(paraCentavos(item.amount as number), conta.type),
              description: item.description ?? item.descriptionRaw ?? 'Lançamento sem descrição',
              // Só vale como parcelamento se houver mais de uma: o campo vem
              // preenchido com 1/1 em compra à vista, que não é parcelamento
              // nenhum e encheria a tela de compras de uma parcela só.
              declaredInstallment:
                typeof index === 'number' && typeof total === 'number' && total > 1
                  ? {
                      index,
                      total,
                      totalAmountCents:
                        typeof parcela?.totalAmount === 'number'
                          ? paraCentavos(parcela.totalAmount)
                          : null,
                      purchaseDate: parcela?.purchaseDate?.slice(0, 10) ?? null,
                    }
                  : null,
            }
          }),
      })
    }

    await admin
      .from('bank_connections')
      .update({ pending_sync: false, last_error: null })
      .eq('item_id', itemId)
      .eq('user_id', usuarioId)

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
