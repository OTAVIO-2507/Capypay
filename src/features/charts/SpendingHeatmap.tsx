import { useEffect, useMemo, useRef, useState } from 'react'
import { Money } from '@/components/ui/Money'
import { cn } from '@/lib/cn'
import { formatCurrency } from '@/lib/format'
import { formatDayMonth, formatWeekdayLong, type IsoDate, type MonthKey } from '@/lib/date'
import type { Cents } from '@/lib/money'
import { usePrivacy } from '@/store/hooks'

export interface DiaDeGasto {
  /** Dia do mês, de 1 a 28–31. */
  day: number
  cents: Cents
  /** Quantas despesas caíram no dia. */
  count: number
}

/*
 * Cinco degraus de intensidade, do "nada gasto" ao "pior dia do mês".
 *
 * A escala é de opacidade sobre a cor de despesa, não cinco matizes: é uma
 * rampa **sequencial**, que codifica quantidade, e quantidade tem ordem. Cinco
 * cores diferentes obrigariam a consultar a legenda para saber qual é mais;
 * cinco saturações da mesma se leem sem legenda nenhuma.
 *
 * O degrau zero não é "vermelho a 0%": é a superfície rebaixada. Dia sem gasto
 * não é um gasto pequeno — é a ausência dele, e merece uma célula que se lê
 * como vazia e não como quase-nada.
 */
const DEGRAUS = [
  'bg-sunken text-faint',
  'bg-expense/15 text-ink',
  'bg-expense/30 text-ink',
  'bg-expense/50 text-ink',
  'bg-expense/75 text-ink',
] as const

/**
 * Em que degrau cai um dia.
 *
 * A divisão é por **fração do maior gasto**, e não por quantil. Quantil
 * distribuiria os dias igualmente entre os cinco tons e faria um mês tranquilo
 * parecer tão vermelho quanto um mês caro — a escala perderia a referência
 * externa que é justamente o que se quer olhar aqui.
 */
function degrau(cents: Cents, maximo: Cents): number {
  if (cents <= 0 || maximo <= 0) return 0
  const fracao = cents / maximo
  if (fracao > 0.75) return 4
  if (fracao > 0.5) return 3
  if (fracao > 0.25) return 2
  return 1
}

const DIA_DA_SEMANA = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'] as const

/** A data ISO de um dia do mês mostrado. */
function isoDoDia(month: MonthKey, day: number): IsoDate {
  return `${month}-${String(day).padStart(2, '0')}`
}

/** Metade da largura do balão, mais o respiro da borda do painel. */
const MEIO_BALAO = 118

interface Balao {
  dia: DiaDeGasto
  /** Em pixels, relativos ao canto do mapa. */
  left: number
  top: number
  /** Acima da célula, ou abaixo quando a célula está na primeira linha. */
  acima: boolean
}

/**
 * O mapa de calor do mês: um dia por célula, a intensidade contando o gasto.
 *
 * O arranjo é **semana por coluna, dia da semana por linha** — sete linhas
 * fixas, tantas colunas quantas o mês precisar. É o que permite ler padrão de
 * comportamento em vez de só sequência: gastar todo sábado aparece como uma
 * linha inteira acesa, o que uma fila de trinta células nunca mostraria.
 *
 * A célula é larga e carrega o número do dia dentro. Um quadrado pequeno sem
 * rótulo obrigaria a contar a partir do canto para saber de que dia se trata,
 * e a pergunta "que dia foi esse?" é a primeira que o mapa provoca.
 *
 * A segunda pergunta é "quanto?", e a terceira é "quanto disso foi uma compra
 * só?". As duas são do balão: o valor do dia em número grande e a contagem de
 * lançamentos embaixo. Quatrocentos reais podem ser uma compra ou doze, e o
 * tom da célula não distingue as duas.
 */
export function SpendingHeatmap({
  dias,
  month,
  primeiroDiaDaSemana,
  onSelecionar,
  className,
}: {
  dias: readonly DiaDeGasto[]
  /** O mês mostrado, para o balão poder escrever a data por extenso. */
  month: MonthKey
  /** Dia da semana em que o mês começa: 0 = domingo. */
  primeiroDiaDaSemana: number
  /**
   * Abre o dia. Com ele, a célula com gasto vira botão e o balão convida ao
   * clique; sem ele, o mapa continua sendo só leitura.
   */
  onSelecionar?: (dia: DiaDeGasto) => void
  className?: string
}) {
  const masked = usePrivacy()
  const raiz = useRef<HTMLDivElement>(null)
  const [balao, setBalao] = useState<Balao | null>(null)

  const { maximo, semanas } = useMemo(() => {
    const max = dias.reduce((maior, dia) => Math.max(maior, dia.cents), 0)

    // O mês raramente começa num domingo: as células vazias do começo mantêm
    // cada dia na linha do seu dia da semana, que é a leitura inteira do mapa.
    const celulas: (DiaDeGasto | null)[] = [
      ...Array.from({ length: primeiroDiaDaSemana }, () => null),
      ...dias,
    ]
    while (celulas.length % 7 !== 0) celulas.push(null)

    const colunas: (DiaDeGasto | null)[][] = []
    for (let i = 0; i < celulas.length; i += 7) colunas.push(celulas.slice(i, i + 7))

    return { maximo: max, semanas: colunas }
  }, [dias, primeiroDiaDaSemana])

  /*
   * A posição sai da medida da célula, e não de um `absolute` dentro dela.
   *
   * A fila de semanas rola na horizontal em tela estreita, e balão nascido lá
   * dentro seria recortado pela rolagem. Medindo contra o canto do mapa, ele
   * nasce fora do contêiner que recorta e fica inteiro em qualquer largura.
   */
  const mostrar = (dia: DiaDeGasto, alvo: HTMLElement) => {
    const base = raiz.current
    if (!base) return

    const celula = alvo.getBoundingClientRect()
    const mapa = base.getBoundingClientRect()
    const centro = celula.left - mapa.left + celula.width / 2

    setBalao({
      dia,
      // Preso à largura do mapa: no canto esquerdo ou direito da grade, um
      // balão centrado na célula sairia pela borda do painel.
      left: Math.min(Math.max(centro, MEIO_BALAO), Math.max(mapa.width - MEIO_BALAO, MEIO_BALAO)),
      top: celula.top - mapa.top,
      // Nas primeiras linhas não há altura acima para ele ocupar, então ele
      // desce. É a mesma regra de um menu perto da borda da janela.
      acima: celula.top - mapa.top > 132,
    })
  }

  const esconder = () => setBalao(null)

  /*
   * A posição foi medida uma vez, e uma janela redimensionada a invalida: a
   * grade reflui, a célula muda de lugar e o balão fica apontando para o
   * vizinho dela. Some, e volta na próxima vez que alguém apontar — o que
   * acontece antes de dar tempo de reparar que ele sumiu.
   */
  useEffect(() => {
    if (!balao) return
    window.addEventListener('resize', esconder)
    return () => window.removeEventListener('resize', esconder)
  }, [balao])

  return (
    <div ref={raiz} className={cn('relative', className)} onMouseLeave={esconder}>
      <div className="flex gap-1.5">
        {/* A coluna de rótulos fica fora da grade para não virar uma célula. */}
        <div aria-hidden="true" className="flex shrink-0 flex-col gap-1.5">
          {DIA_DA_SEMANA.map((letra, i) => (
            <span
              key={i}
              className="flex h-7 items-center text-[0.625rem] font-medium text-faint"
            >
              {letra}
            </span>
          ))}
        </div>

        <div className="flex min-w-0 flex-1 gap-1.5 overflow-x-auto">
          {semanas.map((semana, indice) => (
            <div key={indice} className="flex min-w-0 flex-1 flex-col gap-1.5">
              {semana.map((dia, linha) =>
                dia ? (
                  <Celula
                    key={linha}
                    dia={dia}
                    masked={masked}
                    intensidade={degrau(dia.cents, maximo)}
                    ativa={balao?.dia.day === dia.day}
                    onApontar={mostrar}
                    onSair={esconder}
                    onSelecionar={onSelecionar}
                  />
                ) : (
                  <span key={linha} aria-hidden="true" className="h-7" />
                ),
              )}
            </div>
          ))}
        </div>
      </div>

      {balao ? (
        /*
         * `aria-hidden` porque não há nada aqui que a célula já não diga: o
         * nome acessível dela carrega a data, o valor e a contagem. Um balão
         * anunciado por cima disso seria a mesma frase duas vezes.
         *
         * `key` no dia para o balão renascer a cada célula — é o que faz a
         * aparição ser um aparecer, e não um deslizar de uma célula à outra.
         */
        <div
          key={balao.dia.day}
          aria-hidden="true"
          style={{
            left: balao.left,
            top: balao.top,
            transform: `translate(-50%, ${balao.acima ? 'calc(-100% - 8px)' : 'calc(1.75rem + 8px)'})`,
          }}
          className={cn(
            'balao-do-mapa pointer-events-none absolute z-20 w-[14rem] rounded-sm',
            'border border-hairline bg-raised px-4 py-3 shadow-[var(--shadow-float)]',
          )}
        >
          <p className="text-xs text-muted">
            {formatWeekdayLong(isoDoDia(month, balao.dia.day))},{' '}
            {formatDayMonth(isoDoDia(month, balao.dia.day))}
          </p>
          <p className="mt-1.5 text-lg leading-tight font-bold text-ink">
            <Money cents={balao.dia.cents} />
          </p>
          <p className="mt-0.5 text-xs text-muted">
            {balao.dia.count} {balao.dia.count === 1 ? 'transação' : 'transações'}
          </p>
          {onSelecionar ? (
            <p className="mt-2.5 text-xs font-medium text-accent">Clique para ver detalhes →</p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

/**
 * Uma célula do mapa.
 *
 * Vira botão quando há gasto e alguém para receber o clique; dia sem despesa
 * continua sendo um quadrado inerte, porque não há detalhe atrás dele — um
 * botão que abre uma lista vazia é uma porta para lugar nenhum.
 */
function Celula({
  dia,
  masked,
  intensidade,
  ativa,
  onApontar,
  onSair,
  onSelecionar,
}: {
  dia: DiaDeGasto
  masked: boolean
  intensidade: number
  ativa: boolean
  onApontar: (dia: DiaDeGasto, alvo: HTMLElement) => void
  onSair: () => void
  onSelecionar?: (dia: DiaDeGasto) => void
}) {
  const rotulo = `Dia ${dia.day}, ${formatCurrency(dia.cents, { masked })}, ${dia.count} ${
    dia.count === 1 ? 'transação' : 'transações'
  }`

  const classe = cn(
    'flex h-7 items-center justify-center rounded-xs text-[0.625rem] font-medium tabular-nums',
    DEGRAUS[intensidade],
    // O anel marca qual célula o balão está descrevendo. Só anel, sem mudar o
    // tom de fundo: o tom aqui é dado, e alterá-lo no hover diria que o dia
    // gastou mais do que gastou.
    ativa && 'ring-1 ring-ink/40 ring-inset',
  )

  if (dia.cents <= 0 || !onSelecionar) {
    return (
      <span
        aria-label={dia.cents > 0 ? rotulo : undefined}
        title={dia.cents > 0 ? rotulo : undefined}
        className={classe}
        onMouseEnter={dia.cents > 0 ? (evento) => onApontar(dia, evento.currentTarget) : undefined}
      >
        {dia.day}
      </span>
    )
  }

  return (
    <button
      type="button"
      aria-label={`${rotulo}. Ver detalhes do dia.`}
      onMouseEnter={(evento) => onApontar(dia, evento.currentTarget)}
      // Foco de teclado mostra o mesmo balão: quem chega pelo Tab tem a mesma
      // pergunta de quem chega com o mouse.
      onFocus={(evento) => onApontar(dia, evento.currentTarget)}
      onBlur={onSair}
      onClick={() => {
        // O balão sai junto: ele convidava ao clique, o clique aconteceu, e o
        // ponteiro continua parado em cima da célula por baixo da janela que
        // acabou de abrir.
        onSair()
        onSelecionar(dia)
      }}
      className={cn(classe, 'cursor-pointer transition-shadow duration-150 hover:ring-1 hover:ring-ink/40 hover:ring-inset')}
    >
      {dia.day}
    </button>
  )
}

/** A legenda da rampa: cinco quadradinhos entre "Menos" e "Mais". */
export function HeatmapLegend({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-between text-xs text-muted', className)}>
      <span>Menos</span>
      <span aria-hidden="true" className="flex items-center gap-1">
        {DEGRAUS.map((degrauClasse, i) => (
          <span key={i} className={cn('size-2.5 rounded-[3px]', degrauClasse)} />
        ))}
      </span>
      <span>Mais</span>
    </div>
  )
}
