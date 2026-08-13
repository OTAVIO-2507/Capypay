import { createEmptyData } from '@/data/defaults'
import { reconcileData } from '@/data/migrate'
import type { FinanceRepository } from '@/data/repository'
import { supabase } from '@/data/supabaseClient'
import type { FinanceData } from '@/domain/types'

const TABLE = 'user_finance_data'

/**
 * Persistência no Supabase, uma linha por usuário.
 *
 * O documento inteiro vive num único campo `jsonb` — a mesma granularidade de
 * `localRepository`, e por isso a mesma interface serve sem alteração.
 * `user_id` nunca é enviado pelo cliente: a coluna tem `default auth.uid()` e
 * a política de RLS confirma o dono a cada escrita, então não há como esta
 * implementação escrever (ou ler) a linha de outra pessoa, mesmo por engano.
 */
export function createSupabaseRepository(): FinanceRepository {
  return {
    async load() {
      const { data: row, error } = await supabase.from(TABLE).select('data').maybeSingle()

      if (error) {
        throw new Error('Não foi possível carregar seus dados.', { cause: error })
      }

      // Sem linha ainda (primeiro acesso desta conta): começa vazio, sem
      // gravar nada — o mesmo comportamento de `localRepository` antes do
      // primeiro `save()`.
      if (!row) return createEmptyData()

      return reconcileData(row.data)
    },

    async save(data: FinanceData) {
      const { error } = await supabase.from(TABLE).upsert({ data }, { onConflict: 'user_id' })

      if (error) {
        throw new Error('Não foi possível salvar os dados.', { cause: error })
      }
    },

    async clear() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { error } = await supabase.from(TABLE).delete().eq('user_id', user.id)
      if (error) {
        throw new Error('Não foi possível limpar os dados.', { cause: error })
      }
    },
  }
}
