import {
  Area,
  AreaChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  YAxis,
} from 'recharts'
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/cn'
import { formatMonthLong, formatMonthShort, monthsOfYear, type MonthKey } from '@/lib/date'
import type { Cents } from '@/lib/money'
import { ChartTooltipBody } from './ChartTooltip'
import { useChartTheme } from './useChartTheme'

interface BalanceTrendProps {
  year: number
  data: { month: MonthKey; net: Cents }[]
  /** Mês em foco: recebe a linha de rastreamento e a pílula preenchida. */
  selectedMonth: MonthKey
  onSelectMonth: (month: MonthKey) => void
  onChangeYear: (year: number) => void
}

/**
 * A curva do ano, com o mês em foco marcado por uma linha vertical.
 *
 * Área e não colunas porque a pergunta aqui é de forma — "está subindo ou
 * caindo" — e não de comparação item a item. O preenchimento é degradê de
 * **opacidade**, nunca de matiz: num sistema sem cor, o degradê de tinta é a
 * única gradação permitida, e ela existe para a curva não parecer um bloco.
 *
 * As pílulas de mês abaixo do gráfico não são só eixo: clicar nelas muda o mês
 * que governa a rota inteira, o que faz do gráfico um controle e não uma
 * ilustração.
 */
export function BalanceTrend({
  year,
  data,
  selectedMonth,
  onSelectMonth,
  onChangeYear,
}: BalanceTrendProps) {
  const theme = useChartTheme()
  const currentYear = new Date().getFullYear()
  const hasData = data.some((point) => point.net !== 0)
  const selected = data.find((point) => point.month === selectedMonth)

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-xs text-muted">
          {hasData ? 'Quanto sobrou em cada mês' : `Sem movimento registrado em ${year}`}
        </p>
        <div className="inline-flex items-center gap-1 rounded-full bg-sunken p-1">
          <button
            type="button"
            onClick={() => onChangeYear(year - 1)}
            aria-label={`Ano anterior, ${year - 1}`}
            className="inline-flex size-7 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-sheet hover:text-ink"
          >
            <Icon name="chevron-left" size={14} />
          </button>
          <span className="tnum px-1.5 text-xs font-semibold text-ink">{year}</span>
          <button
            type="button"
            onClick={() => onChangeYear(year + 1)}
            disabled={year >= currentYear}
            aria-label={`Próximo ano, ${year + 1}`}
            className="inline-flex size-7 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-sheet hover:text-ink disabled:pointer-events-none disabled:opacity-35"
          >
            <Icon name="chevron-right" size={14} />
          </button>
        </div>
      </div>

      <div className="h-[190px] w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 4, bottom: 0, left: 4 }}>
            <defs>
              <linearGradient id="trend-fill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={theme.series1} stopOpacity={0.16} />
                <stop offset="100%" stopColor={theme.series1} stopOpacity={0} />
              </linearGradient>
            </defs>

            <YAxis hide domain={['dataMin', 'dataMax']} />
            <ReferenceLine y={0} stroke={theme.grid} />

            {selected ? (
              <>
                <ReferenceLine x={selectedMonth} stroke={theme.axis} strokeDasharray="3 3" />
                <ReferenceDot
                  x={selectedMonth}
                  y={selected.net}
                  r={5}
                  fill={theme.series1}
                  // Anel na cor da folha: mantém o ponto legível onde ele
                  // cruza a própria linha.
                  stroke={theme.sheet}
                  strokeWidth={3}
                />
              </>
            ) : null}

            <Tooltip
              cursor={false}
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null
                const value = Number(payload[0]?.value ?? 0)
                /*
                 * O mês vem do dado, não do `label` do Recharts.
                 *
                 * Este gráfico não declara `XAxis dataKey` — o eixo dele são as
                 * pílulas de mês em HTML, embaixo. Sem `dataKey`, o `label` que
                 * o Recharts entrega é o **índice** do ponto, e formatá-lo como
                 * mês devolvia "Data inválida" em todo tooltip.
                 */
                const month = (payload[0]?.payload as { month?: string } | undefined)?.month ?? ''
                return (
                  <ChartTooltipBody
                    title={formatMonthLong(month)}
                    // Série única: sem bolinha. O título já diz o que é, e um
                    // balão com uma só cor não tem identidade para carregar.
                    rows={[{ label: value < 0 ? 'Ficou negativo' : 'Sobrou', value }]}
                  />
                )
              }}
            />

            <Area
              type="monotone"
              dataKey="net"
              stroke={theme.series1}
              strokeWidth={2}
              strokeLinecap="round"
              fill="url(#trend-fill)"
              // O ponto só aparece sob o cursor; um marcador em cada mês
              // transformaria a curva numa fileira de bolinhas.
              dot={false}
              activeDot={{ r: 4, fill: theme.series1, stroke: theme.sheet, strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <MonthPills
        year={year}
        data={data}
        selectedMonth={selectedMonth}
        onSelectMonth={onSelectMonth}
      />
    </div>
  )
}

function MonthPills({
  year,
  data,
  selectedMonth,
  onSelectMonth,
}: {
  year: number
  data: { month: MonthKey; net: Cents }[]
  selectedMonth: MonthKey
  onSelectMonth: (month: MonthKey) => void
}) {
  const byMonth = new Map(data.map((point) => [point.month, point.net]))

  return (
    <ul className="mt-3 flex items-center justify-between gap-0.5">
      {monthsOfYear(year).map((month) => {
        const selected = month === selectedMonth
        const empty = (byMonth.get(month) ?? 0) === 0

        return (
          <li key={month} className="min-w-0 flex-1">
            <button
              type="button"
              onClick={() => onSelectMonth(month)}
              aria-current={selected ? 'true' : undefined}
              aria-label={formatMonthLong(month)}
              className={cn(
                'w-full rounded-full py-1.5 text-center text-xs font-medium transition-colors duration-150',
                selected
                  ? 'bg-block text-block-ink'
                  : empty
                    ? 'text-faint hover:bg-sunken hover:text-muted'
                    : 'text-muted hover:bg-sunken hover:text-ink',
              )}
            >
              {formatMonthShort(month)}
            </button>
          </li>
        )
      })}
    </ul>
  )
}
