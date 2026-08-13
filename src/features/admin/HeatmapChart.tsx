import { useState } from 'react'
import { formatFullDate } from '@/lib/date'
import type { DiaDeAtividade } from './adminMetrics'

/** Os quatro degraus da rampa, do mais forte ao mais fraco. Ver `styles.css`. */
const RAMPA = ['var(--ramp-1)', 'var(--ramp-2)', 'var(--ramp-3)', 'var(--ramp-4)']

const CELULA = 14
const VAO = 4
/** Domingo primeiro, como todo calendário em português. */
const DIAS_DA_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S']

const MES_CURTO = new Intl.DateTimeFormat('pt-BR', { month: 'short' })

/**
 * Intensidade por faixa fixa, e não por quartil do próprio período.
 *
 * Quartil faz o tom depender do resto da grade: numa semana parada, uma única
 * ação apareceria no tom mais forte, e a mesma ação numa semana movimentada
 * apareceria no mais fraco. A cor deixaria de significar "quanto" e passaria a
 * significar "quanto, comparado com esta tela agora".
 */
function nivelDe(count: number): number {
  if (count === 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  if (count <= 4) return 3
  return 4
}

/**
 * Calendário de intensidade das ações administrativas.
 *
 * Uma célula por dia, semanas em coluna, dias da semana em linha. É a forma
 * que responde "quando" sem precisar de eixo: a posição já é a data, e a
 * intensidade é a contagem. Um disco daria a proporção entre tipos e não diria
 * nada sobre ritmo, que é justamente o que se quer saber de um histórico.
 *
 * Rampa ordinal de um matiz só, a mesma do disco. Não é paleta categórica: os
 * degraus aqui são graus de uma quantidade, e trocar de matiz entre eles
 * sugeriria categorias que não existem.
 */
export function HeatmapChart({ dias }: { dias: DiaDeAtividade[] }) {
  const [ativo, setAtivo] = useState<DiaDeAtividade | null>(null)

  const semanas: DiaDeAtividade[][] = []
  for (let inicio = 0; inicio < dias.length; inicio += 7) {
    semanas.push(dias.slice(inicio, inicio + 7))
  }

  // Rótulo de mês só na primeira semana em que o mês aparece, e nunca duas
  // vezes seguidas: repetir "ago" em cinco colunas é ruído, não referência.
  let mesAnterior = ''
  const rotulos = semanas.map((semana) => {
    const mes = MES_CURTO.format(new Date(`${semana[0].date}T12:00:00`)).replace('.', '')
    if (mes === mesAnterior) return null
    mesAnterior = mes
    return mes
  })

  return (
    <div className="flex flex-col gap-3">
      <div className="overflow-x-auto pb-1">
        <div className="inline-flex gap-1.5">
          {/* Coluna de dias da semana: alternadas, para não empilhar sete
              letras de 10px numa altura de 14px cada. */}
          <ul
            className="flex shrink-0 flex-col text-[0.625rem] text-faint"
            style={{ gap: VAO, paddingTop: 18 }}
            aria-hidden="true"
          >
            {DIAS_DA_SEMANA.map((letra, indice) => (
              <li
                key={indice}
                className="flex items-center justify-end pr-0.5"
                style={{ height: CELULA, width: 14 }}
              >
                {indice % 2 === 1 ? letra : ''}
              </li>
            ))}
          </ul>

          <div className="flex" style={{ gap: VAO }}>
            {semanas.map((semana, indiceSemana) => (
              <div key={semana[0].date} className="flex flex-col" style={{ gap: VAO }}>
                <span
                  className="text-[0.625rem] whitespace-nowrap text-faint"
                  style={{ height: 14 }}
                  aria-hidden="true"
                >
                  {rotulos[indiceSemana]}
                </span>

                {semana.map((dia) => {
                  const nivel = nivelDe(dia.count)

                  return (
                    <button
                      key={dia.date}
                      type="button"
                      onPointerEnter={() => setAtivo(dia)}
                      onPointerLeave={() => setAtivo(null)}
                      onFocus={() => setAtivo(dia)}
                      onBlur={() => setAtivo(null)}
                      aria-label={`${formatFullDate(dia.date)}: ${dia.count} ${dia.count === 1 ? 'ação' : 'ações'}`}
                      className="rounded-xs outline-offset-2 motion-safe:transition-opacity motion-safe:duration-150"
                      style={{
                        width: CELULA,
                        height: CELULA,
                        // Dia sem nada fica na superfície rebaixada, e não num
                        // tom mínimo de cortesia: um resto de tinta onde não
                        // houve ação nenhuma é a mentira que o olho mais crê.
                        backgroundColor: nivel === 0 ? 'var(--sunken)' : RAMPA[4 - nivel],
                        opacity: ativo && ativo.date !== dia.date ? 0.45 : 1,
                      }}
                    />
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        {/*
          O balão do dia sob o cursor ocupa a mesma linha da legenda em vez de
          flutuar por cima da grade: uma caixa sobreposta taparia justamente as
          células vizinhas, que são a referência para ler a que está sob o
          cursor.
        */}
        <p role="status" className="text-xs text-muted">
          {ativo ? (
            <>
              <span className="font-semibold text-ink">
                {ativo.count} {ativo.count === 1 ? 'ação' : 'ações'}
              </span>{' '}
              em {formatFullDate(ativo.date)}
            </>
          ) : (
            'Cada quadrado é um dia.'
          )}
        </p>

        <div className="flex items-center gap-1.5" aria-hidden="true">
          <span className="text-[0.625rem] text-faint">menos</span>
          <span className="size-2.5 rounded-[3px]" style={{ backgroundColor: 'var(--sunken)' }} />
          {[1, 2, 3, 4].map((nivel) => (
            <span
              key={nivel}
              className="size-2.5 rounded-[3px]"
              style={{ backgroundColor: RAMPA[4 - nivel] }}
            />
          ))}
          <span className="text-[0.625rem] text-faint">mais</span>
        </div>
      </div>
    </div>
  )
}
