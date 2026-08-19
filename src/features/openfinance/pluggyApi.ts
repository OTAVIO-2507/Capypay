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

/** Um extrato como a Edge Function `pluggy-sync` devolve, já neutro. */
export interface ExtratoSincronizado {
  accountKey: string
  accountLabel: string
  kind: 'checking' | 'credit_card'
  /** Saldo informado pela instituição. Nulo quando ela não informa. */
  balanceCents: number | null
  number: string | null
  brand: string | null
  institution: string | null
  entries: {
    key: string
    date: string
    amountCents: number
    description: string
    declaredInstallment?: { index: number; total: number; totalAmountCents?: number | null } | null
  }[]
}

/**
 * Vincula uma conexão do Meu Pluggy a esta conta.
 *
 * O identificador é copiado à mão do portal, então a função confirma que ele
 * existe antes de gravar: um engano de digitação viraria uma conexão que nunca
 * sincroniza, e a pessoa ficaria esperando dados de algo que não existe.
 */
export async function registrarItemDoMeuPluggy(itemId: string): Promise<void> {
  await chamarSync({ action: 'register', itemId })
}

/**
 * Busca contas e lançamentos de uma conexão já vinculada.
 *
 * Não cria conexão nenhuma: quem conecta banco é o portal do Meu Pluggy. Este
 * caminho existe porque criar conexão pelo widget é justamente o que o plano
 * gratuito não permite, e ler o que já está conectado é o que permite.
 */
export async function sincronizarComPluggy(
  itemId: string,
  dateFrom?: string,
): Promise<ExtratoSincronizado[]> {
  const dados = await chamarSync({ action: 'pull', itemId, dateFrom })
  return (dados.statements ?? []) as ExtratoSincronizado[]
}

async function chamarSync(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  const { data, error } = await supabase.functions.invoke<
    ({ ok: true } & Record<string, unknown>) | { ok: false; error: string }
  >('pluggy-sync', { body })

  if (error) throw new Error(await descreverErro(error, 'pluggy-sync'))
  if (!data) throw new Error('O servidor respondeu vazio ao falar com o banco.')
  if (data.ok === false) throw new Error(data.error)

  return data
}

/**
 * Traduz a falha do `invoke`, pelo mesmo motivo de `adminApi`: qualquer
 * resposta fora de 2xx chega aqui com `data` nulo, e a mensagem que o servidor
 * escreveu está pendurada em `context`. Sem lê-la de volta, tanto "não
 * configurado" quanto "não publicado" viram o mesmo "não foi possível".
 */
async function descreverErro(error: unknown, funcao = 'pluggy-connect-token'): Promise<string> {
  const contexto = (error as { context?: unknown }).context

  if (contexto instanceof Response) {
    /*
     * O 404 é ambíguo aqui e os dois casos pedem ações opostas: função não
     * publicada é problema de quem instalou, e item inexistente é erro de
     * digitação de quem está na tela. O corpo distingue os dois, porque a
     * função responde com JSON e o roteador do Supabase não.
     */
    if (contexto.status === 404) {
      try {
        const corpo = (await contexto.clone().json()) as { error?: unknown }
        if (typeof corpo.error === 'string' && corpo.error) return corpo.error
      } catch {
        // Sem JSON: é o 404 do roteador, e não o da função.
      }
      return `A função "${funcao}" ainda não foi publicada no Supabase.`
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
