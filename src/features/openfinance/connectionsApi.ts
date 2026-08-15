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
 *
 * A leitura desses campos ainda não tem quem a use: ela nasce junto com a
 * importação, que é a etapa seguinte. Escrever agora uma função de leitura sem
 * chamador seria adivinhar a forma de que ela vai precisar.
 */

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
