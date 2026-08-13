import type { ReactNode } from 'react'
import { MonthPicker } from '@/components/MonthPicker'
import { cn } from '@/lib/cn'
import { useFinanceStore } from '@/store/financeStore'
import { useSelectedMonth } from '@/store/hooks'

interface PageHeaderProps {
  title: string
  description?: string
  /** Linha acima do título. */
  eyebrow?: ReactNode
  /** Título em corpo maior, para a tela de entrada. */
  large?: boolean
  /** Elemento à esquerda do título. Usado pelo avatar no painel. */
  leading?: ReactNode
  /** Exibe o seletor global de mês. Rotas sem recorte mensal o omitem. */
  showMonth?: boolean
  actions?: ReactNode
}

/**
 * Cabeçalho de rota. Os controles globais (privacidade, tema) vivem na barra
 * do shell, não aqui — repetir chrome global em cada rota é ruído.
 */
export function PageHeader({
  title,
  description,
  eyebrow,
  large = false,
  leading,
  showMonth = false,
  actions,
}: PageHeaderProps) {
  return (
    /*
     * Título à esquerda, controles à direita, na mesma faixa.
     *
     * Empilhados, os controles ganhavam uma faixa própria e o lado direito do
     * título ficava vazio — duas ausências pelo preço de uma. Lado a lado, o
     * espaço que sobrava vira o lugar deles, e o cabeçalho ocupa metade da
     * altura. Só quebra em duas linhas quando a largura não dá conta.
     */
    <header className="mb-6 flex flex-wrap items-center justify-between gap-x-8 gap-y-4">
      <div className="flex min-w-0 items-center gap-4">
        {leading}
        <div className="min-w-0">
          {eyebrow ? <div className="mb-1.5">{eyebrow}</div> : null}
          <h1
            className={cn(
              'font-semibold tracking-[-0.025em] text-ink',
              // O painel abre com a saudação no lugar do título, e ela merece o
              // corpo maior: é a primeira linha que a pessoa lê no dia.
              large ? 'text-[1.75rem] tracking-[-0.03em]' : 'text-[1.375rem]',
            )}
          >
            {title}
          </h1>
          {description ? <p className="mt-1 text-[0.8125rem] text-muted">{description}</p> : null}
        </div>
      </div>

      {(showMonth || actions) && (
        <div className="flex flex-wrap items-center gap-2.5">
          {showMonth ? <MonthPickerField /> : null}
          {actions}
        </div>
      )}
    </header>
  )
}

/**
 * Isolado do corpo de `PageHeader` para que só rotas com `showMonth` toquem
 * a `financeStore` — as páginas de admin reaproveitam o cabeçalho sem
 * carregar (nem depender de) nenhum dado financeiro.
 */
function MonthPickerField() {
  const month = useSelectedMonth()
  const setMonth = useFinanceStore((state) => state.setSelectedMonth)
  return <MonthPicker value={month} onChange={setMonth} />
}
