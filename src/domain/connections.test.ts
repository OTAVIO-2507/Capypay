import { describe, expect, it } from 'vitest'
import { createEmptyData } from '@/data/defaults'
import { reconcileData } from '@/data/migrate'
import type { BankConnection, FinanceData } from './types'

/**
 * A autorização de Open Finance é o único vestígio que sobra de um
 * consentimento bancário inteiro. Perdê-la significa refazer todo o fluxo no
 * banco, então o que estes testes protegem é a sobrevivência dela — na leitura
 * de dados antigos e no formato gravado.
 */

function comConexoes(connections: BankConnection[]): FinanceData {
  return { ...createEmptyData(), connections }
}

const CONEXAO: BankConnection = {
  provider: 'pluggy',
  itemId: 'item-123',
  connectedAt: 1_700_000_000_000,
  lastSyncedAt: null,
}

describe('reconcileData e as conexões bancárias', () => {
  it('devolve lista vazia para dado salvo antes do campo existir', () => {
    const antigo = createEmptyData() as Partial<FinanceData>
    delete antigo.connections

    expect(reconcileData(antigo).connections).toEqual([])
  })

  it('preserva a conexão gravada', () => {
    expect(reconcileData(comConexoes([CONEXAO])).connections).toEqual([CONEXAO])
  })

  it('descarta o campo quando ele não é lista', () => {
    const corrompido = { ...createEmptyData(), connections: 'pluggy' } as unknown

    expect(reconcileData(corrompido).connections).toEqual([])
  })

  it('nasce vazio numa conta nova', () => {
    expect(createEmptyData().connections).toEqual([])
  })
})
