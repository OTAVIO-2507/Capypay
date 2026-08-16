import { useMemo, useState } from 'react'
import { Icon } from '@/components/Icon'
import { PageHeader } from '@/components/PageHeader'
import { Card } from '@/components/ui/Card'
import { Segmented, Progress, type SegmentOption } from '@/components/ui/Controls'
import { EmptyState } from '@/components/ui/EmptyState'
import { Money } from '@/components/ui/Money'
import { categoryColor } from '@/domain/categories'
import { installmentPurchases, installmentSummary, type Installment } from '@/domain/installments'
import { SeriesSummary } from '@/features/series/SeriesSummary'
import { cn } from '@/lib/cn'
import { formatDayMonthYear, formatMonthLong, monthOf } from '@/lib/date'
import { formatPercent } from '@/lib/format'
import { useCategories, usePrivacy, useTransactions } from '@/store/hooks'

type Aba = 'ongoing' | 'done'

/**
 * As compras parceladas, em andamento e finalizadas.
 *
 * A página existe separada de Transações porque a unidade aqui é a **compra**,
 * não a parcela. Em Transações um notebook em 10x são dez linhas soltas que
 * não somam nada; aqui é uma linha só, com total, pago e o que falta — que é
 * a forma como a pessoa pensa na dívida.
 *
 * Os totais do topo contam só o que está em andamento. Somar o que já foi
 * quitado inflaria o número que a página existe para responder ("quanto eu
 * devo"), e a aba de finalizadas continua ali para quem quiser conferir.
 */
export function InstallmentsPage() {
  const transactions = useTransactions()
  const categories = useCategories()
  const [aba, setAba] = useState<Aba>('ongoing')

  const compras = useMemo(
    () => installmentPurchases(transactions, categories),
    [transactions, categories],
  )
  const resumo = useMemo(() => installmentSummary(compras), [compras])

  const emAndamento = compras.filter((item) => !item.done)
  const finalizadas = compras.filter((item) => item.done)
  const visiveis = aba === 'ongoing' ? emAndamento : finalizadas

  const abas: readonly SegmentOption<Aba>[] = [
    { value: 'ongoing', label: `Em andamento (${emAndamento.length})` },
    { value: 'done', label: `Finalizadas (${finalizadas.length})` },
  ]

  return (
    <>
      <PageHeader
        title="Parcelamentos"
        description="Compras fatiadas, com o que já foi pago e o que ainda falta."
      />

      {compras.length === 0 ? (
        <Card>
          <EmptyState
            icon="credit-card"
            title="Nenhuma compra parcelada"
            description="Ao lançar uma despesa, marque “Repetir lançamento” e escolha Parcelamento para a compra aparecer aqui."
          />
        </Card>
      ) : (
        <div className="flex flex-col gap-5">
          <SeriesSummary
            stats={[
              {
                label: 'Em andamento',
                icon: 'credit-card',
                count: resumo.ongoing,
                countUnit: resumo.ongoing === 1 ? 'compra parcelada' : 'compras parceladas',
              },
              { label: 'Valor total', cents: resumo.totalCents },
              { label: 'Já pago', cents: resumo.paidCents },
              { label: 'Restante', cents: resumo.remainingCents, highlight: true },
            ]}
          >
            {resumo.ongoing > 0 ? (
              <div className="mt-6 border-t border-hairline pt-5">
                <ProgressoGeral progress={resumo.progress} />
                {resumo.lastMonth ? (
                  <p className="mt-4 flex items-center gap-1.5 text-xs text-muted">
                    <Icon name="calendar" size={13} className="shrink-0" />
                    Última parcela em{' '}
                    <strong className="font-medium text-ink">
                      {formatMonthLong(monthOf(resumo.lastMonth))}
                    </strong>
                  </p>
                ) : null}
              </div>
            ) : null}
          </SeriesSummary>

          <Segmented label="Situação" options={abas} value={aba} onChange={setAba} />

          {visiveis.length === 0 ? (
            <Card>
              <EmptyState
                icon="credit-card"
                size="sm"
                title={aba === 'ongoing' ? 'Nada em andamento' : 'Nada finalizado'}
                description={
                  aba === 'ongoing'
                    ? 'Todas as suas compras parceladas já foram quitadas.'
                    : 'Nenhuma compra parcelada chegou ao fim ainda.'
                }
              />
            </Card>
          ) : (
            <ul className="flex flex-col gap-3">
              {visiveis.map((compra) => (
                <li key={compra.seriesId}>
                  <LinhaDeCompra compra={compra} />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </>
  )
}

function ProgressoGeral({ progress }: { progress: number }) {
  const masked = usePrivacy()

  return (
    <>
      <div className="mb-2 flex items-baseline justify-between gap-3">
        <span className="text-xs text-muted">Progresso geral</span>
        <span className="tnum text-xs font-medium text-ink">
          {formatPercent(progress, { masked })} pago
        </span>
      </div>
      <Progress value={progress * 100} label="Progresso geral das compras parceladas" />
    </>
  )
}

function LinhaDeCompra({ compra }: { compra: Installment }) {
  const masked = usePrivacy()
  const [aberta, setAberta] = useState(false)
  const idDaLista = `parcelas-${compra.seriesId}`

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-4">
        <span className="flex min-w-0 items-center gap-3">
          {/*
            A mesma pastilha de Orçamento e do extrato. Esta página nasceu
            antes da cor de categoria existir e ficou no cinza antigo — a
            categoria era a mesma coisa em três telas e se apresentava de dois
            jeitos.
          */}
          <span
            style={{ backgroundColor: categoryColor(compra.categoryId) ?? undefined }}
            className={cn(
              'inline-flex size-9 shrink-0 items-center justify-center rounded-lg',
              categoryColor(compra.categoryId) ? 'text-white' : 'bg-sunken text-faint',
            )}
          >
            <Icon name={compra.icon} size={16} />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">{compra.label}</span>
            <span className="mt-0.5 block truncate text-xs text-muted">
              {compra.paidCount}/{compra.totalCount}x · <Money cents={compra.installmentCents} className="text-xs text-muted" /> por parcela
            </span>
          </span>
        </span>

        <span className="shrink-0 text-right">
          <Money cents={compra.totalCents} emphasis="strong" className="block text-sm" />
          <span className="mt-0.5 block text-xs text-muted">total</span>
        </span>
      </div>

      <div>
        <Progress value={compra.progress * 100} label={`Progresso de ${compra.label}`} />
        <div className="mt-2 flex items-baseline justify-between gap-3 text-xs text-muted">
          <span>
            {compra.done ? (
              'Quitada'
            ) : (
              <>
                Faltam <Money cents={compra.remainingCents} className="text-xs text-muted" />
              </>
            )}
          </span>
          <span className="tnum">{formatPercent(compra.progress, { masked })}</span>
        </div>
      </div>

      {/*
        As parcelas ficam fechadas por padrão. Uma compra em 12x abriria doze
        linhas, e três compras dariam trinta e seis — a página deixaria de
        responder "quanto eu devo" para virar um extrato. Quem abre está
        conferindo uma cobrança específica contra a fatura, que é outra tarefa
        e acontece bem menos.
      */}
      <div>
        <button
          type="button"
          onClick={() => setAberta((valor) => !valor)}
          aria-expanded={aberta}
          aria-controls={idDaLista}
          className="inline-flex items-center gap-1.5 rounded-full text-xs font-medium text-muted transition-colors duration-150 hover:text-ink"
        >
          <Icon
            name="chevron-down"
            size={14}
            className={cn('transition-transform duration-200', aberta && 'rotate-180')}
          />
          {aberta ? 'Ocultar parcelas' : `Ver as ${compra.totalCount} parcelas`}
        </button>

        {aberta ? (
          <ul id={idDaLista} className="mt-3 flex flex-col divide-y divide-hairline rounded-md bg-sunken px-3">
            {compra.parcels.map((parcela) => (
              <li
                key={parcela.id}
                className="flex items-center justify-between gap-3 py-2.5 text-xs"
              >
                <span className="flex items-center gap-2.5">
                  {/*
                    Paga e em aberto se distinguem pela **forma** antes de tudo:
                    círculo cheio com o visto, ou círculo vazio. A cor não entra
                    — já paga não é receita, e pintar de verde diria que é.
                  */}
                  <Icon
                    name={parcela.paid ? 'check' : 'circle-dashed'}
                    size={13}
                    className={cn('shrink-0', parcela.paid ? 'text-ink' : 'text-faint')}
                  />
                  <span className={cn('tnum', parcela.paid ? 'text-muted' : 'font-medium text-ink')}>
                    {parcela.index}/{compra.totalCount}
                  </span>
                </span>

                <span className="flex items-center gap-4">
                  <span className="tnum text-muted">{formatDayMonthYear(parcela.date)}</span>
                  <Money
                    cents={parcela.amountCents}
                    className={cn('w-24 text-right text-xs', parcela.paid && 'text-muted')}
                  />
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </Card>
  )
}
