import { useState } from 'react'
import { cn } from '@/lib/cn'
import type { FaixaDeAtividade } from './adminMetrics'

/**
 * Distribuição das contas por último acesso.
 *
 * Barras em HTML, não Recharts: são quatro valores numa escala só, e uma
 * biblioteca de gráficos aqui traria eixo, escala e tooltip para desenhar
 * quatro retângulos que o CSS resolve — além de um segundo vocabulário de
 * marcas para manter alinhado com o resto do sistema.
 *
 * **Uma cor só, e não uma rampa.** As faixas são ordenadas e rotuladas, então
 * a posição e o texto já carregam a recência; tingir cada barra de um tom
 * diferente codificaria pela segunda vez o que a lista já diz, gastando o
 * único canal livre. Toda barra é Tinta sobre trilho Rebaixado, nos dois
 * temas, sem cor nenhuma envolvida.
 *
 * Cada valor aparece escrito ao lado da barra: nada aqui depende de passar o
 * mouse para ser lido.
 */
export function ActivityChart({ faixas }: { faixas: FaixaDeAtividade[] }) {
  const [ativo, setAtivo] = useState<string | null>(null)
  const total = faixas.reduce((soma, faixa) => soma + faixa.count, 0)

  if (total === 0) {
    return (
      <p className="text-[0.8125rem] text-muted">
        Nenhuma conta cadastrada ainda. O gráfico aparece com a primeira.
      </p>
    )
  }

  return (
    <ul className="flex flex-col gap-4">
      {faixas.map((faixa) => {
        const proporcao = faixa.count / total

        return (
          <li key={faixa.id}>
            {/*
              A linha inteira é o alvo, não a barra de 10px de altura: mirar na
              marca pintada é pedir precisão que ninguém tem, ainda mais no
              toque. O botão também dá o foco por teclado, com o mesmo
              destaque do ponteiro.
            */}
            <button
              type="button"
              onPointerEnter={() => setAtivo(faixa.id)}
              onPointerLeave={() => setAtivo(null)}
              onFocus={() => setAtivo(faixa.id)}
              onBlur={() => setAtivo(null)}
              aria-label={`${faixa.label}: ${faixa.count} de ${total}`}
              className="-mx-2 block w-full rounded-sm px-2 py-1 text-left transition-colors duration-150 hover:bg-sunken/60"
            >
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="text-xs text-muted">{faixa.label}</span>
              <span className="tnum text-xs font-semibold text-ink">
                {faixa.count}
                {ativo === faixa.id && total > 0 ? (
                  <span className="ml-1.5 font-normal text-muted">
                    {Math.round(proporcao * 100)}%
                  </span>
                ) : null}
              </span>
            </div>

            <div className="h-2.5 w-full overflow-hidden rounded-full bg-sunken">
              <div
                className={cn(
                  'h-full rounded-full bg-ink',
                  'motion-safe:transition-[width,opacity] motion-safe:duration-500',
                  'motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]',
                  ativo !== null && ativo !== faixa.id && 'opacity-40',
                )}
                /*
                 * Uma faixa em zero fica sem barra, e não com um traço mínimo
                 * de cortesia: um resto de tinta onde não há conta nenhuma é
                 * uma mentira pequena, e é a que o olho mais crê.
                 */
                style={{ width: `${proporcao * 100}%` }}
              />
            </div>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
