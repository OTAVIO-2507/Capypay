// Edge Function (Deno) — recebe os avisos da Pluggy sobre os itens conectados.
//
// Publicada com `--no-verify-jwt`, porque webhook chega de servidor para
// servidor e não tem sessão. Isso a deixa alcançável por qualquer um que
// descubra a URL, então o segredo na própria URL é a única porta — e por isso
// é conferido antes de qualquer outra coisa, inclusive antes de ler o corpo.
//
// **Ela não importa nada.** Anota que aquele item tem novidade e responde.
// Dois motivos, e os dois são impeditivos:
//
// 1. A Pluggy exige 2XX em cinco segundos. Buscar contas e lançamentos na API
//    deles em cascata estoura isso com facilidade, e o que a Pluggy faz com
//    uma resposta lenta é tratar como falha e reenviar — o que transformaria
//    uma importação demorada numa importação repetida.
//
// 2. `user_finance_data` guarda o documento inteiro do usuário numa coluna
//    jsonb, e `save()` no navegador reescreve o documento todo. Uma escrita
//    daqui seria apagada pelo próximo save do navegador, e vice-versa. Como
//    sincronização acontece justamente enquanto a pessoa usa o app, não é um
//    risco remoto: é o caso comum.
//
// A marca fica em `bank_connections`, tabela que o navegador só lê. Quem
// importa é o app, ao abrir, pelo caminho normal — assim `save()` continua
// sendo o único escritor do documento e o conflito deixa de existir.
import { clienteDeServico } from '../_shared/auth.ts'
import { LIMITE_DE_CORPO } from '../_shared/http.ts'
import { ehUuid, textoLimitado } from '../_shared/validacao.ts'

const WEBHOOK_SECRET = Deno.env.get('PLUGGY_WEBHOOK_SECRET') ?? ''

interface PluggyEvent {
  event?: string
  eventId?: string
  itemId?: string
  error?: unknown
}

function json(corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status: 200,
    headers: {
      'Content-Type': 'application/json',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  })
}

/**
 * Comparação de tempo constante, sobre o resumo dos dois valores.
 *
 * `===` em string sai no primeiro caractere diferente, e a diferença de tempo
 * entre "errou na primeira letra" e "errou na última" é medível pela rede: dá
 * para descobrir o segredo letra a letra sem nunca acertá-lo.
 *
 * Comparar o SHA-256 de cada lado, e não os textos, resolve também o que a
 * versão anterior deixava passar — ela devolvia `false` de imediato quando os
 * comprimentos diferiam, o que entrega o **tamanho** do segredo a quem
 * cronometrar. Resumos têm sempre 32 bytes, então não há tamanho a vazar.
 */
async function resumo(valor: string): Promise<Uint8Array> {
  const bytes = new TextEncoder().encode(valor)
  return new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))
}

async function segredoConfere(recebido: string, esperado: string): Promise<boolean> {
  const [a, b] = await Promise.all([resumo(recebido), resumo(esperado)])
  let diferenca = 0
  for (let i = 0; i < a.length; i += 1) diferenca |= a[i] ^ b[i]
  return diferenca === 0
}

/** Teto do detalhe do erro que a Pluggy manda. Ver a nota no uso. */
const MAXIMO_DETALHE = 500

Deno.serve(async (req) => {
  // Sem CORS: isto não é chamado por navegador nenhum. Um preflight aqui é
  // sinal de uso indevido, não de integração.
  if (req.method !== 'POST') {
    return new Response('Método não suportado.', { status: 405 })
  }

  if (!WEBHOOK_SECRET) {
    console.error('pluggy-webhook: PLUGGY_WEBHOOK_SECRET ausente')
    return new Response('Não configurado.', { status: 503 })
  }

  const token = new URL(req.url).searchParams.get('token') ?? ''
  if (!(await segredoConfere(token, WEBHOOK_SECRET))) {
    // 404 e não 401: para quem está varrendo URLs, a função não existe. Um 401
    // confirmaria que existe algo ali e que só falta a chave certa.
    return new Response('Não encontrado.', { status: 404 })
  }

  /*
   * O corpo é lido com teto mesmo depois do segredo conferido.
   *
   * O segredo pode vazar — ele viaja na URL, e URL entra em log de proxy e em
   * histórico de ferramenta. Quem o tiver não deve conseguir mais do que
   * escrever um aviso: um corpo de dezenas de megabytes aqui é memória da
   * função gasta por uma requisição só.
   */
  const declarado = Number(req.headers.get('content-length') ?? '0')
  if (Number.isFinite(declarado) && declarado > LIMITE_DE_CORPO) {
    return new Response('Corpo grande demais.', { status: 413 })
  }

  let evento: PluggyEvent
  try {
    const texto = await req.text()
    if (texto.length > LIMITE_DE_CORPO) {
      return new Response('Corpo grande demais.', { status: 413 })
    }
    evento = JSON.parse(texto) as PluggyEvent
  } catch {
    return new Response('Corpo inválido.', { status: 400 })
  }

  const { event, itemId, eventId } = evento

  /*
   * O que esta função sabe fazer. O cadastro do webhook na Pluggy costuma
   * ficar em "all", e "all" inclui evento de conector, de pagamento e o que
   * eles vierem a criar depois.
   *
   * O que não está aqui recebe 200 e é descartado, e não 400. Um 4xx num
   * evento que simplesmente não nos interessa faz o provedor reenviar em
   * intervalos crescentes e, em alguns casos, marcar o endpoint como
   * defeituoso — punição para quem está funcionando exatamente como deveria.
   * Confirmar o recebimento é dizer "chegou", não "concordo".
   */
  const CONHECIDOS = new Set(['item/created', 'item/updated', 'item/error'])

  if (!event) {
    return new Response('Evento sem campo event.', { status: 400 })
  }

  // O `itemId` vira condição de uma consulta: conferir o formato antes é o que
  // dispensa confiar no tratamento de tipo do cliente do banco.
  if (!CONHECIDOS.has(event) || !ehUuid(itemId)) {
    return json({ received: true, ignored: event })
  }

  const admin = clienteDeServico()

  /*
   * `item/created` e `item/updated` significam "há dados novos para buscar".
   * `item/error` significa que a conexão quebrou — quase sempre credencial
   * expirada ou autorização revogada no banco — e aí marcar como pendente
   * seria pedir ao app que buscasse algo que não vai vir. O estado é gravado
   * para a tela poder dizer à pessoa que aquele banco precisa ser reconectado.
   */
  const pendente = event === 'item/created' || event === 'item/updated'

  /*
   * O detalhe do erro é truncado antes de virar linha.
   *
   * Ele vem de fora e vai para uma coluna `text`, que não tem limite próprio.
   * Quinhentos caracteres cobrem qualquer mensagem real de conexão quebrada, e
   * o que passar disso é volume, não informação.
   */
  const detalhe =
    event === 'item/error'
      ? (textoLimitado(
          typeof evento.error === 'string' ? evento.error : JSON.stringify(evento.error ?? null),
          MAXIMO_DETALHE,
        ) ?? 'erro sem detalhe')
      : null

  const { error } = await admin
    .from('bank_connections')
    .update({
      pending_sync: pendente,
      last_event: event,
      last_event_at: new Date().toISOString(),
      last_error: detalhe,
    })
    .eq('item_id', itemId)

  if (error) {
    // O erro sobe no log, mas a resposta é 200 de propósito: um 5xx faria a
    // Pluggy reenviar o mesmo evento em intervalos crescentes, e se a falha
    // for do banco de dados a repetição não conserta nada — só multiplica.
    console.error('pluggy-webhook:', event, eventId, error.message)
  }

  // Sempre 200, e sempre rápido. Item desconhecido também sai por aqui: pode
  // ser de uma conexão que o usuário removeu, e insistir num evento órfão não
  // leva a lugar nenhum.
  return json({ received: true })
})
