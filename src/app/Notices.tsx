import { Icon } from '@/components/Icon'
import { useFinanceStore } from '@/store/financeStore'

/**
 * Uma falha de sincronia não pode passar em silêncio: o dado que a pessoa
 * acabou de digitar pode não existir em lugar nenhum.
 *
 * O aviso se anunciava pelo bloco de tinta cheia, porque não havia cor de
 * alerta no sistema. Agora há, e ele é uma faixa tingida de despesa — mesmo
 * tratamento do `NoticePanel`. A inversão saiu porque, em fundo preto, ela
 * virou uma faixa branca: chamativa, mas sem dizer de que tipo é o evento.
 */
export function StorageWarning() {
  const loadError = useFinanceStore((state) => state.loadError)
  const saveError = useFinanceStore((state) => state.saveError)

  const message = loadError ?? saveError
  if (!message) return null

  return (
    <div
      role="alert"
      className="mb-5 flex items-start gap-3.5 rounded-md border border-expense/25 bg-expense/10 p-4 text-expense"
    >
      <Icon name="triangle-alert" size={17} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[0.8125rem] font-semibold">
          {loadError ? 'Não foi possível carregar seus dados' : 'Falha ao salvar'}
        </p>
        {/*
          O corpo fica em tinta, não na cor do estado. A mensagem costuma ser
          técnica e longa, e um parágrafo inteiro em vermelho cansa de ler —
          quem carrega o estado é o título e o ícone.
        */}
        <p className="mt-1 text-xs leading-relaxed text-muted">{message}</p>
      </div>
    </div>
  )
}
