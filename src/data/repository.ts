import type { Account, FinanceData, Transaction } from '@/domain/types'

/**
 * A fronteira entre o aplicativo e onde os dados moram.
 *
 * Hoje existe uma única implementação, sobre `localStorage`. A interface é
 * assíncrona mesmo assim: `localStorage` é síncrono, mas uma API não é, e ter
 * os pontos de chamada já preparados para `await` significa que trocar a
 * implementação não obriga a reescrever a camada de cima.
 */
export interface FinanceRepository {
  load(): Promise<FinanceData>
  save(data: FinanceData): Promise<void>
  clear(): Promise<void>
}

/**
 * Contrato previsto para a sincronização bancária via agregador
 * (Pluggy, Belvo ou equivalente do Open Finance).
 *
 * Está aqui como tipo, não como funcionalidade: nada implementa esta interface
 * ainda, e o aplicativo não fala com nenhuma instituição financeira. O valor de
 * escrevê-la agora é obrigar o modelo de dados a comportá-la — foi ela que
 * exigiu `Transaction.externalId`, `Transaction.source` e a entidade `Account`.
 *
 * Quando for implementada, o lugar dela é um backend: as credenciais e o token
 * do agregador não podem viver no navegador.
 */
export interface BankSyncProvider {
  readonly name: string

  /** Abre o fluxo de consentimento e devolve as contas autorizadas. */
  connect(): Promise<Account[]>

  /**
   * Busca lançamentos de uma conta a partir de uma data.
   * O chamador é responsável por descartar os que já existem, comparando
   * `externalId` — o agregador reenvia o mesmo lançamento a cada sincronia.
   */
  fetchTransactions(accountId: string, since: string): Promise<Transaction[]>

  disconnect(accountId: string): Promise<void>
}

/**
 * Junta lançamentos vindos de fora ao que já existe, sem duplicar.
 *
 * A regra de precedência é deliberada: o que o usuário digitou vence o que veio
 * da instituição. Uma sincronização não pode apagar uma correção manual.
 */
export function mergeSyncedTransactions(
  existing: readonly Transaction[],
  incoming: readonly Transaction[],
): Transaction[] {
  const byExternalId = new Map<string, Transaction>()
  for (const transaction of existing) {
    if (transaction.externalId) byExternalId.set(transaction.externalId, transaction)
  }

  const additions = incoming.filter((transaction) => {
    if (!transaction.externalId) return true
    return !byExternalId.has(transaction.externalId)
  })

  return [...existing, ...additions]
}
