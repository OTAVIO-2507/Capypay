import { Icon } from '@/components/Icon'
import { cn } from '@/lib/cn'
import { currentMonth, formatMonthLong, shiftMonth, type MonthKey } from '@/lib/date'

interface MonthPickerProps {
  value: MonthKey
  onChange: (month: MonthKey) => void
  className?: string
}

/**
 * O seletor global de período.
 *
 * A versão anterior tinha três controles de mês espalhados — um no gráfico de
 * pizza, um no card de orçamento, um na tela de configuração — e eles podiam
 * discordar entre si, mostrando dois meses ao mesmo tempo sem avisar. Aqui
 * existe um controle, e ele governa a rota inteira.
 */
export function MonthPicker({ value, onChange, className }: MonthPickerProps) {
  const isCurrent = value === currentMonth()

  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 rounded-full border border-hairline bg-sheet p-1',
        className,
      )}
    >
      <button
        type="button"
        onClick={() => onChange(shiftMonth(value, -1))}
        aria-label={`Mês anterior, ${formatMonthLong(shiftMonth(value, -1))}`}
        className="inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-sunken hover:text-ink"
      >
        <Icon name="chevron-left" size={16} />
      </button>

      <div className="relative">
        <span
          aria-hidden="true"
          className="pointer-events-none block min-w-[9rem] px-2 text-center text-[0.8125rem] font-semibold whitespace-nowrap text-ink"
        >
          {formatMonthLong(value)}
        </span>
        {/*
          O input nativo de mês fica por cima, invisível: ele traz o calendário
          do sistema (e o teclado certo no celular) sem impor sua aparência.
        */}
        <input
          type="month"
          value={value}
          onChange={(event) => {
            if (event.target.value) onChange(event.target.value)
          }}
          aria-label="Selecionar mês"
          className="absolute inset-0 w-full cursor-pointer opacity-0"
        />
      </div>

      <button
        type="button"
        onClick={() => onChange(shiftMonth(value, 1))}
        aria-label={`Próximo mês, ${formatMonthLong(shiftMonth(value, 1))}`}
        className="inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-sunken hover:text-ink"
      >
        <Icon name="chevron-right" size={16} />
      </button>

      {!isCurrent ? (
        <button
          type="button"
          onClick={() => onChange(currentMonth())}
          className="ml-0.5 inline-flex h-9 items-center rounded-full bg-sunken px-3 text-xs font-semibold text-ink transition-colors duration-150 hover:bg-hairline"
        >
          Hoje
        </button>
      ) : null}
    </div>
  )
}
