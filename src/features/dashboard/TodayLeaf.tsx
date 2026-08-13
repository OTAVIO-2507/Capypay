import { formatDayNumber, formatFullDate, formatWeekdayShort, type IsoDate } from '@/lib/date'

/**
 * O dia de hoje, em folha de calendário, ao lado da saudação.
 *
 * Este lugar já teve o avatar, e o avatar já vive na barra de topo — a mesma
 * marca duas vezes na mesma tela não acrescenta nada, só ocupa. A data não
 * aparece em nenhum outro lugar do painel e é o único dado da tela que muda
 * todo dia, o que faz dela a coisa certa para abrir.
 *
 * É papel sobre papel, não bloco de tinta: a cota de tinta da tela já está
 * gasta na barra lateral e no cartão, e uma terceira mancha escura no topo
 * puxaria o peso todo para o canto esquerdo.
 */
export function TodayLeaf({ date }: { date: IsoDate }) {
  return (
    <div
      role="img"
      aria-label={`Hoje, ${formatFullDate(date)}`}
      className="flex size-[52px] shrink-0 flex-col items-center justify-center rounded-sm bg-sunken"
    >
      <span className="text-[0.625rem] font-medium leading-none text-muted">
        {formatWeekdayShort(date)}
      </span>
      <span className="tnum mt-1 font-mono text-lg font-semibold leading-none text-ink">
        {formatDayNumber(date)}
      </span>
    </div>
  )
}
