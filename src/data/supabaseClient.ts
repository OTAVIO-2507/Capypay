import { createClient } from '@supabase/supabase-js'

/**
 * Instância única do cliente Supabase.
 *
 * `supabaseRepository.ts` e `store/authStore.ts` importam esta mesma
 * instância — a sessão viva que ela mantém é o que escopa toda leitura e
 * escrita ao usuário logado, sem precisar passar um `userId` adiante.
 */
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

/*
 * A mensagem da biblioteca para variável ausente é "supabaseUrl is required",
 * que não diz qual variável, nem onde defini-la, nem que existe um arquivo de
 * exemplo. Quem clona o repositório e roda `npm run dev` encontra isso antes
 * de qualquer outra coisa do produto.
 */
if (!url || !anonKey) {
  throw new Error(
    'Faltam VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY. Copie .env.example para .env.local e preencha com os valores do seu projeto Supabase (Project Settings → API).',
  )
}

/*
 * As opções vão escritas, e não deixadas no padrão.
 *
 * Todas coincidem com o padrão da biblioteca hoje. Estão aqui porque padrão é
 * decisão de outra pessoa, que muda de versão em versão sem passar por revisão
 * nossa — e estas três decidem onde o token da sessão vive e quando ele é
 * criado, que é o material mais sensível que este cliente manipula.
 *
 * `flowType: 'pkce'` é a que muda alguma coisa: no fluxo anterior o token
 * chegava no fragmento da URL, onde ele entra no histórico do navegador e pode
 * vazar por extensão ou por captura de tela. Com PKCE, a URL carrega um código
 * de uso único que só vale acompanhado de um segredo gerado neste navegador e
 * que nunca sai dele.
 */
export const supabase = createClient(url, anonKey, {
  auth: {
    flowType: 'pkce',
    persistSession: true,
    autoRefreshToken: true,
    // Necessário para o link de convite completar a entrada ao abrir o app.
    detectSessionInUrl: true,
  },
})
