import { Icon } from '@/components/Icon'
import { Logo } from '@/components/Logo'
import { Aura } from '@/components/ui/Aura'
import { Card, CardFooter } from '@/components/ui/Card'
import { Money } from '@/components/ui/Money'
import type { MonthInsight } from '@/domain/selectors'
import { cn } from '@/lib/cn'
import { formatDayMonthYear } from '@/lib/date'
import type { IsoDate } from '@/lib/date'

/**
 * O painel que abre a Visão geral: a leitura do mês, em uma frase.
 *
 * A frase é **calculada**, não gerada — `monthInsight`, em `domain/selectors`.
 * Isso importa para o que ela pode prometer: ela nunca vai errar um número
 * nem inventar uma tendência, porque não tem como. O preço é que ela diz
 * poucas coisas, e sempre as mesmas poucas coisas.
 *
 * A chamada no topo é sempre do acento, e não do tom da notícia. Ela é um
 * convite — "vamos olhar" —, e um convite não muda de humor conforme o mês foi
 * bom ou ruim. Quem carrega o humor é a frase calculada logo abaixo, e ela
 * carrega em tinta comum: a primeira versão pintava essa frase inteira de
 * vermelho, e um parágrafo colorido não acrescenta leitura nenhuma — tira o
 * sossego do texto. O tom aparece onde desambigua um número: na pastilha de
 * variação.
 *
 * Os três números embaixo repetem coisas que existem em outros painéis, e
 * repetir é o ponto: quem abre o app às pressas lê este card e fecha. Os
 * outros painéis são para quem ficou.
 */
export function InsightPanel({
  insight,
  today,
  chamada,
  className,
}: {
  insight: MonthInsight
  today: IsoDate
  /** A saudação do topo. Muda com a hora, não com o resultado do mês. */
  chamada: string
  className?: string
}) {
  return (
    <Card className={cn('relative isolate flex flex-col overflow-hidden', className)}>
      {/*
        O fundo abstrato do card — manchas de luz, como no produto de
        referência. Já foi a marca do produto em tamanho gigante; virou
        abstrato por pedido explícito, e o desenho da capivara continua onde
        ela identifica de fato: no rail, no rodapé deste card e no favicon.
      */}
      <Aura animada className="-z-10" />
      <p className="text-xl leading-tight font-semibold tracking-[-0.02em] text-accent sm:text-2xl">
        {chamada}
      </p>
      <p className="mt-3 text-[0.9375rem] leading-relaxed text-ink">{insight.message}</p>

      <div className="mt-auto grid grid-cols-2 gap-3 pt-8 sm:grid-cols-3">
        {/* Algarismos proporcionais: a pastilha é um número solto, sem coluna
            com que alinhar, e o tabular só abre buracos entre os dígitos. */}
        <Tile label="Gasto no mês" value={<Money cents={insight.spentCents} tabular={false} />} />
        <Tile
          label="Vs. mês anterior"
          value={
            insight.changeRatio === null ? (
              <span className="text-muted">—</span>
            ) : (
              <span
                className={cn(
                  'inline-flex items-center gap-1.5',
                  insight.changeRatio > 0 ? 'text-expense' : 'text-income',
                )}
              >
                <Icon
                  name={insight.changeRatio > 0 ? 'trending-up' : 'trending-down'}
                  size={15}
                  strokeWidth={2.25}
                  aria-hidden="true"
                />
                {Math.abs(Math.round(insight.changeRatio * 100))}%
              </span>
            )
          }
        />
        <Tile
          label="Maior gasto"
          className="col-span-2 sm:col-span-1"
          value={
            insight.topCategory ? (
              <span className="inline-flex min-w-0 items-center gap-2">
                <Icon name={insight.topCategory.icon} size={16} className="shrink-0" />
                <span className="truncate">{insight.topCategory.label}</span>
              </span>
            ) : (
              <span className="text-muted">—</span>
            )
          }
        />
      </div>

      <CardFooter>
        <span className="flex items-center gap-2">
          <Logo decorative size={16} />
          CapyPay
        </span>
        <span className="flex items-center gap-1.5">
          <Icon name="calendar" size={12} aria-hidden="true" />
          {formatDayMonthYear(today)}
        </span>
      </CardFooter>
    </Card>
  )
}

/**
 * A pastilha de estatística: micro-rótulo em caixa alta e o valor abaixo.
 *
 * Fica na superfície rebaixada, e não em outro painel: painel dentro de painel
 * é a única regra de superfície que o sistema nunca abriu exceção para.
 */
function Tile({
  label,
  value,
  className,
}: {
  label: string
  value: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0 rounded-sm bg-sunken px-3.5 py-3', className)}>
      <p className="truncate text-[0.625rem] font-medium tracking-[0.06em] text-muted uppercase">
        {label}
      </p>
      <p className="mt-1.5 truncate text-lg font-bold tracking-[-0.02em] text-ink">{value}</p>
    </div>
  )
}
