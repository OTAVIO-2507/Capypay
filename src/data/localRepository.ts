import type { FinanceData } from '@/domain/types'
import { createEmptyData, LEGACY_STORAGE_KEY, STORAGE_KEY } from './defaults'
import { migrateLegacyData, reconcileData } from './migrate'
import type { FinanceRepository } from './repository'

/**
 * Persistência no navegador.
 *
 * `localStorage` pode simplesmente não existir: navegação privativa em alguns
 * navegadores, cookies bloqueados, iframe restrito. Nesses casos o aplicativo
 * segue funcionando em memória durante a sessão em vez de quebrar na abertura —
 * perder os dados ao fechar a aba é ruim, mas uma tela branca é pior.
 */
function getStorage(): Storage | null {
  try {
    const probe = '__cf_probe__'
    window.localStorage.setItem(probe, probe)
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return null
  }
}

export interface LoadResult {
  data: FinanceData
  /** Verdadeiro quando a base veio da versão anterior e foi convertida. */
  migratedFromLegacy: boolean
  /** Verdadeiro quando não há como persistir nesta sessão. */
  storageUnavailable: boolean
}

export function loadFromStorage(): LoadResult {
  const storage = getStorage()
  if (!storage) {
    return { data: createEmptyData(), migratedFromLegacy: false, storageUnavailable: true }
  }

  const current = storage.getItem(STORAGE_KEY)
  if (current) {
    try {
      const data = reconcileData(JSON.parse(current))

      /*
       * Se o saneamento mudou alguma coisa, o resultado é gravado de volta na
       * hora. Sem isto o reparo viveria só em memória: a tela funcionaria, mas
       * o dado estragado continuaria no armazenamento, esperando a próxima
       * versão do código para voltar a incomodar. Curar na leitura é o que faz
       * o problema acabar de fato.
       */
      const repaired = JSON.stringify(data)
      if (repaired !== current) storage.setItem(STORAGE_KEY, repaired)

      return { data, migratedFromLegacy: false, storageUnavailable: false }
    } catch {
      // JSON corrompido não pode impedir a abertura. O dado antigo continua na
      // chave, intocado, para eventual recuperação manual.
      return { data: createEmptyData(), migratedFromLegacy: false, storageUnavailable: false }
    }
  }

  const legacy = storage.getItem(LEGACY_STORAGE_KEY)
  if (legacy) {
    const migrated = migrateLegacyData(legacy)
    if (migrated) {
      storage.setItem(STORAGE_KEY, JSON.stringify(migrated))
      // A chave antiga permanece de propósito: se a conversão tiver errado
      // algo, o original ainda está lá para ser reprocessado.
      return { data: migrated, migratedFromLegacy: true, storageUnavailable: false }
    }
  }

  return { data: createEmptyData(), migratedFromLegacy: false, storageUnavailable: false }
}

export function createLocalRepository(): FinanceRepository {
  return {
    async load() {
      return loadFromStorage().data
    },

    async save(data: FinanceData) {
      const storage = getStorage()
      if (!storage) return

      try {
        storage.setItem(STORAGE_KEY, JSON.stringify(data))
      } catch (error) {
        // Cota estourada é o caso realista aqui. Falhar em silêncio esconderia
        // perda de dados do usuário, então o erro sobe.
        throw new Error('Não foi possível salvar os dados neste navegador.', { cause: error })
      }
    },

    async clear() {
      const storage = getStorage()
      if (!storage) return
      storage.removeItem(STORAGE_KEY)
    },
  }
}
