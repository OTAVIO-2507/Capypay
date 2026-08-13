import { useState } from 'react'
import { cn } from '@/lib/cn'
import { escalaDe } from './adminMetrics'

export interface Coluna {
  id: string
  label: string
  count: number
}

const ALTURA_PLOT = 168
/** Teto da espessura da marca. O que sobra na faixa é ar, não coluna. */
const LARGURA_MAX = 24
/** Piso da faixa, para o alvo de mouse e de toque não virar um alfinete. */
const LARGURA_MIN_FAIXA = 34

/**
 * Colunas por período.
 *
 * Três decisões vindas das especificações de marca, e a primeira é a que mais
 * mudou o desenho: a coluna tem **teto de 24px** e nunca preenche a faixa. Sem
 * esse teto, um único mês de dado esticava a barra pela largura inteira do
 * cartão e o gráfico virava um retângulo — que foi como ele nasceu.
 *
 * A segunda: valor não vai em cima de toda coluna. Um número por marca é ruído
 * que ninguém lê; o eixo carrega a escala, o balão carrega o valor exato, e só
 * o pico ganha rótulo direto.
 *
 * A terceira: a faixa inteira é o alvo, não a coluna pintada. Mirar em 24px de
 * tinta é pedir precisão que ninguém tem, ainda mais no toque.
 */
export function ColumnChart({ colunas, unidade }: { colunas: Coluna[]; unidade: string }) {
  const [ativo, setAtivo] = useState<number | null>(null)

  const pico = Math.max(0, ...colunas.map((coluna) => coluna.count))
  const { max, ticks } = escalaDe(pico)
  const indicePico = colunas.findIndex((coluna) => coluna.count === pico && pico > 0)

  return (
    <div className="relative">
      <div className="flex gap-3">
        {/* Eixo: números alinhados por casa, então face tabular. */}
        <ul
          className="tnum relative w-6 shrink-0 text-right text-[0.625rem] text-faint"
          style={{ height: ALTURA_PLOT }}
          aria-hidden="true"
        >
          {ticks.map((tick) => (
            <li
              key={tick}
              className="absolute right-0 -translate-y-1/2"
              style={{ bottom: `${(tick / max) * 100}%` }}
            >
              {tick}
            </li>
          ))}
        </ul>

        <div className="min-w-0 flex-1 overflow-x-auto pb-1">
          <div className="relative" style={{ height: ALTURA_PLOT }}>
            {/* Grade: hairline sólida, um passo acima da superfície, recuada. */}
            {ticks.map((tick) => (
              <span
                key={tick}
                aria-hidden="true"
                className="absolute inset-x-0 border-t border-hairline"
                style={{ bottom: `${(tick / max) * 100}%` }}
              />
            ))}

            <ul className="absolute inset-0 flex items-end">
              {colunas.map((coluna, indice) => {
                const altura = Math.round((coluna.count / max) * ALTURA_PLOT)
                const destacado = ativo === indice

                return (
                  <li
                    key={coluna.id}
                    className="flex h-full flex-1 justify-center"
                    style={{ minWidth: LARGURA_MIN_FAIXA }}
                  >
                    <button
                      type="button"
                      onPointerEnter={() => setAtivo(indice)}
                      onPointerLeave={() => setAtivo(null)}
                      onFocus={() => setAtivo(indice)}
                      onBlur={() => setAtivo(null)}
                      aria-label={`${coluna.label}: ${coluna.count} ${unidade}`}
                      className="flex h-full w-full items-end justify-center rounded-sm outline-offset-2"
                    >
                      <span
                        aria-hidden="true"
                        className={cn(
                          // Ponta arredondada em cima, quadrada na base: a
                          // coluna nasce da linha de base, não flutua sobre ela.
                          'w-full rounded-t-[4px] bg-ink',
                          'motion-safe:transition-[height,opacity] motion-safe:duration-500',
                          'motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]',
                          destacado && 'opacity-70',
                        )}
                        /*
                         * Mês sem cadastro fica sem coluna, e não com um traço
                         * mínimo de cortesia: um resto de tinta onde não houve
                         * conta nenhuma é uma mentira pequena, e é a que o olho
                         * mais crê.
                         */
                        style={{ height: altura, maxWidth: LARGURA_MAX }}
                      />
                    </button>
                  </li>
                )
              })}
            </ul>

            {/* Rótulo direto só no pico: o extremo é o que a leitura procura. */}
            {indicePico >= 0 && colunas.length > 1 ? (
              <span
                aria-hidden="true"
                className="tnum absolute -translate-x-1/2 text-xs font-semibold text-ink"
                style={{
                  left: `${((indicePico + 0.5) / colunas.length) * 100}%`,
                  bottom: `calc(${(pico / max) * 100}% + 6px)`,
                }}
              >
                {pico}
              </span>
            ) : null}
          </div>

          <ul className="flex" aria-hidden="true">
            {colunas.map((coluna) => (
              <li
                key={coluna.id}
                className="flex-1 pt-2 text-center text-[0.625rem] whitespace-nowrap text-muted"
                style={{ minWidth: LARGURA_MIN_FAIXA }}
              >
                {coluna.label}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/*
        O balão enriquece, nunca é a única via: o eixo dá a escala, o rótulo do
        pico dá o extremo, e o nome acessível de cada faixa carrega o valor
        exato para quem navega por teclado ou leitor de tela.
      */}
      {ativo !== null ? (
        <div
          role="status"
          className="pointer-events-none absolute -top-1 -translate-x-1/2 rounded-sm border border-hairline bg-sheet px-2.5 py-1.5 shadow-[var(--shadow-float)]"
          style={{ left: `calc(2.25rem + ${((ativo + 0.5) / colunas.length) * 100}%)` }}
        >
          <p className="tnum text-xs font-semibold text-ink">
            {colunas[ativo].count} {unidade}
          </p>
          <p className="text-[0.625rem] whitespace-nowrap text-muted">{colunas[ativo].label}</p>
        </div>
      ) : null}
    </div>
  )
}
