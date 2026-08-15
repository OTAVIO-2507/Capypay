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
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const WEBHOOK_SECRET = Deno.env.get('PLUGGY_WEBHOOK_SECRET') ?? ''

interface PluggyEvent {
  event?: string
  eventId?: string
  itemId?: string
  error?: unknown
}

/**
 * Comparação de tempo constante.
 *
 * `===` em string sai no primeiro caractere diferente, e a diferença de tempo
 * entre "errou na primeira letra" e "errou na última" é medível pela rede.
 * Com isso dá para descobrir o segredo letra a letra, sem nunca acertá-lo.
 */
function segredoConfere(recebido: string, esperado: string): boolean {
  if (recebido.length !== esperado.length) return false
  let diferenca = 0
  for (let i = 0; i < recebido.length; i += 1) {
    diferenca |= recebido.charCodeAt(i) ^ esperado.charCodeAt(i)
  }
  return diferenca === 0
}

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
  if (!segredoConfere(token, WEBHOOK_SECRET)) {
    // 404 e não 401: para quem está varrendo URLs, a função não existe. Um 401
    // confirmaria que existe algo ali e que só falta a chave certa.
    return new Response('Não encontrado.', { status: 404 })
  }

  let evento: PluggyEvent
  try {
    evento = (await req.json()) as PluggyEvent
  } catch {
    return new Response('Corpo inválido.', { status: 400 })
  }

  const { event, itemId, eventId } = evento
  if (!event || !itemId) {
    return new Response('Evento sem event ou itemId.', { status: 400 })
  }

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)

  /*
   * `item/created` e `item/updated` significam "há dados novos para buscar".
   * `item/error` significa que a conexão quebrou — quase sempre credencial
   * expirada ou autorização revogada no banco — e aí marcar como pendente
   * seria pedir ao app que buscasse algo que não vai vir. O estado é gravado
   * para a tela poder dizer à pessoa que aquele banco precisa ser reconectado.
   */
  const pendente = event === 'item/created' || event === 'item/updated'

  const { error } = await admin
    .from('bank_connections')
    .update({
      pending_sync: pendente,
      last_event: event,
      last_event_at: new Date().toISOString(),
      last_error: event === 'item/error' ? String(evento.error ?? 'erro sem detalhe') : null,
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
  return new Response(JSON.stringify({ received: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
})
