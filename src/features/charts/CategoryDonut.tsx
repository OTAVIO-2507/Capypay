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

/**
 * Os dois tons dos grupos sem matiz próprio, alternados.
 *
 * Sem vão entre as fatias, o que separa duas vizinhas é a ponta arredondada de
 * uma sobre a outra — e isso só se vê se as duas tiverem cores diferentes. Os
 * grupos fora da paleta vestiam todos o mesmo branco, e dois deles lado a lado
 * virariam um arco só. Alternar tinta e tinta terciária mantém cada fatia
 * contável sem inventar matiz que nenhum validador conferiu.
 */
const NEUTROS = ['var(--ink)', 'var(--ink-tertiary)'] as const

/**
 * A cor de cada fatia, na ordem do anel.
 *
 * A mesma função serve o anel, a legenda e a lista da tela de Categorias,
 * para a barra de um grupo ter sempre a cor exata da fatia dele — inclusive
 * quando essa cor é um dos dois neutros, que dependem da posição.
 */
export function sliceColors(data: readonly CategorySpend[]): Map<string, string> {
  const cores = new Map<string, string>()
  let neutras = 0
  for (const item of data) {
    const cor = categoryColor(item.groupId)
    if (cor) cores.set(item.groupId, cor)
    else cores.set(item.groupId, NEUTROS[neutras++ % NEUTROS.length])
  }
  return cores
}

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
 * As fatias são contínuas, com as pontas arredondadas se sobrepondo, como no
 * produto de referência. Já houve um vão reto de 3 unidades entre elas, para
 * duas vizinhas de matiz próximo não virarem uma mancha só; a ponta
 * arredondada faz o mesmo trabalho, desde que duas vizinhas nunca tenham a
 * mesma cor — e é para isso que existe `sliceColors`.
 */
export function CategoryDonut({ data, legendLimit = 5, size = 132, className }: CategoryDonutProps) {
  const masked = usePrivacy()

  const total = data.reduce((soma, item) => soma + item.amount, 0)
  if (total === 0) return null

  const cores = sliceColors(data)
  const nomeadas = data.slice(0, legendLimit)
  const restantes = data.length - nomeadas.length
  const totalRestante = data.slice(nomeadas.length).reduce((soma, item) => soma + item.amount, 0)

  return (
    <div className={cn('flex flex-col items-center gap-5 sm:flex-row sm:items-center sm:justify-center', className)}>
      <CategoryRing data={data} size={size} />

      {/*
        A legenda é obrigatória, não opcional: com duas ou mais fatias, a
        identidade não pode depender só do matiz. Ela também é o único lugar
        onde a fatia pequena demais para ler no anel diz o próprio nome.
      */}
      <ul className="grid min-w-0 flex-1 grid-cols-1 gap-x-4 gap-y-1.5 sm:grid-cols-2">
        {nomeadas.map((item) => (
          <li key={item.groupId} className="flex min-w-0 items-center gap-2 text-xs">
            <span
              aria-hidden="true"
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: cores.get(item.groupId) }}
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

/**
 * Só o anel, sem legenda.
 *
 * Existe para a tela de Categorias, onde a lista logo abaixo **é** a legenda:
 * cada grupo aparece com o nome, o valor e uma barra da mesma cor da fatia.
 * Repetir os nomes ao lado do anel diria tudo duas vezes. Fora de lá, use
 * `CategoryDonut`, que traz a legenda junto — a regra de que a fatia não pode
 * depender só do matiz continua valendo; aqui ela é cumprida pela lista.
 */
export function CategoryRing({
  data,
  size = 132,
  className,
}: {
  data: CategorySpend[]
  size?: number
  className?: string
}) {
  const stroke = Math.round(size * 0.15)
  const radius = (size - stroke) / 2
  const circunferencia = 2 * Math.PI * radius

  const total = data.reduce((soma, item) => soma + item.amount, 0)
  if (total === 0) return null

  const cores = sliceColors(data)
  let acumulado = 0
  const fatias = data.map((item) => {
    const arco = (item.amount / total) * circunferencia
    const inicio = acumulado
    acumulado += arco
    return { item, inicio, arco, cor: cores.get(item.groupId) }
  })

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      className={cn('-rotate-90 shrink-0', className)}
      role="img"
      aria-label={`Composição das despesas: ${data
        .map((item) => `${item.label}, ${formatPercent(item.share, { masked: false })}`)
        .join('; ')}`}
    >
      {/*
        Desenhadas da última para a primeira, com ponta redonda. Cada fatia
        estende meia espessura além do próprio arco, e desenhar ao contrário
        faz a ponta final de cada uma ficar **por cima** do começo da
        seguinte: o encaixe arredondado da referência, sempre no mesmo sentido.

        Uma fatia só é um círculo inteiro, e ponta redonda num círculo fechado
        deixaria um calombo onde ele fecha: ela vai sem ponta.
      */}
      {[...fatias].reverse().map(({ item, inicio, arco, cor }) => (
        <circle
          key={item.groupId}
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={stroke}
          strokeLinecap={fatias.length > 1 ? 'round' : 'butt'}
          strokeDasharray={`${arco} ${circunferencia - arco}`}
          strokeDashoffset={-inicio}
          className="transition-[stroke-dasharray] duration-500"
          style={{ stroke: cor }}
        />
      ))}
    </svg>
  )
}
