import { useMemo, useState } from 'react'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { planSeriesForHistory } from '@/domain/detectSeries'
import { useFinanceStore } from '@/store/financeStore'
import { useTransactions } from '@/store/hooks'

/**
 * Reconhece parcelamentos e assinaturas no histórico que já existe.
 *
 * A detecção normal roda durante a importação, e só alcança o que passa por
 * ela. Quem importou antes de ela existir ficou sem caminho de volta:
 * reimportar não resolve, porque a deduplicação reconhece tudo como já
 * existente — e ela está certa em reconhecer.
 *
 * Fica em Ajustes, e não numa varredura automática ao abrir o aplicativo, por
 * uma razão de confiança: isto reescreve lançamentos que já estavam gravados.
 * Uma correção em massa que acontece sozinha, sem ninguém pedir, é
 * indistinguível de um defeito para quem abre a tela e vê o histórico
 * diferente de ontem.
 */
export function DetectSeriesCard() {
  const transactions = useTransactions()
  const applySeriesPlans = useFinanceStore((state) => state.applySeriesPlans)
  const [aplicado, setAplicado] = useState(false)

  const planos = useMemo(() => planSeriesForHistory(transactions), [transactions])

  const parcelamentos = planos.filter((plano) => plano.kind === 'installment')
  const assinaturas = planos.filter((plano) => plano.kind === 'subscription')
  const alcancados = planos.reduce((soma, plano) => soma + plano.transactionIds.length, 0)

  if (planos.length === 0) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md bg-sunken p-3.5">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium text-ink">
            Reconhecer parcelamentos e assinaturas
          </p>
          <p className="text-xs text-muted">
            {aplicado
              ? 'Pronto. Veja as telas de Parcelamentos e Assinaturas.'
              : 'Nada novo a reconhecer no histórico atual.'}
          </p>
        </div>
        <Icon name="check" size={16} className="shrink-0 text-faint" />
      </div>
    )
  }

  return (
    <div className="rounded-md bg-sunken p-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium text-ink">
            Reconhecer parcelamentos e assinaturas
          </p>
          <p className="text-xs text-muted">
            Procura compras parceladas e cobranças que se repetem entre os lançamentos que já estão
            aqui. Só mexe no que ainda não faz parte de uma série.
          </p>
        </div>
        <Button
          variant="quiet"
          size="sm"
          icon="repeat"
          className="shrink-0 bg-sheet"
          onClick={() => {
            applySeriesPlans(planos)
            setAplicado(true)
          }}
        >
          Aplicar
        </Button>
      </div>

      {/*
        A prévia é o que torna a ação aceitável: sem ela, apertar o botão seria
        autorizar uma reescrita em massa às cegas, e o que aparece depois na
        tela de Parcelamentos não teria como ser conferido contra nada.
      */}
      <ul className="mt-3 flex flex-col divide-y divide-hairline border-t border-hairline">
        {planos.slice(0, 8).map((plano) => (
          <li
            key={plano.label + plano.kind}
            className="flex items-center justify-between gap-3 py-2 text-xs"
          >
            <span className="flex min-w-0 items-center gap-2">
              <Icon
                name={plano.kind === 'installment' ? 'credit-card' : 'repeat'}
                size={12}
                className="shrink-0 text-faint"
              />
              <span className="truncate text-ink">{plano.label}</span>
            </span>
            <span className="shrink-0 text-muted">
              {plano.kind === 'installment'
                ? `parcelamento · ${plano.transactionIds.length}`
                : `assinatura · ${plano.transactionIds.length}x`}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-2.5 text-xs text-muted">
        {parcelamentos.length} {parcelamentos.length === 1 ? 'parcelamento' : 'parcelamentos'} e{' '}
        {assinaturas.length} {assinaturas.length === 1 ? 'assinatura' : 'assinaturas'}, alcançando{' '}
        {alcancados} {alcancados === 1 ? 'lançamento' : 'lançamentos'}.
        {planos.length > 8 ? ' A lista acima mostra os oito primeiros.' : ''}
      </p>
    </div>
  )
}

