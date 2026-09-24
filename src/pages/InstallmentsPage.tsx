import { useMemo, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { NarrowColumn } from '@/components/NarrowColumn'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge, Segmented, Progress, type SegmentOption } from '@/components/ui/Controls'
import type { Account } from '@/domain/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { ItemRow, MetaDot } from '@/components/ui/ItemRow'
import { Money } from '@/components/ui/Money'
import { categoryColor } from '@/domain/categories'
import { installmentPurchases, installmentSummary, type Installment } from '@/domain/installments'
import { BankTag } from '@/features/dashboard/BankTag'
import { BrandMark } from '@/features/series/BrandMark'
import { SeriesRowMenu } from '@/features/series/SeriesRowMenu'
import { SeriesSummary } from '@/features/series/SeriesSummary'
import { cn } from '@/lib/cn'
import { formatDayMonthYear, formatMonthLong, monthOf } from '@/lib/date'
import { formatPercent } from '@/lib/format'
import { useAccounts, useCategories, usePrivacy, useTransactions } from '@/store/hooks'

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
  const accounts = useAccounts()
  const [aba, setAba] = useState<Aba>('ongoing')
  const contaPorId = useMemo(() => new Map(accounts.map((item) => [item.id, item])), [accounts])

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
    <NarrowColumn>
      {/*
        Sem cabeçalho visível, como na referência: a aba de seção logo acima já
        diz onde se está. O título continua existindo para quem navega por
        cabeçalhos.
      */}
      <h1 className="sr-only">Parcelamentos</h1>

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
              {
                // "Estimado" quando alguma compra em andamento tem total
                // calculado, e não somado: o número de cima herda a incerteza
                // da parcela que entrou nele.
                label: emAndamento.some((compra) => compra.estimated)
                  ? 'Valor total (estimado)'
                  : 'Valor total',
                cents: resumo.totalCents,
              },
              { label: 'Já pago', cents: resumo.paidCents, tone: 'income' },
              { label: 'Restante', cents: resumo.remainingCents, tone: 'attention' },
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
            <Segmented
              label="Situação"
              variant="tint"
              options={abas}
              value={aba}
              onChange={setAba}
            />
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
                  <LinhaDeCompra
                    compra={compra}
                    conta={compra.accountId ? contaPorId.get(compra.accountId) : undefined}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </NarrowColumn>
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

/**
 * A unidade das parcelas pelo intervalo entre as duas primeiras: "/mês" quase
 * sempre, mas o formulário deixa cadastrar parcela semanal ou anual, e dizer
 * "/mês" sobre elas seria errar o valor por quatro ou por doze.
 */
function porParcela(compra: Installment): string {
  const [a, b] = compra.parcels
  if (!a || !b) return '/mês'
  const dias = (Date.parse(b.date) - Date.parse(a.date)) / 86_400_000
  if (dias <= 11) return '/semana'
  if (dias >= 200) return '/ano'
  return '/mês'
}

function LinhaDeCompra({ compra, conta }: { compra: Installment; conta: Account | undefined }) {
  const masked = usePrivacy()
  const [aberta, setAberta] = useState(false)
  const idDoDetalhe = `parcelas-${compra.seriesId}`

  return (
    <Card flush>
      <div className="flex flex-col gap-3 p-6">
        <ItemRow
          size="lg"
          className="py-0"
          media={
            /*
              A mesma marca de Assinaturas: uma compra parcelada costuma vir de
              uma loja com nome, e reconhecê-la aqui é o que separa "dorinhos -
              loja 42 - d guarulhos bra" de uma linha que só se lê soletrando.
              Sem marca conhecida, volta a pastilha da categoria.
            */
            <BrandMark
              label={compra.label}
              fallbackIcon={compra.icon}
              fallbackColor={categoryColor(compra.categoryId)}
              size={70}
              className="rounded-lg"
            />
          }
          title={compra.label}
          badge={
            /*
              O estado vai em palavra, e não só na cor da pastilha: "Quitada" é
              a única coisa nesta linha que muda o significado de todos os
              números ao lado dela.
            */
            <Badge tone={compra.done ? 'quiet' : 'accent'}>
              {compra.done ? 'Quitada' : 'Ativo'}
            </Badge>
          }
          meta={
            <>
              <span className="tnum">
                {compra.paidCount}/{compra.totalCount}x
              </span>
              <MetaDot />
              <span>
                <Money cents={compra.installmentCents} className="text-muted" />
                {porParcela(compra)}
              </span>
              {conta ? (
                <>
                  <MetaDot />
                  <BankTag account={conta} size="sm" />
                </>
              ) : null}
            </>
          }
          /*
            A linha lidera pelo que **falta**, e não pelo total.

            O total é contexto — foi decidido na compra e não muda. A pergunta
            da página é "quanto eu ainda devo", e era ela que aparecia pequena,
            no rodapé, enquanto o número já resolvido ocupava o lugar de
            destaque. Quitada, o que sobra é zero e o total volta a ser a
            informação: aí ele sobe.
          */
          value={
            <Money cents={compra.done ? compra.totalCents : compra.remainingCents} />
          }
          caption={compra.done ? 'total pago' : 'restante'}
          actions={
            <SeriesRowMenu
              seriesId={compra.seriesId}
              label={compra.label}
              kind="installment"
              charges={compra.totalCount}
            />
          }
          /*
            A seta que abre o detalhe mora no fim da linha, como no produto de
            referência, e sempre à vista. Ela já foi um "Ver as 10 parcelas"
            embaixo da barra, e o detalhe ganhou mais que parcelas: os quatro
            números da compra vêm junto, e o rótulo antigo prometia menos do
            que a porta abre.
          */
          trailing={
            <button
              type="button"
              onClick={() => setAberta((valor) => !valor)}
              aria-expanded={aberta}
              aria-controls={idDoDetalhe}
              aria-label={aberta ? `Fechar o detalhe de ${compra.label}` : `Ver o detalhe de ${compra.label}`}
              className={cn(
                'inline-flex size-9 items-center justify-center rounded-full transition-colors duration-150',
                aberta ? 'bg-sunken text-ink' : 'text-muted hover:bg-sunken hover:text-ink',
              )}
            >
              <Icon
                name="chevron-down"
                size={16}
                className={cn('transition-transform duration-200', aberta && 'rotate-180')}
              />
            </button>
          }
        />

        <div>
          <BarraDeParcelas compra={compra} />
          <div className="mt-2 flex items-baseline justify-between gap-3 text-xs text-muted">
            {/*
              A data de fim é o fato mais interessante de um parcelamento depois
              de quanto falta: é quando o mês volta a ser inteiro.
            */}
            <span className="flex items-center gap-1.5">
              <Icon name="calendar" size={12} className="shrink-0" />
              {compra.done ? 'Quitada em ' : 'Termina em '}
              <span className="text-ink">{formatMonthLong(monthOf(compra.lastDate))}</span>
            </span>
            <span className="tnum">{formatPercent(compra.progress, { masked })}</span>
          </div>
        </div>
      </div>

      {/*
        O detalhe fica fechado por padrão. Uma compra em 12x abriria doze
        linhas, e três compras dariam trinta e seis — a página deixaria de
        responder "quanto eu devo" para virar um extrato. Quem abre está
        conferindo uma compra específica, que é outra tarefa e acontece bem
        menos.
      */}
      {aberta ? (
        <div id={idDoDetalhe} className="flex flex-col gap-5 border-t border-hairline p-6">
          <DetalheDaCompra compra={compra} />
        </div>
      ) : null}
    </Card>
  )
}

/**
 * O que a compra aberta mostra: os quatro números dela, de onde ela veio, e
 * as parcelas.
 *
 * Os quatro números são os mesmos do resumo do topo, só que de uma compra.
 * O topo soma todas; aqui a pessoa confere uma, e "quanto falta nesta" não se
 * tira do total geral.
 */
function DetalheDaCompra({ compra }: { compra: Installment }) {
  return (
    <>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Numero rotulo={compra.estimated ? 'Total estimado' : 'Total'}>
          <Money cents={compra.totalCents} className="text-ink" />
        </Numero>
        <Numero rotulo="Pago">
          <Money cents={compra.paidCents} className="text-income" />
        </Numero>
        <Numero rotulo="Restante">
          <Money
            cents={compra.remainingCents}
            // Quitada, o restante é zero, e zero em âmbar seria alarme sobre
            // nada: ele volta ao cinza.
            className={compra.remainingCents > 0 ? 'text-attention' : 'text-muted'}
          />
        </Numero>
        <Numero rotulo="Última">
          <span className="text-ink">{formatMonthLong(monthOf(compra.lastDate))}</span>
        </Numero>
      </dl>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted">
        <span className="inline-flex items-center gap-1.5 rounded-sm bg-sunken px-2.5 py-1.5 font-medium text-ink">
          <span
            aria-hidden
            style={{ backgroundColor: categoryColor(compra.categoryId) ?? undefined }}
            className={cn(
              'size-2 shrink-0 rounded-full',
              categoryColor(compra.categoryId) ? '' : 'bg-faint',
            )}
          />
          {compra.categoryName}
        </span>
        {/*
          O início, e não a data da compra. A data da compra é outra coisa —
          numa compra de cartão ela cai antes da primeira fatura — e o
          histórico não a guarda: o banco a informa na importação, mas ela não
          é gravada ainda. Mostrar a primeira parcela com o nome de "data da
          compra" seria afirmar um dado que não temos.
        */}
        <span>
          Início do parcelamento:{' '}
          <span className="text-ink">{formatDayMonthYear(compra.parcels[0].date)}</span>
        </span>
        {compra.estimated ? (
          <span className="inline-flex items-center gap-1.5">
            <Icon name="info" size={13} className="shrink-0" />
            Total da compra estimado
          </span>
        ) : null}
      </div>

      {/*
        Rolagem própria acima de oito parcelas, como na referência: uma compra
        em 24x abriria uma coluna de vinte e quatro faixas e empurraria as
        outras compras para fora da tela. Rolável, a região precisa de foco
        por teclado e de nome, senão quem não usa mouse não desce nela.
      */}
      <ul
        tabIndex={compra.parcels.length > 8 ? 0 : undefined}
        aria-label={`Parcelas de ${compra.label}`}
        className={cn(
          'flex flex-col gap-2',
          compra.parcels.length > 8 && '-mr-2 max-h-[27rem] overflow-y-auto pr-2',
        )}
      >
        {compra.parcels.map((parcela) => {
          // A próxima em aberto é a única parcela sobre a qual a pessoa ainda
          // pode fazer alguma coisa. Ela ganha o rótulo; as outras em aberto
          // são só futuro, e futuro em série não tem urgência.
          const proxima = !parcela.paid && parcela.date === compra.next

          return (
            <li
              key={parcela.id}
              className={cn(
                'flex items-center justify-between gap-3 rounded-md px-4 py-3',
                parcela.paid ? 'bg-accent/8' : 'bg-sunken',
              )}
            >
              <span className="flex min-w-0 items-center gap-3">
                {/*
                  Paga e em aberto se distinguem pela **forma** antes da cor:
                  círculo com o visto, ou círculo vazio. O verde confirma, e é
                  o mesmo verde de "Pago" nos quatro números logo acima — a
                  parcela paga é uma fatia daquele número.
                */}
                <Icon
                  name={parcela.paid ? 'circle-check' : 'circle'}
                  size={16}
                  className={cn('shrink-0', parcela.paid ? 'text-accent' : 'text-muted')}
                />
                <span className="tnum shrink-0 text-[0.8125rem] font-medium text-ink">
                  {parcela.index}/{compra.totalCount}
                  <span className="sr-only">{parcela.paid ? ', paga' : ', em aberto'}</span>
                </span>
                {proxima ? (
                  <span className="truncate rounded-full bg-block px-2 py-0.5 text-xs font-medium text-block-ink">
                    Próxima
                  </span>
                ) : null}
                {/*
                  A projetada leva a palavra porque a diferença é real: a
                  parcela importada pode ser conferida contra a fatura, e esta
                  é uma conta feita a partir do "3 de 8".
                */}
                {parcela.projected ? (
                  <span className="shrink-0 text-xs text-faint">prevista</span>
                ) : null}
              </span>

              <span className="flex shrink-0 items-center gap-6">
                <span className="tnum text-xs text-muted">{formatDayMonthYear(parcela.date)}</span>
                <Money
                  cents={parcela.amountCents}
                  className={cn(
                    'w-24 text-right text-[0.8125rem] font-semibold',
                    parcela.paid ? 'text-accent' : 'text-ink',
                  )}
                />
              </span>
            </li>
          )
        })}
      </ul>
    </>
  )
}

function Numero({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-md bg-sunken px-4 py-3.5">
      <dt className="text-xs text-muted">{rotulo}</dt>
      <dd className="mt-1.5 truncate text-lg leading-tight font-bold">{children}</dd>
    </div>
  )
}
