import { useState } from 'react'
import { cn } from '@/lib/cn'

export interface DonutSlice {
  id: string
  label: string
  count: number
}

/** Os quatro degraus da rampa ordinal, em ordem. Ver `styles.css`. */
const RAMPA = ['var(--ramp-1)', 'var(--ramp-2)', 'var(--ramp-3)', 'var(--ramp-4)']

const TAMANHO = 168
const ESPESSURA = 26
const RAIO = (TAMANHO - ESPESSURA) / 2
const CIRCUNFERENCIA = 2 * Math.PI * RAIO

/**
 * Parte-do-todo em disco.
 *
 * Cabe aqui, e não em qualquer lugar, por duas condições que este dado
 * satisfaz: são faixas **ordenadas** (mais recente até nunca), e são no
 * máximo quatro. Disco de duas fatias seria um número disfarçado de gráfico,
 * e acima de seis as fatias vizinhas deixam de se distinguir.
 *
 * A ordem é a informação, então a rampa acompanha a ordem e não o tamanho:
 * tingir a maior fatia de mais escuro codificaria pela segunda vez o que o
 * ângulo já diz. É rampa ordinal de um matiz só, validada contra as duas
 * superfícies — não paleta categórica, porque os degraus não têm identidade.
 *
 * Cada fatia deixa um vão de 2px na cor da superfície em vez de um contorno:
 * contorno em volta de marca acrescenta uma linha que compete com o próprio
 * dado, o vão só separa.
 */
export function DonutChart({ slices, total }: { slices: DonutSlice[]; total: number }) {
  const [ativo, setAtivo] = useState<string | null>(null)
  const emFoco = slices.find((slice) => slice.id === ativo) ?? null
  let percorrido = 0

  return (
    <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-5">
      <div className="relative shrink-0" style={{ width: TAMANHO, height: TAMANHO }}>
        <svg width={TAMANHO} height={TAMANHO} className="-rotate-90" aria-hidden="true">
          <circle
            cx={TAMANHO / 2}
            cy={TAMANHO / 2}
            r={RAIO}
            fill="none"
            strokeWidth={ESPESSURA}
            className="stroke-sunken"
          />

          {slices.map((slice, indice) => {
            if (slice.count === 0) return null

            const fracao = slice.count / total
            const comprimento = fracao * CIRCUNFERENCIA
            // O vão de 2px sai do próprio traço, não de um contorno por cima.
            const vao = slices.filter((s) => s.count > 0).length > 1 ? 2 : 0
            const offset = -percorrido * CIRCUNFERENCIA
            percorrido += fracao

            return (
              <circle
                key={slice.id}
                cx={TAMANHO / 2}
                cy={TAMANHO / 2}
                r={RAIO}
                fill="none"
                strokeWidth={ESPESSURA}
                stroke={RAMPA[indice % RAMPA.length]}
                strokeDasharray={`${Math.max(comprimento - vao, 0)} ${CIRCUNFERENCIA}`}
                strokeDashoffset={offset}
                /*
                 * O arco é o alvo, e não só a legenda. Traço com `dasharray`
                 * recebe ponteiro apenas na parte de fato pintada, que é
                 * exatamente a fatia — nenhuma área invisível some com o
                 * evento do vizinho.
                 */
                onPointerEnter={() => setAtivo(slice.id)}
                onPointerLeave={() => setAtivo(null)}
                className={cn(
                  // Sem `cursor-pointer`: mão indica que clicar leva a algum
                  // lugar, e clicar aqui não leva. A resposta visual (as
                  // vizinhas apagando, o miolo trocando de número) é a própria
                  // affordance.
                  'motion-safe:transition-[stroke-dasharray,opacity] motion-safe:duration-500',
                  // Escurecer o alvo não funciona numa rampa de cinzas: viraria
                  // outro degrau da própria rampa. Apagar os vizinhos isola a
                  // fatia sem inventar um tom que não existe na escala.
                  ativo !== null && ativo !== slice.id && 'opacity-35',
                )}
              />
            )
          })}
        </svg>

        {/*
          O centro é o balão: em vez de uma caixa que aparece por cima e tapa o
          próprio gráfico, o miolo do disco já é espaço vazio e troca de
          conteúdo. Sem foco, mostra o total.
        */}
        <span className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
          <span className="text-[1.75rem] leading-none font-semibold tracking-[-0.03em] text-ink">
            {emFoco ? emFoco.count : total}
          </span>
          <span className="mt-1 text-xs leading-tight text-muted">
            {emFoco ? emFoco.label : total === 1 ? 'conta' : 'contas'}
          </span>
        </span>
      </div>

      {/*
        Legenda sempre presente, com o número escrito: o disco dá a proporção
        num relance, e a lista dá o valor exato. Nada aqui depende de passar o
        mouse, nem de distinguir dois tons de cinza vizinhos.
      */}
      <ul className="flex min-w-[9rem] flex-col gap-1">
        {slices.map((slice, indice) => (
          <li key={slice.id}>
            <button
              type="button"
              onPointerEnter={() => setAtivo(slice.id)}
              onPointerLeave={() => setAtivo(null)}
              onFocus={() => setAtivo(slice.id)}
              onBlur={() => setAtivo(null)}
              aria-label={`${slice.label}: ${slice.count} de ${total}`}
              className={cn(
                '-mx-2 flex w-full items-center gap-2.5 rounded-sm px-2 py-1.5',
                'transition-colors duration-150 hover:bg-sunken',
                ativo === slice.id && 'bg-sunken',
              )}
            >
              <span
                aria-hidden="true"
                className={cn('size-2.5 shrink-0 rounded-full', slice.count === 0 && 'opacity-30')}
                style={{ backgroundColor: RAMPA[indice % RAMPA.length] }}
              />
              <span className="flex-1 text-left text-xs text-muted">{slice.label}</span>
              <span className="tnum text-xs font-semibold text-ink">{slice.count}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  )
}
