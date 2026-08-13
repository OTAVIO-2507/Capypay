import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { FlowIndicator } from '@/components/ui/Money'
import { EmptyState } from '@/components/ui/EmptyState'
import type { MonthlyFlowPoint } from '@/domain/selectors'
import { cn } from '@/lib/cn'
import { formatCurrencyCompact } from '@/lib/format'
import { formatMonthLong, formatMonthShort } from '@/lib/date'
import { usePrivacy } from '@/store/hooks'
import { ChartTooltipBody } from './ChartTooltip'
import { useChartTheme } from './useChartTheme'

interface FlowChartProps {
  data: MonthlyFlowPoint[]
  className?: string
}

const SERIES = [
  { key: 'income', label: 'Receitas', token: 'income' },
  { key: 'expense', label: 'Despesas', token: 'expense' },
  { key: 'contribution', label: 'Aportes', token: 'contribution' },
] as const

/**
 * Fluxo dos últimos seis meses em colunas agrupadas.
 *
 * As três séries vestem a identidade de fluxo — a segunda exceção de cor do
 * sistema, fixa e nunca escolhida (ver DESIGN.md, "As Duas Exceções de
 * Cor"). Antes eram uma rampa ordinal monocromática; a cor aqui substitui
 * o degrau de luminosidade pelo mesmo matiz que a Figura, o ícone da lista de
 * lançamentos e o resumo do período já usam para a mesma categoria — o
 * gráfico deixa de ser o único lugar sem essa pista.
 *
 * Como a identidade é o único canal de cor que sobra, a legenda é obrigatória
 * e o gráfico nunca passa de três séries — a quarta não teria matiz fixo
 * validado para vestir.
 */
export function FlowChart({ data, className }: FlowChartProps) {
  const theme = useChartTheme()
  const masked = usePrivacy()
  const hasData = data.some((point) => point.income + point.expense + point.contribution > 0)

  if (!hasData) {
    return (
      <EmptyState
        icon="chart-column"
        size="sm"
        title="Ainda não há meses para comparar"
        description="Com dois ou mais meses de lançamentos, este gráfico mostra se o que entra está acompanhando o que sai."
      />
    )
  }

  const cores: Record<string, string> = {
    income: theme.income,
    expense: theme.expense,
    contribution: theme.contribution,
  }

  return (
    <div className={cn('flex flex-col', className)}>
      <ul className="mb-5 flex flex-wrap items-center gap-x-5 gap-y-2">
        {SERIES.map((series) => (
          <li key={series.key} className="flex items-center gap-2 text-xs text-muted">
            {/*
              A mesma seta da lista de lançamentos e do resumo do período —
              um vocabulário de marca só, em vez de um por lugar.
            */}
            <FlowIndicator tone={series.token} />
            {series.label}
          </li>
        ))}
      </ul>

      {/* Altura mínima, mas cresce com a folha para fechar a coluna. */}
      <div className="min-h-[210px] w-full flex-1">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: -10 }} barGap={3}>
            <CartesianGrid stroke={theme.grid} vertical={false} />
            <XAxis
              dataKey="month"
              tickFormatter={formatMonthShort}
              tickLine={false}
              axisLine={false}
              tick={{ fill: theme.axis, fontSize: 11 }}
              dy={6}
            />
            <YAxis
              tickFormatter={(value: number) =>
                masked ? '••' : formatCurrencyCompact(value).replace('R$', '').trim()
              }
              tickLine={false}
              axisLine={false}
              tick={{ fill: theme.axis, fontSize: 11 }}
              width={56}
            />
            <Tooltip
              cursor={{ fill: theme.grid, opacity: 0.5 }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null
                return (
                  <ChartTooltipBody
                    title={formatMonthLong(String(label))}
                    rows={SERIES.map((series) => ({
                      label: series.label,
                      value: Number(
                        payload.find((entry) => entry.dataKey === series.key)?.value ?? 0,
                      ),
                      tone: series.token,
                    }))}
                  />
                )
              }}
            />
            {SERIES.map((series) => (
              <Bar
                key={series.key}
                dataKey={series.key}
                name={series.label}
                fill={cores[series.token]}
                // Topo arredondado, base quadrada: a coluna nasce da linha de
                // base e não deve parecer flutuar sobre ela.
                radius={[4, 4, 0, 0]}
                maxBarSize={16}
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
