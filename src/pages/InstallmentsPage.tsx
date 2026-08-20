import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Segmented, Progress, type SegmentOption } from '@/components/ui/Controls'
import { EmptyState } from '@/components/ui/EmptyState'
import { Money } from '@/components/ui/Money'
import { categoryColor } from '@/domain/categories'
import { installmentPurchases, installmentSummary, type Installment } from '@/domain/installments'
import { BrandMark } from '@/features/series/BrandMark'
import { SeriesRowMenu } from '@/features/series/SeriesRowMenu'
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
  const navigate = useNavigate()
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
          {/*
            O vazio aqui tem duas causas opostas, e a mensagem antiga só
            descrevia uma. Quem nunca cadastrou parcelamento precisa saber por
            onde se cadastra; quem importou do banco e não vê nada quase sempre
            tem as compras do outro lado, classificadas como assinatura —
            porque sem a parcela declarada as duas têm a mesma cara. Mandar
            essa pessoa para o formulário é mandá-la para o lugar errado.
          */}
          <EmptyState
            icon="credit-card"
            title="Nenhuma compra parcelada"
            description="Ao lançar uma despesa, marque “Repetir lançamento” e escolha Parcelamento. Se você importou do banco e a compra foi parar em Assinaturas, o menu da linha de lá tem “É parcelamento”."
            action={
              <Button
                size="sm"
                variant="quiet"
                icon="repeat"
                onClick={() => navigate('/assinaturas')}
              >
                Ver assinaturas
              </Button>
            }
          />
        </Card>
      ) : (
        /*
          A faixa de números em cima, a lista inteira embaixo.

          O resumo era uma coluna fixa de um terço, presa enquanto a lista
          rolava. A intenção era boa — ele é a resposta da página — mas o
          preço era alto: "já pago" e "restante" ficavam empilhados numa
          coluna estreita, e comparar os dois exigia descer e voltar, quando
          essa comparação é a leitura inteira. Em linha eles entram de uma vez.

          A lista, que ganhou os dois terços de volta, é onde a diferença
          aparece: cada compra tem título, contagem de parcelas, valor, barra
          e data de fim, e nada disso cabia bem em 60% da tela.
        */
        <div className="flex flex-col gap-5">
          <SeriesSummary
            stats={[
              {
                label: 'Em andamento',
                icon: 'credit-card',
                count: resumo.ongoing,
                countUnit: resumo.ongoing === 1 ? 'compra' : 'compras',
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
                  <p className="mt-4 flex items-center gap-1.5 border-t border-hairline pt-4 text-xs text-muted">
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

          {/*
            As abas moram aqui, e não no cabeçalho, porque filtram a lista que
            vem logo abaixo e não a faixa que vem logo acima. `w-fit` porque
            `Segmented` distribui os botões em `flex-1`: solto numa página de
            1400px, dois botões viram dois botões de 700px.
          */}
          <div className="w-fit">
            <Segmented label="Situação" options={abas} value={aba} onChange={setAba} />
          </div>

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

/** Acima disto o segmento fica mais fino que o vão e a barra vira listra. */
const MAXIMO_DE_SEGMENTOS = 24

/**
 * A barra de uma compra, com um segmento por parcela.
 *
 * Uma barra contínua diz a proporção e perde a contagem, que numa compra
 * parcelada é metade da resposta: "60%" não é o que a pessoa pensa, "faltam
 * quatro" é. Segmentada, as duas leituras aparecem de uma vez, e ainda ligam a
 * barra à lista que abre logo abaixo — cada bloco é uma linha de lá.
 *
 * Acima de 24 parcelas ela volta a ser contínua. Um segmento mais fino que o
 * vão entre eles deixa de ser contável, e aí a divisão só atrapalha o que a
 * barra contínua já fazia bem.
 */
function BarraDeParcelas({ compra }: { compra: Installment }) {
  const rotulo = `${compra.label}: ${compra.paidCount} de ${compra.totalCount} parcelas pagas`

  if (compra.totalCount > MAXIMO_DE_SEGMENTOS) {
    return <Progress value={compra.progress * 100} label={rotulo} />
  }

  return (
    <div
      role="progressbar"
      aria-valuenow={compra.paidCount}
      aria-valuemin={0}
      aria-valuemax={compra.totalCount}
      aria-label={rotulo}
      className="flex h-2 w-full gap-1"
    >
      {compra.parcels.map((parcela) => (
        <span
          key={parcela.id}
          aria-hidden="true"
          className={cn(
            'h-full flex-1 rounded-full transition-colors duration-300',
            parcela.paid ? 'bg-ink' : 'bg-sunken',
          )}
        />
      ))}
    </div>
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
            A mesma marca de Assinaturas: uma compra parcelada costuma vir de
            uma loja com nome, e reconhecê-la aqui é o que separa "dorinhos -
            loja 42 - d guarulhos bra" de uma linha que só se lê soletrando.
            Sem marca conhecida, volta a pastilha da categoria.
          */}
          <BrandMark
            label={compra.label}
            fallbackIcon={compra.icon}
            fallbackColor={categoryColor(compra.categoryId)}
          />
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium text-ink">{compra.label}</span>
            <span className="mt-0.5 block truncate text-xs text-muted">
              {compra.paidCount} de {compra.totalCount} parcelas ·{' '}
              <Money cents={compra.installmentCents} className="text-xs text-muted" /> cada
            </span>
          </span>
        </span>

        {/*
          A linha lidera pelo que **falta**, e não pelo total.

          O total é contexto — foi decidido na compra e não muda. A pergunta da
          página é "quanto eu ainda devo", e era ela que aparecia pequena, no
          rodapé, enquanto o número já resolvido ocupava o lugar de destaque.
          Quitada, o que sobra é zero e o total volta a ser a informação: aí ele
          sobe.
        */}
        <span className="flex shrink-0 items-center gap-1">
          <span className="text-right">
            {compra.done ? (
              <>
                <Money cents={compra.totalCents} emphasis="strong" className="block text-sm" />
                <span className="mt-0.5 block text-xs text-muted">total pago</span>
              </>
            ) : (
              <>
                <Money cents={compra.remainingCents} emphasis="strong" className="block text-sm" />
                <span className="mt-0.5 block text-xs text-muted">
                  de <Money cents={compra.totalCents} className="text-xs text-muted" />
                </span>
              </>
            )}
          </span>
          <SeriesRowMenu
            seriesId={compra.seriesId}
            label={compra.label}
            kind="installment"
            charges={compra.totalCount}
          />
        </span>
      </div>

      <div>
        <BarraDeParcelas compra={compra} />
        <div className="mt-2 flex items-baseline justify-between gap-3 text-xs text-muted">
          {/*
            A data de fim é o fato mais interessante de um parcelamento depois
            de quanto falta: é quando o mês volta a ser inteiro. Ela existia só
            no resumo do topo, somada entre todas as compras, e ali não responde
            por nenhuma delas.
          */}
          <span className="flex items-center gap-1.5">
            <Icon name="calendar" size={12} className="shrink-0" />
            {compra.done ? 'Quitada em ' : 'Termina em '}
            <span className="text-ink">{formatMonthLong(monthOf(compra.lastDate))}</span>
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
          <div id={idDaLista} className="mt-3 rounded-md bg-sunken px-3 py-1">
            {/*
              O cabeçalho responde de onde a compra veio e de quando até quando
              ela pega: a categoria e as datas das pontas. São os fatos que a
              linha fechada não tem espaço para dizer e que quem abre está
              justamente procurando. A pastilha de categoria é a mesma de
              Orçamento e do extrato — a mesma coisa se apresenta igual em toda
              parte.
            */}
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 border-b border-hairline py-2.5 text-xs text-muted">
              <span className="flex items-center gap-1.5 text-ink">
                <span
                  style={{ backgroundColor: categoryColor(compra.categoryId) ?? undefined }}
                  className={cn(
                    'size-2 shrink-0 rounded-full',
                    categoryColor(compra.categoryId) ? '' : 'bg-faint',
                  )}
                />
                {compra.categoryName}
              </span>
              <span aria-hidden="true">·</span>
              <span>
                1ª em <span className="text-ink">{formatDayMonthYear(compra.parcels[0].date)}</span>
              </span>
              <span aria-hidden="true">·</span>
              <span>
                última em <span className="text-ink">{formatDayMonthYear(compra.lastDate)}</span>
              </span>
            </div>

            <ul className="flex flex-col divide-y divide-hairline">
              {compra.parcels.map((parcela) => {
                // A próxima em aberto é a única parcela sobre a qual a pessoa
                // ainda pode fazer alguma coisa. Ela ganha o rótulo; as outras
                // em aberto são só futuro, e futuro em série não tem urgência.
                const proxima = !parcela.paid && parcela.date === compra.next

                return (
                  <li
                    key={parcela.id}
                    className="flex items-center justify-between gap-3 py-2.5 text-xs"
                  >
                    <span className="flex min-w-0 items-center gap-2.5">
                      {/*
                        Paga e em aberto se distinguem pela **forma** antes de
                        tudo: círculo cheio com o visto, ou círculo vazio. A cor
                        não entra — já paga não é receita, e pintar de verde
                        diria que é.
                      */}
                      <Icon
                        name={parcela.paid ? 'check' : 'circle-dashed'}
                        size={13}
                        className={cn('shrink-0', parcela.paid ? 'text-ink' : 'text-faint')}
                      />
                      {/*
                        A projetada é desenhada mais apagada porque a diferença
                        é real: a parcela importada pode ser conferida contra a
                        fatura, e esta é uma conta feita a partir do "3 de 8".
                        Mostrá-las iguais convidaria a conferir uma previsão
                        como se fosse extrato.
                      */}
                      <span
                        className={cn(
                          'tnum shrink-0',
                          parcela.paid ? 'text-muted' : 'font-medium text-ink',
                        )}
                      >
                        {parcela.index}/{compra.totalCount}
                      </span>
                      {proxima ? (
                        <span className="truncate rounded-full bg-block px-2 py-0.5 text-xs font-medium text-block-ink">
                          Próxima
                        </span>
                      ) : null}
                      {parcela.projected ? (
                        <span className="shrink-0 text-xs text-faint">prevista</span>
                      ) : null}
                    </span>

                    <span className="flex shrink-0 items-center gap-4">
                      <span className={cn('tnum', parcela.projected ? 'text-faint' : 'text-muted')}>
                        {formatDayMonthYear(parcela.date)}
                      </span>
                      <Money
                        cents={parcela.amountCents}
                        className={cn(
                          'w-24 text-right text-xs',
                          parcela.projected ? 'text-faint' : parcela.paid ? 'text-muted' : '',
                        )}
                      />
                    </span>
                  </li>
                )
              })}
            </ul>
          </div>
        ) : null}
      </div>
    </Card>
  )
}
