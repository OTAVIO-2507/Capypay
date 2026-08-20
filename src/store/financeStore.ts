import { create } from 'zustand'
import { createEmptyData } from '@/data/defaults'
import { createSupabaseRepository } from '@/data/supabaseRepository'
import { CONTRIBUTION_CATEGORY_ID } from '@/domain/categories'
import type { SeriesPlan } from '@/domain/detectSeries'
import type {
  Account,
  CategoryId,
  FinanceData,
  Goal,
  RecurrenceDraft,
  ThemePreference,
  Transaction,
  TransactionDraft,
  TransactionId,
} from '@/domain/types'
import { currentMonth, shiftDate, shiftMonth, type MonthKey } from '@/lib/date'
import { createId } from '@/lib/id'
import type { Cents } from '@/lib/money'

const repository = createSupabaseRepository()

type LoadStatus = 'idle' | 'loading' | 'ready' | 'error'

/**
 * A conta de onde um lote importado veio.
 *
 * `externalKey` é o que amarra as importações seguintes à mesma conta, e por
 * isso precisa ser estável na origem: o id da conta na Pluggy, ou o número da
 * conta no OFX.
 */
/** Um lançamento a importar, com a conta de origem junto. */
export type ImportedDraft = TransactionDraft & { accountKey?: string | null }

export interface ImportedAccount {
  externalKey: string
  name: string
  kind: Account['kind']
  provider: string
  number?: string | null
  /** Saldo informado pela instituição. `null` quando ela não diz. */
  balanceCents?: Cents | null
  brand?: string | null
  institution?: string | null
}

interface FinanceState {
  data: FinanceData
  /** Ciclo de vida do carregamento remoto — ver `mutate()` e `loadForUser()`. */
  status: LoadStatus
  loadError: string | null
  /** Mês que governa a rota inteira. Não é persistido: a sessão começa no mês atual. */
  selectedMonth: MonthKey
  saveError: string | null

  setSelectedMonth: (month: MonthKey) => void

  /** Busca os dados da conta logada. Chamado por `RequireUser` a cada sessão nova. */
  loadForUser: () => Promise<void>
  /** Volta ao estado inicial, sem dados em memória — ao trocar ou perder a sessão. */
  reset: () => void

  setTheme: (theme: ThemePreference) => void
  togglePrivacy: () => void
  setProfileName: (name: string) => void
  updateProfile: (patch: Partial<FinanceData['profile']>) => void

  addTransaction: (draft: TransactionDraft, recurrence?: RecurrenceDraft | null) => void
  /** Grava um extrato conferido de uma vez. Ver a nota na implementação. */
  importTransactions: (
    drafts: readonly ImportedDraft[],
    account?: readonly ImportedAccount[],
  ) => void
  /** Troca a categoria de vários lançamentos de uma vez. */
  recategorize: (mudancas: readonly { id: TransactionId; categoryId: CategoryId }[]) => void
  /** Aplica séries reconhecidas em lançamentos que já estavam no histórico. */
  applySeriesPlans: (plans: readonly SeriesPlan[]) => void
  /** Corrige valor e tipo do que já foi importado. Ver a nota na implementação. */
  correctImported: (
    correcoes: readonly { id: TransactionId; kind: Transaction['kind']; amountCents: Cents }[],
  ) => void
  updateTransaction: (id: TransactionId, patch: Partial<Transaction>) => void
  deleteTransaction: (id: TransactionId) => void
  deleteSeries: (seriesId: string) => void
  /** Desfaz a série sem apagar os lançamentos. Ver a nota na implementação. */
  ungroupSeries: (seriesId: string) => void
  /** Solta as séries vindas de importação, para serem reconhecidas de novo. */
  ungroupImportedSeries: () => void
  /** Passa uma série para compra parcelada, no número de vezes informado. */
  convertToInstallment: (seriesId: string, total: number) => void

  addGoal: (goal: Omit<Goal, 'id' | 'createdAt' | 'archived'>) => void
  updateGoal: (id: string, patch: Partial<Goal>) => void
  deleteGoal: (id: string) => void

  setBudget: (month: MonthKey, categoryId: CategoryId, limitCents: Cents) => void
  copyBudgetsFromPreviousMonth: (month: MonthKey) => void

  addAccount: (account: Omit<Account, 'id' | 'createdAt' | 'archived'>) => void
  registerBankConnection: (provider: string, itemId: string) => void
  removeBankConnection: (itemId: string) => void
  updateAccount: (id: string, patch: Partial<Account>) => void
  deleteAccount: (id: string) => void

  replaceAll: (data: FinanceData) => void
  /** Semeia a base de demonstração preservando quem a pessoa é. */
  loadDemoData: (demo: FinanceData) => void
  clearAll: () => void
}

export const useFinanceStore = create<FinanceState>()((set, get) => {
  /**
   * Todo caminho de escrita passa por aqui: aplica a mudança, publica o novo
   * estado e persiste. Centralizar isso é o que garante que nenhuma ação possa
   * esquecer de salvar — a falha mais comum da versão anterior, onde cada
   * handler chamava `saveData()` por conta própria.
   */
  const mutate = (recipe: (data: FinanceData) => FinanceData) => {
    // Sem esta guarda, uma ação disparada antes de `loadForUser()` terminar
    // salvaria o documento quase vazio (`createEmptyData()`) por cima dos
    // dados reais já gravados no Supabase — o único jeito de esta troca
    // perder dados de verdade em vez de só atrasar a tela.
    if (get().status !== 'ready') return

    const next = recipe(get().data)
    set({ data: next })
    repository.save(next).catch((error: unknown) => {
      set({
        saveError:
          error instanceof Error ? error.message : 'Não foi possível salvar os dados.',
      })
    })
  }

  return {
    data: createEmptyData(),
    status: 'idle',
    loadError: null,
    selectedMonth: currentMonth(),
    saveError: null,

    setSelectedMonth: (month) => set({ selectedMonth: month }),

    loadForUser: async () => {
      if (get().status === 'loading') return
      set({ status: 'loading', loadError: null })

      try {
        const data = await repository.load()
        set({ data, status: 'ready' })
      } catch (error) {
        set({
          status: 'error',
          loadError:
            error instanceof Error ? error.message : 'Não foi possível carregar seus dados.',
        })
      }
    },

    reset: () => set({ data: createEmptyData(), status: 'idle', loadError: null, saveError: null }),

    setTheme: (theme) =>
      mutate((data) => ({ ...data, settings: { ...data.settings, theme } })),

    togglePrivacy: () =>
      mutate((data) => ({
        ...data,
        settings: { ...data.settings, privacyMode: !data.settings.privacyMode },
      })),

    setProfileName: (name) => mutate((data) => ({ ...data, profile: { ...data.profile, name } })),

    updateProfile: (patch) =>
      mutate((data) => ({ ...data, profile: { ...data.profile, ...patch } })),

    addTransaction: (draft, recurrence) =>
      mutate((data) => ({
        ...data,
        transactions: [...data.transactions, ...expandRecurrence(draft, recurrence)],
      })),

    /*
     * A importação grava de uma vez, e não chamando `addTransaction` numa
     * repetição: cada chamada persiste o documento inteiro, então trinta
     * lançamentos seriam trinta idas ao servidor, com a chance de a décima
     * falhar e deixar metade de um extrato dentro do histórico. Um lote é uma
     * escrita e um resultado só.
     */
    importTransactions: (drafts, account) =>
      mutate((data) => {
        const now = Date.now()

        /*
         * A conta de origem é aberta na primeira importação e reencontrada nas
         * seguintes pela chave externa, e não pelo nome: nome é editável, e
         * quem renomeasse "Conta 1234" para "Nubank" ganharia uma conta nova a
         * cada sincronização.
         */
        let accounts = data.accounts
        /** Conta do produto para cada chave externa do lote importado. */
        const idPorChave = new Map<string, string>()

        for (const conta of account ?? []) {
          const existente = accounts.find((item) => item.sync?.itemId === conta.externalKey)

          if (existente) {
            idPorChave.set(conta.externalKey, existente.id)
            accounts = accounts.map((item) =>
              item.id === existente.id
                ? {
                    ...item,
                    balanceCents: conta.balanceCents ?? item.balanceCents ?? null,
                    balanceUpdatedAt: conta.balanceCents == null ? item.balanceUpdatedAt : now,
                    brand: conta.brand ?? item.brand ?? null,
                    institution: conta.institution ?? item.institution ?? null,
                    sync: { ...item.sync!, lastSyncedAt: now },
                  }
                : item,
            )
          } else {
            const novo = createId('acc')
            idPorChave.set(conta.externalKey, novo)
            accounts = [
              ...accounts,
              {
                id: novo,
                name: conta.name,
                kind: conta.kind,
                institution: conta.institution ?? null,
                last4: conta.number?.slice(-4) ?? null,
                creditCard: null,
                brand: conta.brand ?? null,
                balanceCents: conta.balanceCents ?? null,
                balanceUpdatedAt: conta.balanceCents == null ? null : now,
                sync: { provider: conta.provider, itemId: conta.externalKey, lastSyncedAt: now },
                archived: false,
                createdAt: now,
              },
            ]
          }
        }

        /*
         * As chaves de agrupamento viram ids de série aqui.
         *
         * A detecção trabalha com chaves derivadas do texto ("parc:notebook:10")
         * porque precisa reconhecer que duas linhas são a mesma compra. Guardar
         * essa chave como `seriesId` faria o histórico depender do texto do
         * extrato: importar o mês seguinte com a descrição levemente diferente
         * abriria uma segunda série para a mesma compra. O id é gerado uma vez
         * por chave, e o texto fica para trás.
         */
        const seriesPorChave = new Map<string, string>()
        const idDaSerie = (chave: string) => {
          const existente = seriesPorChave.get(chave)
          if (existente) return existente
          const novo = createId('series')
          seriesPorChave.set(chave, novo)
          return novo
        }

        return {
          ...data,
          accounts,
          transactions: [
            ...data.transactions,
            ...drafts.map((draft) =>
              normalizeTransaction({
                kind: draft.kind,
                amountCents: draft.amountCents,
                categoryId: draft.categoryId,
                description: draft.description,
                date: draft.date,
                goalId: draft.goalId ?? null,
                accountId:
                  draft.accountId ?? (draft.accountKey ? (idPorChave.get(draft.accountKey) ?? null) : null),
                source: 'imported',
                externalId: draft.externalId ?? null,
                notes: draft.notes ?? null,
                seriesId: draft.seriesId ? idDaSerie(draft.seriesId) : null,
                seriesKind: draft.seriesKind ?? null,
                installment: draft.installment ?? null,
                id: createId('tx'),
                createdAt: now,
                updatedAt: now,
              }),
            ),
          ],
        }
      }),

    /*
     * Corrige valor e tipo de lançamentos já importados, quando a origem passa
     * a dizer outra coisa sobre eles. Não toca em categoria, descrição nem
     * conta: essas a pessoa pode ter ajustado à mão, e sobrescrevê-las
     * apagaria trabalho dela para consertar um erro que não era dela.
     */
    correctImported: (correcoes) =>
      mutate((data) => {
        const now = Date.now()
        const porId = new Map(correcoes.map((item) => [item.id, item]))

        return {
          ...data,
          transactions: data.transactions.map((transaction) => {
            const correcao = porId.get(transaction.id)
            if (!correcao) return transaction

            return normalizeTransaction({
              ...transaction,
              kind: correcao.kind,
              amountCents: correcao.amountCents,
              updatedAt: now,
            })
          }),
        }
      }),

    /*
     * Troca a categoria de vários lançamentos de uma vez. Não valida se cabe:
     * quem monta a lista já resolveu isso, e repetir a regra aqui criaria uma
     * segunda cópia dela para divergir depois.
     */
    recategorize: (mudancas) =>
      mutate((data) => {
        const now = Date.now()
        const porId = new Map(mudancas.map((item) => [item.id, item.categoryId]))

        return {
          ...data,
          transactions: data.transactions.map((transaction) => {
            const categoryId = porId.get(transaction.id)
            if (!categoryId) return transaction

            return normalizeTransaction({ ...transaction, categoryId, updatedAt: now })
          }),
        }
      }),

    applySeriesPlans: (plans) =>
      mutate((data) => {
        const now = Date.now()
        const porTransacao = new Map<
          string,
          { seriesId: string; kind: 'installment' | 'subscription'; label: string; index?: { index: number; total: number } }
        >()

        for (const plano of plans) {
          const seriesId = createId('series')
          for (const transactionId of plano.transactionIds) {
            porTransacao.set(transactionId, {
              seriesId,
              kind: plano.kind,
              label: plano.label,
              index: plano.indexById[transactionId],
            })
          }
        }

        return {
          ...data,
          transactions: data.transactions.map((transaction) => {
            const plano = porTransacao.get(transaction.id)
            if (!plano) return transaction

            return {
              ...transaction,
              // A descrição perde o "(3/10)", que passa a viver no campo
              // próprio: repetido nos dois, a tela de Parcelamentos escreveria
              // a mesma coisa duas vezes na mesma linha.
              description: plano.index ? plano.label : transaction.description,
              seriesId: plano.seriesId,
              seriesKind: plano.kind,
              /*
               * Um plano de assinatura não traz posição, e isso não é motivo
               * para apagar a que já existe: o "3 de 8" é o que o banco
               * declarou sobre o lançamento, e nenhuma classificação nossa por
               * cima o torna falso. Apagá-lo destruía a única evidência que
               * permite reconhecer o parcelamento de novo depois.
               */
              installment: plano.index ?? transaction.installment ?? null,
              updatedAt: now,
            }
          }),
        }
      }),

    updateTransaction: (id, patch) =>
      mutate((data) => ({
        ...data,
        transactions: data.transactions.map((transaction) =>
          transaction.id === id
            ? normalizeTransaction({ ...transaction, ...patch, updatedAt: Date.now() })
            : transaction,
        ),
      })),

    deleteTransaction: (id) =>
      mutate((data) => ({
        ...data,
        transactions: data.transactions.filter((transaction) => transaction.id !== id),
      })),

    deleteSeries: (seriesId) =>
      mutate((data) => ({
        ...data,
        transactions: data.transactions.filter((transaction) => transaction.seriesId !== seriesId),
      })),

    /*
     * Desfaz a série e mantém os lançamentos.
     *
     * É o que existe para quando o reconhecimento erra. Nenhuma regra separa
     * com certeza uma academia cobrada todo dia 10 de uma assinatura: as duas
     * têm dia fixo, valor fixo e um mês de distância. Quando a máquina não
     * consegue decidir, quem decide é quem gastou — e a correção precisa ser
     * possível sem custar o histórico.
     *
     * Apagar seria a saída errada. As compras aconteceram, entraram no
     * orçamento e no total do mês; o que estava errado era o parentesco entre
     * elas, e é só isso que sai.
     *
     * **`installment` fica.** O "3 de 8" não é parentesco, é o que o banco
     * declarou sobre aquele lançamento — apagá-lo destrói um dado que não tem
     * como ser recalculado, só reimportado. Foi o que aconteceu na primeira
     * versão disto, e o efeito foi parcelamento voltando como assinatura.
     */
    ungroupSeries: (seriesId) =>
      mutate((data) => ({
        ...data,
        transactions: data.transactions.map((transaction) =>
          transaction.seriesId === seriesId
            ? { ...transaction, seriesId: null, seriesKind: null }
            : transaction,
        ),
      })),

    /*
     * Solta tudo que a importação agrupou, para o reconhecimento correr de novo.
     *
     * A regra de detecção melhora com o tempo, e melhorar não alcançava nada:
     * `planSeriesForHistory` só olha lançamento **sem** série, então o que foi
     * agrupado errado por uma versão antiga ficava congelado para sempre. Uma
     * academia classificada como assinatura em maio continuava assinatura em
     * agosto, com a régua nova em vigor e sem nunca ser reexaminada.
     *
     * **Série feita à mão não entra.** Quem marcou "Repetir lançamento" já
     * respondeu essa pergunta, e desfazer por cima trocaria uma decisão
     * explícita por um palpite. O corte é por origem: só solta a série cujas
     * ocorrências vieram todas de importação.
     */
    /*
     * Passa a série para compra parcelada, com o total que a pessoa informa.
     *
     * O total precisa vir de fora porque não existe em lugar nenhum: quando o
     * banco declara "3 de 8" a detecção já acerta sozinha e ninguém chega
     * aqui; quando ele não declara — e vários não declaram para compra no
     * débito, ou depois que a informação se perdeu — não há como deduzir se
     * três cobranças de mesmo valor são um terço de uma compra em nove vezes
     * ou uma assinatura de três meses. Quem comprou sabe, e é a única fonte.
     *
     * As posições saem da ordem das datas, e o total nunca fica abaixo do que
     * já existe: uma compra não pode ter menos parcelas que as já lançadas.
     */
    convertToInstallment: (seriesId, total) =>
      mutate((data) => {
        const now = Date.now()
        const daSerie = data.transactions
          .filter((transaction) => transaction.seriesId === seriesId)
          .sort((a, b) => (a.date < b.date ? -1 : 1))

        const posicao = new Map(daSerie.map((transaction, i) => [transaction.id, i + 1]))
        const totalFinal = Math.max(total, daSerie.length)

        return {
          ...data,
          transactions: data.transactions.map((transaction) => {
            const index = posicao.get(transaction.id)
            if (!index) return transaction

            return {
              ...transaction,
              seriesKind: 'installment' as const,
              installment: { index, total: totalFinal },
              updatedAt: now,
            }
          }),
        }
      }),

    ungroupImportedSeries: () =>
      mutate((data) => {
        const daImportacao = new Set<string>()
        const daMao = new Set<string>()

        for (const transaction of data.transactions) {
          if (!transaction.seriesId) continue
          const destino = transaction.source === 'imported' ? daImportacao : daMao
          destino.add(transaction.seriesId)
        }

        return {
          ...data,
          transactions: data.transactions.map((transaction) =>
            transaction.seriesId &&
            daImportacao.has(transaction.seriesId) &&
            !daMao.has(transaction.seriesId)
              ? { ...transaction, seriesId: null, seriesKind: null }
              : transaction,
          ),
        }
      }),

    addGoal: (goal) =>
      mutate((data) => ({
        ...data,
        goals: [
          ...data.goals,
          { ...goal, id: createId('goal'), archived: false, createdAt: Date.now() },
        ],
      })),

    updateGoal: (id, patch) =>
      mutate((data) => ({
        ...data,
        goals: data.goals.map((goal) => (goal.id === id ? { ...goal, ...patch } : goal)),
      })),

    /**
     * Excluir uma meta também remove os aportes feitos para ela. O aporte não
     * tem significado sem o destino, e mantê-lo órfão deixaria o saldo do mês
     * menor sem nenhuma linha que explicasse o porquê.
     */
    deleteGoal: (id) =>
      mutate((data) => ({
        ...data,
        goals: data.goals.filter((goal) => goal.id !== id),
        transactions: data.transactions.filter(
          (transaction) => !(transaction.kind === 'contribution' && transaction.goalId === id),
        ),
      })),

    setBudget: (month, categoryId, limitCents) =>
      mutate((data) => {
        const monthBudgets = { ...(data.budgets[month] ?? {}) }
        if (limitCents > 0) monthBudgets[categoryId] = limitCents
        else delete monthBudgets[categoryId]

        const budgets = { ...data.budgets }
        if (Object.keys(monthBudgets).length > 0) budgets[month] = monthBudgets
        else delete budgets[month]

        return { ...data, budgets }
      }),

    copyBudgetsFromPreviousMonth: (month) =>
      mutate((data) => {
        const previous = data.budgets[shiftMonth(month, -1)]
        if (!previous || Object.keys(previous).length === 0) return data
        return { ...data, budgets: { ...data.budgets, [month]: { ...previous } } }
      }),

    addAccount: (account) =>
      mutate((data) => ({
        ...data,
        accounts: [
          ...data.accounts,
          { ...account, id: createId('acc'), archived: false, createdAt: Date.now() },
        ],
      })),

    /**
     * Guarda a autorização que o widget do agregador acabou de devolver.
     *
     * Idempotente pelo `itemId`: reconectar a mesma instituição devolve o
     * mesmo identificador, e duas linhas iguais fariam a importação futura
     * pedir os mesmos lançamentos duas vezes. Quando já existe, o registro é
     * mantido com a data original — reconectar renova o consentimento no
     * banco, não cria uma conexão nova.
     */
    registerBankConnection: (provider, itemId) =>
      mutate((data) => {
        if (data.connections.some((item) => item.itemId === itemId)) return data
        return {
          ...data,
          connections: [
            ...data.connections,
            { provider, itemId, connectedAt: Date.now(), lastSyncedAt: null },
          ],
        }
      }),

    removeBankConnection: (itemId) =>
      mutate((data) => ({
        ...data,
        connections: data.connections.filter((item) => item.itemId !== itemId),
        /*
         * As contas que vieram dessa autorização perdem o vínculo, mas não são
         * apagadas: os lançamentos já importados continuam sendo movimentação
         * real do usuário, e sumir com a conta deixaria cada um deles órfão. A
         * conta volta a ser o que uma conta cadastrada à mão é.
         */
        accounts: data.accounts.map((account) =>
          account.sync?.itemId === itemId ? { ...account, sync: null } : account,
        ),
      })),

    updateAccount: (id, patch) =>
      mutate((data) => ({
        ...data,
        accounts: data.accounts.map((account) =>
          account.id === id ? { ...account, ...patch } : account,
        ),
      })),

    /** Remover uma conta desvincula os lançamentos, mas não os apaga. */
    deleteAccount: (id) =>
      mutate((data) => ({
        ...data,
        accounts: data.accounts.filter((account) => account.id !== id),
        transactions: data.transactions.map((transaction) =>
          transaction.accountId === id ? { ...transaction, accountId: null } : transaction,
        ),
      })),

    replaceAll: (data) => mutate(() => data),

    /**
     * Os dados de exemplo trocam lançamentos, metas e contas — não a pessoa.
     *
     * `createDemoData()` devolve um perfil zerado junto, e usá-lo direto em
     * `replaceAll` apagava o nome cadastrado. Desde que existe o tour de
     * boas-vindas isso ficou pior que um incômodo: zerar o perfil zera também
     * `onboardedAt`, e a apresentação recomeçaria do zero logo depois de a
     * pessoa ter carregado a demonstração.
     */
    loadDemoData: (demo) =>
      mutate((data) => ({ ...demo, profile: data.profile, settings: data.settings })),

    clearAll: () =>
      mutate((data) => ({
        ...createEmptyData(),
        // A preferência visual não é um dado financeiro; zerar a base não
        // deveria devolver o usuário ao tema errado.
        settings: { ...createEmptyData().settings, theme: data.settings.theme },
      })),
  }
})

/** Garante as invariantes que o tipo sozinho não expressa. */
function normalizeTransaction(transaction: Transaction): Transaction {
  if (transaction.kind === 'contribution') {
    return { ...transaction, categoryId: CONTRIBUTION_CATEGORY_ID }
  }
  return { ...transaction, goalId: null }
}

/**
 * Converte um lançamento recorrente nas N ocorrências que ele representa.
 *
 * As parcelas são materializadas no momento do cadastro, e não calculadas na
 * leitura, porque uma parcela precisa poder ser editada ou excluída
 * individualmente — o valor da conta de luz muda todo mês.
 */
function expandRecurrence(
  draft: TransactionDraft,
  recurrence: RecurrenceDraft | null | undefined,
): Transaction[] {
  const now = Date.now()
  const base: Omit<Transaction, 'id' | 'date' | 'description' | 'installment' | 'seriesId'> = {
    kind: draft.kind,
    amountCents: draft.amountCents,
    categoryId: draft.categoryId,
    goalId: draft.goalId ?? null,
    accountId: draft.accountId ?? null,
    source: draft.source ?? 'manual',
    externalId: draft.externalId ?? null,
    notes: draft.notes ?? null,
    createdAt: now,
    updatedAt: now,
  }

  const occurrences = recurrence ? Math.max(1, Math.min(recurrence.occurrences, 120)) : 1

  if (!recurrence || occurrences === 1) {
    return [
      normalizeTransaction({
        ...base,
        id: createId('tx'),
        date: draft.date,
        description: draft.description,
        installment: null,
        seriesId: null,
      }),
    ]
  }

  const seriesId = createId('series')
  const unit = recurrence.frequency === 'weekly' ? 'week' : recurrence.frequency === 'yearly' ? 'year' : 'month'
  const parcelado = recurrence.kind === 'installment'

  return Array.from({ length: occurrences }, (_, index) =>
    normalizeTransaction({
      ...base,
      id: createId('tx'),
      date: shiftDate(draft.date, index, unit),
      /*
       * O "(3/12)" é da compra parcelada, onde a posição é informação: falta
       * saber quanto ainda vem. Numa assinatura ele seria ruído — ninguém
       * chama o serviço de "Streaming (3/12)", e a contagem só existe porque
       * a série precisa acabar em algum lugar.
       */
      description: parcelado ? `${draft.description} (${index + 1}/${occurrences})` : draft.description,
      installment: parcelado ? { index: index + 1, total: occurrences } : null,
      seriesId,
      seriesKind: recurrence.kind,
      source: 'recurring',
      createdAt: now + index,
      updatedAt: now + index,
    }),
  )
}
