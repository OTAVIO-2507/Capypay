import { supabase } from '@/data/supabaseClient'

/**
 * Pede um Connect Token à Edge Function `pluggy-connect-token`.
 *
 * O token é a credencial de vida curta que o widget da Pluggy precisa para
 * abrir. Ele nasce no servidor porque nascer no navegador exigiria o
 * `clientSecret` da Pluggy aqui — e um segredo que chega ao navegador é um
 * segredo publicado, exatamente como a `service_role key` do Supabase.
 *
 * Quem chama não escolhe o usuário. A função carimba o token com o id da
 * própria sessão, então não há parâmetro a passar nem a validar aqui.
 */
export async function criarConnectToken(): Promise<string> {
  const { data, error } = await supabase.functions.invoke<
    { ok: true; accessToken: string } | { ok: false; error: string }
  >('pluggy-connect-token', { body: {} })

  if (error) throw new Error(await descreverErro(error))
  if (!data) throw new Error('O servidor respondeu vazio ao pedir a conexão bancária.')
  if (data.ok === false) throw new Error(data.error)

  return data.accessToken
}

/**
 * Traduz a falha do `invoke`, pelo mesmo motivo de `adminApi`: qualquer
 * resposta fora de 2xx chega aqui com `data` nulo, e a mensagem que o servidor
 * escreveu está pendurada em `context`. Sem lê-la de volta, tanto "não
 * configurado" quanto "não publicado" viram o mesmo "não foi possível".
 */
async function descreverErro(error: unknown): Promise<string> {
  const contexto = (error as { context?: unknown }).context

  if (contexto instanceof Response) {
    if (contexto.status === 404) {
      return 'A função "pluggy-connect-token" ainda não foi publicada no Supabase.'
    }

    try {
      const corpo = (await contexto.clone().json()) as { error?: unknown }
      if (typeof corpo.error === 'string' && corpo.error) return corpo.error
    } catch {
      // Resposta sem JSON: cai na mensagem genérica abaixo.
    }
  }

  return error instanceof Error ? error.message : 'Falha ao falar com o servidor.'
}
