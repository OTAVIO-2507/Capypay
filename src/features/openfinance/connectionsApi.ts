import { supabase } from '@/data/supabaseClient'

const TABELA = 'bank_connections'

/**
 * O índice de conexões que vive em tabela, e não no documento do usuário.
 *
 * O documento (`user_finance_data.data`) é gravado inteiro a cada `save()` do
 * navegador. Um webhook escrevendo lá seria apagado pelo save seguinte, e o
 * save seguinte apagado por ele — e sincronização acontece justamente enquanto
 * a pessoa usa o app. Por isso o que o servidor escreve mora numa tabela que o
 * navegador só lê.
 *
 * A divisão não é duplicação: o documento guarda **o que o usuário conectou**,
 * que é a lista da tela; a tabela guarda **o que o servidor sabe** sobre cada
 * conexão — se há dados novos esperando, qual foi o último evento, se a
 * autorização quebrou. Só o `itemId` aparece nos dois, e é a chave que liga um
 * ao outro.
 */

/** Uma conexão como a tela de importação precisa dela. */
export interface Conexao {
  itemId: string
  provider: string
  pendingSync: boolean
  lastEvent: string | null
  lastEventAt: string | null
  lastError: string | null
}

/**
 * As conexões desta conta.
 *
 * Sem filtro por `user_id`: a política de RLS já restringe a leitura às linhas
 * de quem pede, e repetir a condição aqui daria a impressão de que ela é o que
 * protege — se um dia a política mudasse, o filtro no cliente continuaria
 * parecendo suficiente sem ser.
 */
export async function listarConexoes(): Promise<Conexao[]> {
  const { data, error } = await supabase
    .from(TABELA)
    .select('item_id, provider, pending_sync, last_event, last_event_at, last_error')
    .order('created_at', { ascending: true })

  if (error) throw new Error('Não foi possível ler suas conexões bancárias.', { cause: error })

  return (data ?? []).map((linha) => ({
    itemId: linha.item_id as string,
    provider: linha.provider as string,
    pendingSync: Boolean(linha.pending_sync),
    lastEvent: (linha.last_event as string | null) ?? null,
    lastEventAt: (linha.last_event_at as string | null) ?? null,
    lastError: (linha.last_error as string | null) ?? null,
  }))
}

/** Desfaz o vínculo. Não desconecta no Meu Pluggy, que é o portal de lá. */
export async function esquecerConexao(itemId: string): Promise<void> {
  const { error } = await supabase.from(TABELA).delete().eq('item_id', itemId)
  if (error) throw new Error('Não foi possível remover a conexão.', { cause: error })
}

/**
 * Registra a autorização recém-concedida.
 *
 * `upsert` e não `insert`: reconectar o mesmo banco devolve o mesmo `itemId`,
 * e um insert simples falharia na chave única. Reconectar é renovar, não
 * criar — e é justamente o gesto que resolve uma conexão quebrada, então
 * `last_error` volta a nulo e a conexão volta a valer como pendente de
 * importação.
 */
export async function registrarConexao(itemId: string, provider = 'pluggy'): Promise<void> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error('Sessão ausente.')

  const { error } = await supabase.from(TABELA).upsert(
    {
      user_id: user.id,
      provider,
      item_id: itemId,
      pending_sync: true,
      last_event: null,
      last_event_at: null,
      last_error: null,
    },
    { onConflict: 'item_id' },
  )

  if (error) throw new Error('Não foi possível registrar a conexão bancária.', { cause: error })
}
