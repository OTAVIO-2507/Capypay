import { Icon } from '@/components/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import { Money } from '@/components/ui/Money'
import type { CategorySpend } from '@/domain/selectors'
import { cn } from '@/lib/cn'
import { formatPercent } from '@/lib/format'
import { usePrivacy } from '@/store/hooks'

interface CategoryBreakdownProps {
  data: CategorySpend[]
  /**
   * Quantas barras aparecem. O que sobra vira uma linha de rodapé com o total,
   * nunca some calado: a soma das barras precisa poder ser conferida contra o
   * total de despesas do mês, e uma lista que esconde a cauda sem dizer quanto
   * ela vale quebra essa conta.
   */
  limit?: number
  className?: string
}

/**
 * Composição das despesas do mês, em barras ordenadas de tinta.
 *
 * Substitui a rosca multicolorida da versão original por dois motivos. O
 * primeiro é de leitura: comparar comprimento é mais fácil que comparar
 * ângulo, e a pergunta aqui é "qual categoria pesou mais". O segundo é que uma
 * rosca precisa de uma cor por fatia — e este sistema não tem cor nenhuma.
 *
 * Feito em HTML, e não no Recharts, porque rótulo longo em português
 * ("Alimentação", "Assinaturas") cabe sem truncar, a lista é navegável e o
 * leitor de tela recebe uma estrutura que faz sentido.
 */
export function CategoryBreakdown({ data, limit, className }: CategoryBreakdownProps) {
  const masked = usePrivacy()

  if (data.length === 0) {
    return (
      <EmptyState
        icon="chart-column"
        size="sm"
        title="Nenhuma despesa neste mês"
        description="Assim que você registrar uma saída, ela aparece aqui ordenada da categoria que mais pesou para a que menos pesou."
      />
    )
  }

  const largest = data[0].amount
  const visiveis = limit ? data.slice(0, limit) : data
  const cauda = data.slice(visiveis.length)
  const totalDaCauda = cauda.reduce((soma, item) => soma + item.amount, 0)

  return (
    // `justify-between` para as linhas se distribuírem quando o painel cresce
    // até a altura da coluna, em vez de amontoarem no topo com sobra embaixo.
    <ul className={cn('flex flex-col justify-between gap-4', className)}>
      {visiveis.map((item) => (
        <li key={item.categoryId}>
          <div className="mb-2 flex items-baseline justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2.5">
              <Icon name={item.icon} size={15} className="shrink-0 text-faint" />
              <span className="truncate text-[0.8125rem] font-medium text-ink">{item.label}</span>
            </span>
            <span className="flex shrink-0 items-baseline gap-2.5">
              <Money cents={item.amount} className="text-[0.8125rem]" />
              <span className="tnum w-9 text-right text-xs text-muted">
                {formatPercent(item.share, { masked })}
              </span>
            </span>
          </div>
          {/*
            A barra é proporcional à maior categoria, não ao total: com um
            gasto dominante, escalar pelo total achataria todo o resto em
            traços indistinguíveis.
          */}
          <div className="h-2 w-full overflow-hidden rounded-full bg-sunken">
            <div
              className="h-full rounded-full bg-ink transition-[width] duration-300"
              style={{ width: `${Math.max((item.amount / largest) * 100, 2)}%` }}
            />
          </div>
        </li>
      ))}

      {cauda.length > 0 ? (
        <li className="flex items-baseline justify-between gap-3 border-t border-hairline pt-3 text-xs text-muted">
          <span>
            +{cauda.length} {cauda.length === 1 ? 'categoria' : 'categorias'}
          </span>
          <Money cents={totalDaCauda} className="text-xs text-muted" />
        </li>
      ) : null}
    </ul>
  )
}
