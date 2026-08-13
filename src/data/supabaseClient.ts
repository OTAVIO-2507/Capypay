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

export const supabase = createClient(url, anonKey)
