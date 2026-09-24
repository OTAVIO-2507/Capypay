import { useMemo, useState } from 'react'
import { Icon } from '@/components/Icon'
import { invoiceHistory } from '@/domain/invoices'
import type { Account, Transaction } from '@/domain/types'
import { cn } from '@/lib/cn'
import { formatMonthLong, formatMonthShort, shiftMonth, type MonthKey } from '@/lib/date'
import { formatCurrency } from '@/lib/format'
import { usePrivacy } from '@/store/hooks'

/** Quantas faturas o gráfico mostra de uma vez. */
const MESES = 6

/**
 * As faturas dos últimos meses, em barras.
 *
 * Só o gráfico, como na referência. As compras de uma fatura moram no painel
 * de detalhe do cartão, que abre pelo "Ver detalhes" — repetir a lista aqui
 * embaixo punha a mesma coisa em dois lugares da mesma tela.
 *
 * A fatura escolhida é sempre a barra da direita, em tinta cheia; as cinco
 * anteriores ficam em cinza, para comparação. Voltar um mês desloca a janela
 * inteira, e não só o destaque — é o jeito de comparar qualquer fatura com as
 * cinco que vieram antes dela. Avançar para depois da fatura aberta não existe:
 * não há fatura futura para mostrar.
 *
 * As barras são botões. Clicar numa escolhe aquela fatura, e o teclado chega
 * nelas pela ordem dos meses, com o valor no nome acessível.
 */
export function InvoiceHistory({
  cards,
  transactions,
  currentMonth,
}: {
  cards: readonly Account[]
  transactions: readonly Transaction[]
  /** O mês da fatura aberta hoje — o limite do "próximo". */
  currentMonth: MonthKey
}) {
  const masked = usePrivacy()
  const [escolhido, setEscolhido] = useState<MonthKey>(currentMonth)

  const historico = useMemo(
    () => invoiceHistory(cards, transactions, escolhido, MESES),
    [cards, transactions, escolhido],
  )
  const maior = Math.max(...historico.map((item) => item.cents), 0)
  const topo = escalaNiceDe(maior)
  const marcas = [4, 3, 2, 1, 0].map((passo) => (topo / 4) * passo)

  return (
    <section className="rounded-lg border border-hairline bg-sheet p-5 sm:p-6" aria-labelledby="faturas-titulo">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 id="faturas-titulo" className="flex items-center gap-2.5 text-[0.9375rem] font-semibold text-ink">
          <span aria-hidden className="inline-flex size-8 items-center justify-center rounded-md bg-sunken text-muted">
            <Icon name="chart-column" size={16} />
          </span>
          Faturas anteriores
        </h2>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setEscolhido((mes) => shiftMonth(mes, -1))}
            aria-label={`Fatura anterior, ${formatMonthLong(shiftMonth(escolhido, -1))}`}
            className="inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-sunken hover:text-ink"
          >
            <Icon name="chevron-left" size={16} />
          </button>
          <span className="inline-flex items-center gap-2 rounded-full bg-sunken px-3.5 py-2 text-[0.8125rem] font-semibold text-ink">
            <Icon name="calendar" size={14} className="text-muted" />
            {formatMonthLong(escolhido)}
          </span>
          <button
            type="button"
            onClick={() => setEscolhido((mes) => shiftMonth(mes, 1))}
            disabled={escolhido >= currentMonth}
            aria-label={`Próxima fatura, ${formatMonthLong(shiftMonth(escolhido, 1))}`}
            className="inline-flex size-9 items-center justify-center rounded-full text-muted transition-colors duration-150 hover:bg-sunken hover:text-ink disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <Icon name="chevron-right" size={16} />
          </button>
        </div>
      </div>

      {/* O gráfico: eixo à esquerda, uma coluna por fatura. */}
      <div className="mt-6 flex gap-3">
        <div aria-hidden className="flex h-44 w-10 shrink-0 flex-col justify-between pb-6 text-right text-[0.6875rem] text-faint">
          {marcas.map((valor) => (
            <span key={valor} className="tnum leading-none">
              {masked ? '•' : Math.round(valor / 100).toLocaleString('pt-BR')}
            </span>
          ))}
        </div>
        <ol className="grid flex-1 grid-cols-6 gap-2 sm:gap-4">
          {historico.map((item) => {
            const ativo = item.month === escolhido
            const altura = topo === 0 ? 0 : (item.cents / topo) * 100
            return (
              <li key={item.month} className="flex flex-col">
                <button
                  type="button"
                  onClick={() => setEscolhido(item.month)}
                  aria-pressed={ativo}
                  aria-label={`Fatura de ${formatMonthLong(item.month)}: ${formatCurrency(item.cents, { masked })}`}
                  // Sem a lista embaixo, o valor exato de cada fatura aparece ao
                  // passar o mouse; o leitor de tela já o tem no nome acessível.
                  title={`${formatMonthLong(item.month)}: ${formatCurrency(item.cents, { masked })}`}
                  className="group flex h-38 flex-col justify-end"
                >
                  <span
                    className={cn(
                      'block w-full rounded-t-sm transition-colors duration-150',
                      ativo ? 'bg-ink' : 'bg-hairline-strong group-hover:bg-muted',
                    )}
                    // Um traço mínimo para a fatura zerada, e não barra
                    // nenhuma: o mês existe no eixo, só não gastou.
                    style={{ height: `${Math.max(altura, item.cents > 0 ? 2 : 0.8)}%` }}
                  />
                </button>
                <span
                  aria-hidden
                  className={cn('mt-2 text-center text-xs', ativo ? 'font-semibold text-ink' : 'text-muted')}
                >
                  {formatMonthShort(item.month)}
                </span>
              </li>
            )
          })}
        </ol>
      </div>
    </section>
  )
}

/**
 * O topo do eixo: o maior valor arredondado para cima num número redondo, para
 * as quatro marcas saírem inteiras ("260, 195, 130, 65" e não "247,3").
 */
function escalaNiceDe(maiorCents: number): number {
  if (maiorCents <= 0) return 0
  const reais = maiorCents / 100
  const passo = 10 ** Math.floor(Math.log10(reais)) / 2
  const topo = Math.ceil(reais / passo) * passo
  // Divisível por quatro, para as marcas intermediárias também serem inteiras.
  return Math.ceil(topo / 4) * 4 * 100
}
