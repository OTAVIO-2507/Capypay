import { Icon } from '@/components/Icon'
import { EmptyState } from '@/components/ui/EmptyState'
import { DeltaBadge, Money } from '@/components/ui/Money'
import { categoryColor } from '@/domain/categories'
import type { CategoryComparison } from '@/domain/selectors'
import { cn } from '@/lib/cn'

interface CategoryBreakdownProps {
  data: CategoryComparison[]
  /**
   * Quantas linhas aparecem. O que sobra vira uma linha de rodapé com o total,
   * nunca some calado: a soma das linhas precisa poder ser conferida contra o
   * total de despesas do mês, e uma lista que esconde a cauda sem dizer quanto
   * ela vale quebra essa conta.
   */
  limit?: number
  className?: string
}

/**
 * "Principais categorias": onde o dinheiro foi, e o que mudou desde o mês
 * passado.
 *
 * O painel já foi só composição — barras ordenadas respondendo "qual categoria
 * pesou mais". Ele passou a carregar a **variação** junto, e isso muda a
 * pergunta que ele responde: de "onde foi" para "onde foi, e isso é novidade?".
 * Um gasto de oitocentos reais em compras não diz nada sozinho; dizer que ele
 * era de quatrocentos no mês passado diz tudo.
 *
 * Feito em tabela de verdade, e não em lista de divs: são cinco colunas com
 * cabeçalho, e é exatamente para isso que `<table>` existe. O leitor de tela
 * anuncia "Variação, mais 74 por cento" em vez de ler quatro números soltos.
 *
 * **A barra codifica tamanho e direção ao mesmo tempo.** O comprimento é
 * proporcional ao valor, e a cor diz para onde ele foi: vermelha quando o gasto
 * subiu, menta quando caiu. São dois canais em um só elemento, e isso é
 * deliberado — "quanto" e "para onde" se respondem no mesmo relance. Categoria
 * nova e categoria igual ao mês anterior ficam em tinta neutra, porque não
 * subiram nem caíram.
 */
export function CategoryBreakdown({ data, limit, className }: CategoryBreakdownProps) {
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
    <div className={cn('min-w-0', className)}>
      <table className="w-full border-collapse">
        <thead>
          <tr className="text-left text-xs font-medium tracking-[0.06em] text-muted uppercase">
            <th scope="col" className="pb-3">
              Categoria
            </th>
            <th scope="col" className="pb-3 text-right">
              Atual
            </th>
            {/* A coluna da barra não tem rótulo: ela é a leitura visual da
                variação que a coluna seguinte diz em número. */}
            <th scope="col" className="hidden w-[30%] pb-3 sm:table-cell">
              <span className="sr-only">Comparativo com o mês anterior</span>
            </th>
            <th scope="col" className="hidden pb-3 text-right lg:table-cell">
              Variação
            </th>
            <th scope="col" className="hidden pb-3 text-right lg:table-cell">
              Anterior
            </th>
          </tr>
        </thead>

        <tbody>
          {visiveis.map((item) => {
            const cor = categoryColor(item.groupId)
            const subiu = item.changeRatio !== null && item.changeRatio > 0
            // Zero é "igual", e não uma queda de zero por cento: sem esta
            // separação a pastilha saía "−0%", um sinal de menos sem número.
            const igual = item.changeRatio === 0

            return (
              <tr key={item.groupId} className="border-t border-hairline">
                <td className="py-3 pr-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    {/*
                      Pastilha com o glifo em preto sobre o matiz: as oito cores
                      de categoria foram derivadas para suportar tinta preta por
                      cima. Sem matiz — categoria criada pelo usuário — a
                      pastilha cai na superfície rebaixada com o ícone em tinta.
                    */}
                    <span
                      style={{ backgroundColor: cor ?? undefined }}
                      className={cn(
                        'inline-flex size-7 shrink-0 items-center justify-center rounded-xs',
                        cor ? 'text-accent-ink' : 'bg-sunken text-ink',
                      )}
                    >
                      <Icon name={item.icon} size={14} />
                    </span>
                    <span className="truncate text-[0.8125rem] font-medium text-ink">
                      {item.label}
                    </span>
                  </span>
                </td>

                <td className="py-3 text-right">
                  <Money cents={item.amount} className="text-[0.8125rem]" />
                </td>

                <td className="hidden px-3 py-3 sm:table-cell">
                  <div className="h-1.5 w-full overflow-hidden rounded-full bg-sunken">
                    <div
                      className={cn(
                        'h-full rounded-full transition-[width] duration-300',
                        item.changeRatio === null || igual
                          ? 'bg-faint'
                          : subiu
                            ? 'bg-expense'
                            : 'bg-income',
                      )}
                      // Proporcional à maior categoria, não ao total: com um
                      // gasto dominante, escalar pelo total achataria todo o
                      // resto em traços indistinguíveis.
                      style={{ width: `${Math.max((item.amount / largest) * 100, 3)}%` }}
                    />
                  </div>
                </td>

                <td className="hidden py-3 text-right lg:table-cell">
                  {item.changeRatio === null ? (
                    <span className="text-xs text-muted">novo</span>
                  ) : igual ? (
                    <span className="text-xs text-muted">igual</span>
                  ) : (
                    <DeltaBadge
                      percent={item.changeRatio * 100}
                      // Gasto que sobe é ruim. O julgamento é explícito porque
                      // a mesma seta para cima seria boa numa receita.
                      tone={subiu ? 'bad' : 'good'}
                    />
                  )}
                </td>

                <td className="hidden py-3 text-right lg:table-cell">
                  {item.previousCents === 0 ? (
                    <span className="text-xs text-faint">—</span>
                  ) : (
                    <Money cents={item.previousCents} className="text-xs text-muted" />
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {cauda.length > 0 ? (
        <div className="flex items-baseline justify-between gap-3 border-t border-hairline pt-3 text-xs text-muted">
          <span>
            +{cauda.length} {cauda.length === 1 ? 'categoria' : 'categorias'}
          </span>
          <Money cents={totalDaCauda} className="text-xs text-muted" />
        </div>
      ) : null}
    </div>
  )
}
