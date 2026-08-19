import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceDot,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { SpendingPace } from '@/domain/selectors'
import { formatCurrencyCompact } from '@/lib/format'
import { usePrivacy } from '@/store/hooks'
import { ChartTooltipBody } from './ChartTooltip'
import { useChartTheme } from './useChartTheme'

/**
 * O ritmo de gastos: quanto já saiu neste mês, dia a dia, contra o mês anterior.
 *
 * Substitui a curva do ano no painel porque responde outra pergunta, e uma que
 * ainda dá para agir sobre. O resultado fechado de cada mês só fica pronto no
 * dia 31, quando não há mais decisão a tomar; duas linhas subindo lado a lado
 * mostram no dia 10 que este mês está mais caro que o passado, que é quando a
 * informação ainda vale alguma coisa.
 *
 * **A linha do mês em curso para no dia de hoje.** Levá-la até o fim do mês
 * desenharia uma reta horizontal nos dias que ainda não aconteceram, e reta
 * horizontal num gráfico de acumulado lê como "não gastei nada", que é uma
 * afirmação sobre o futuro.
 *
 * O mês anterior vai tracejado e em tinta apagada: ele é régua, não assunto. Se
 * as duas linhas tivessem o mesmo peso, a leitura viraria "comparar duas
 * curvas" em vez de "onde eu estou em relação à régua".
 */
export function SpendingPaceChart({ pace }: { pace: SpendingPace }) {
  const theme = useChartTheme()
  const masked = usePrivacy()

  const ultimo = pace.points.find((ponto) => ponto.day === pace.dayCursor)
  const diasNoMes = pace.points.length

  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={pace.points} margin={{ top: 8, right: 8, bottom: 0, left: -8 }}>
          <CartesianGrid stroke={theme.grid} strokeDasharray="3 3" vertical={false} />

          <XAxis
            dataKey="day"
            tickLine={false}
            axisLine={false}
            tick={{ fill: theme.axis, fontSize: 11 }}
            /*
             * Só as marcas que servem de referência no calendário. Trinta e um
             * números na régua viram uma faixa cinza ilegível, e ninguém
             * procura o dia 17 num eixo: procura "meio do mês".
             */
            ticks={[1, 10, 20, diasNoMes]}
          />
          <YAxis
            tickLine={false}
            axisLine={false}
            width={56}
            tick={{ fill: theme.axis, fontSize: 11 }}
            tickFormatter={(valor: number) =>
              masked ? '••' : formatCurrencyCompact(valor).replace('R$', '').trim()
            }
          />

          <Tooltip
            cursor={{ stroke: theme.grid, strokeWidth: 1 }}
            content={({ active, payload, label }) => {
              if (!active || !payload?.length) return null

              return (
                <ChartTooltipBody
                  title={`Dia ${String(label)}`}
                  rows={payload
                    .filter((item) => item.value != null)
                    .map((item) => ({
                      label: item.dataKey === 'current' ? 'Este mês' : 'Mês passado',
                      value: Number(item.value),
                    }))}
                />
              )
            }}
          />

          <Line
            type="monotone"
            dataKey="previous"
            stroke={theme.axis}
            strokeWidth={1.5}
            strokeDasharray="4 4"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="current"
            stroke={theme.ink}
            strokeWidth={2}
            dot={false}
            /* `connectNulls` desligado é o que faz a linha parar em hoje. */
            connectNulls={false}
            isAnimationActive={false}
          />

          {/*
            O ponto marca onde o mês está agora. Sem ele, o fim da linha se
            confunde com o fim do gráfico, e some justamente a informação de
            que dali para frente ainda não há resposta.
          */}
          {ultimo?.current != null ? (
            <ReferenceDot
              x={ultimo.day}
              y={ultimo.current}
              r={4}
              fill={theme.ink}
              stroke={theme.sheet}
              strokeWidth={2}
            />
          ) : null}
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
