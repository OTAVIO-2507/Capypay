import { categoryColor } from '@/domain/categories'
import type { CategorySpend } from '@/domain/selectors'
import { cn } from '@/lib/cn'
import { formatPercent } from '@/lib/format'
import { usePrivacy } from '@/store/hooks'

interface CategoryDonutProps {
  data: CategorySpend[]
  /** Quantas fatias ganham nome na legenda. O resto vira "outras". */
  legendLimit?: number
  size?: number
  className?: string
}

/** Sobra de superfície entre duas fatias, em graus de arco na circunferência. */
const VAO = 3

/**
 * A composição das despesas do mês, em anel.
 *
 * Anel e não barra, aqui, porque a pergunta é **parte-do-todo**: quanto do mês
 * cada categoria ocupou. "Principais categorias", no painel, responde outra —
 * qual pesou mais — e por isso continua em barras, onde comparar comprimento é
 * mais fácil que comparar ângulo. As duas convivem porque são perguntas
 * diferentes, e não duas formas da mesma.
 *
 * A rosca colorida foi recusada por este sistema durante toda a sua vida, e a
 * razão era honesta: uma rosca precisa de uma cor por fatia, e não havia
 * paleta. Agora há — validada, fechada em oito, e com ícone e rótulo sempre ao
 * lado. O que era impossível virou possível; a regra não mudou de opinião.
 *
 * O vão de 3 unidades entre fatias não é enfeite: sem ele, duas categorias
 * vizinhas de matiz próximo viram uma mancha só, e a contagem de fatias — que
 * é metade da leitura — se perde.
 */
export function CategoryDonut({ data, legendLimit = 5, size = 132, className }: CategoryDonutProps) {
  const masked = usePrivacy()

  const stroke = Math.round(size * 0.14)
  const radius = (size - stroke) / 2
  const circunferencia = 2 * Math.PI * radius

  const total = data.reduce((soma, item) => soma + item.amount, 0)
  if (total === 0) return null

  let acumulado = 0
  const fatias = data.map((item) => {
    const arco = (item.amount / total) * circunferencia
    const inicio = acumulado
    acumulado += arco
    return {
      item,
      inicio,
      // Nunca menor que o vão: uma fatia de 0,3% viraria um traço invisível,
      // e some da contagem sem ninguém perceber que sumiu.
      visivel: Math.max(arco - VAO, 1.5),
      cor: categoryColor(item.categoryId),
    }
  })

  const nomeadas = data.slice(0, legendLimit)
  const restantes = data.length - nomeadas.length
  const totalRestante = data.slice(nomeadas.length).reduce((soma, item) => soma + item.amount, 0)

  return (
    <div className={cn('flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center', className)}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90 shrink-0"
        role="img"
        aria-label={`Composição das despesas: ${data
          .map((item) => `${item.label}, ${formatPercent(item.share, { masked: false })}`)
          .join('; ')}`}
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          className="stroke-sunken"
        />
        {fatias.map(({ item, inicio, visivel, cor }) => (
          <circle
            key={item.categoryId}
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            strokeWidth={stroke}
            strokeDasharray={`${visivel} ${circunferencia - visivel}`}
            strokeDashoffset={-inicio}
            className={cn('transition-[stroke-dasharray] duration-500', cor ? '' : 'stroke-ink')}
            style={{ stroke: cor ?? undefined }}
          />
        ))}
      </svg>

      {/*
        A legenda é obrigatória, não opcional: com duas ou mais fatias, a
        identidade não pode depender só do matiz. Ela também é o único lugar
        onde a fatia pequena demais para ler no anel diz o próprio nome.
      */}
      <ul className="grid min-w-0 flex-1 grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {nomeadas.map((item) => (
          <li key={item.categoryId} className="flex min-w-0 items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className={cn('size-2.5 shrink-0 rounded-full', categoryColor(item.categoryId) ? '' : 'bg-ink')}
              style={{ backgroundColor: categoryColor(item.categoryId) ?? undefined }}
            />
            <span className="truncate text-ink">{item.label}</span>
            <span className="tnum ml-auto shrink-0 text-muted">
              {formatPercent(item.share, { masked })}
            </span>
          </li>
        ))}
        {restantes > 0 ? (
          <li className="flex min-w-0 items-center gap-2 text-xs">
            <span aria-hidden="true" className="size-2.5 shrink-0 rounded-full bg-hairline-strong" />
            <span className="truncate text-muted">
              +{restantes} {restantes === 1 ? 'categoria' : 'categorias'}
            </span>
            <span className="tnum ml-auto shrink-0 text-muted">
              {formatPercent(totalRestante / total, { masked })}
            </span>
          </li>
        ) : null}
      </ul>
    </div>
  )
}
