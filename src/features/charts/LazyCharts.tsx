import { lazy, Suspense, type ComponentProps } from 'react'

/**
 * Os dois gráficos que dependem do Recharts entram por importação dinâmica.
 *
 * A biblioteca responde por cerca de dois terços do JavaScript da aplicação, e
 * nada dela é necessário para pintar a primeira dobra: o cartão, a figura do
 * resultado, os orçamentos e a composição por categoria são HTML puro.
 * Separá-la deixa a abertura leve e paga o download quando o gráfico entra em
 * cena.
 */
const BalanceTrendImpl = lazy(() =>
  import('./BalanceTrend').then((module) => ({ default: module.BalanceTrend })),
)
const FlowChartImpl = lazy(() =>
  import('./FlowChart').then((module) => ({ default: module.FlowChart })),
)

/** Ocupa a mesma altura do gráfico, para a folha não saltar quando ele chega. */
function ChartSkeleton({ height }: { height: number }) {
  return (
    <div
      aria-hidden="true"
      className="w-full animate-pulse rounded-md bg-sunken"
      style={{ height }}
    />
  )
}

export function BalanceTrend(props: ComponentProps<typeof BalanceTrendImpl>) {
  return (
    <Suspense fallback={<ChartSkeleton height={252} />}>
      <BalanceTrendImpl {...props} />
    </Suspense>
  )
}

export function FlowChart(props: ComponentProps<typeof FlowChartImpl>) {
  return (
    <Suspense fallback={<ChartSkeleton height={246} />}>
      <FlowChartImpl {...props} />
    </Suspense>
  )
}
