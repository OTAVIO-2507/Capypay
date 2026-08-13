import { Icon } from '@/components/Icon'
import { useFinanceStore } from '@/store/financeStore'

/**
 * Sem servidor não existe "não salvou" silencioso — e num sistema sem cor de
 * alerta, o aviso se anuncia pelo bloco de tinta cheia, que é o evento mais
 * alto disponível.
 */
export function StorageWarning() {
  const loadError = useFinanceStore((state) => state.loadError)
  const saveError = useFinanceStore((state) => state.saveError)

  const message = loadError ?? saveError
  if (!message) return null

  return (
    <div
      role="alert"
      className="mb-5 flex items-start gap-3.5 rounded-md bg-block p-4 text-block-ink shadow-[var(--shadow-block)]"
    >
      <Icon name="triangle-alert" size={17} className="mt-0.5 shrink-0" />
      <div className="min-w-0">
        <p className="text-[0.8125rem] font-semibold">
          {loadError ? 'Não foi possível carregar seus dados' : 'Falha ao salvar'}
        </p>
        <p className="mt-1 text-xs leading-relaxed text-block-muted">{message}</p>
      </div>
    </div>
  )
}
