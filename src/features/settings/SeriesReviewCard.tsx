import { useMemo, useState } from 'react'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog } from '@/components/ui/Dialog'
import {
  MOTIVO_DE_RECUSA,
  planSeriesForHistory,
  reviewSubscriptionCandidates,
  type SeriesRejection,
} from '@/domain/detectSeries'
import { useFinanceStore } from '@/store/financeStore'
import { useTransactions } from '@/store/hooks'

/** Quantas recusas cabem antes da lista virar um extrato. */
const LIMITE = 8

/**
 * Por que uma cobrança repetida não virou assinatura, e como pedir de novo.
 *
 * Duas perguntas que a tela de Assinaturas não tem como responder sozinha, e
 * que apareceram juntas na prática: um serviço que a pessoa assina não
 * aparecia, e um mercado que ela não assina aparecia. As duas vinham do mesmo
 * lugar — a régua de detecção — e nenhuma das duas dava para investigar de
 * fora, porque a recusa acontecia em silêncio.
 *
 * **Refazer existe porque melhorar a régua não alcançava o passado.** O
 * reconhecimento comum só olha lançamento sem série, então o que foi agrupado
 * errado por uma versão antiga ficava congelado: a regra nova entrava em vigor
 * e a linha errada continuava na tela, sem nenhum caminho de volta.
 */
export function SeriesReviewCard() {
  const transactions = useTransactions()
  const ungroupImportedSeries = useFinanceStore((state) => state.ungroupImportedSeries)
  const applySeriesPlans = useFinanceStore((state) => state.applySeriesPlans)
  const [confirmando, setConfirmando] = useState(false)

  const recusas = useMemo(() => reviewSubscriptionCandidates(transactions), [transactions])
  const importadas = useMemo(
    () => new Set(transactions.filter((item) => item.source === 'imported' && item.seriesId)
      .map((item) => item.seriesId)).size,
    [transactions],
  )

  /*
   * Vira o jogo numa recusa: o grupo passa a ser assinatura por decisão de quem
   * gastou, e não por medida.
   *
   * Não afrouxa a régua para todo mundo, que era a outra saída possível e a
   * pior delas: baixar o limite até esta linha aparecer traria junto o mercado
   * e a padaria, e o preço sairia na projeção anual — um número inflado é mais
   * difícil de perceber que uma linha faltando.
   */
  const marcarComoAssinatura = (recusa: SeriesRejection) =>
    applySeriesPlans([
      {
        kind: 'subscription',
        label: recusa.label,
        transactionIds: recusa.transactionIds,
        indexById: {},
      },
    ])

  const refazer = () => {
    ungroupImportedSeries()
    /*
     * A segunda etapa lê o estado **depois** da primeira, e não o `transactions`
     * deste render, que ainda descreve o mundo agrupado. Reconhecer sobre ele
     * devolveria exatamente as séries que acabaram de ser desfeitas.
     */
    applySeriesPlans(planSeriesForHistory(useFinanceStore.getState().data.transactions))
  }

  return (
    <div className="rounded-md bg-sunken p-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium text-ink">Revisão das séries</p>
          <p className="text-xs text-muted">
            Refazer solta as séries que vieram do banco e reconhece todas de novo, com as regras de
            hoje. É o que corrige um agrupamento antigo que ficou errado.
          </p>
        </div>
        <Button
          variant="quiet"
          size="sm"
          icon="rotate-cw"
          disabled={importadas === 0}
          className="shrink-0 bg-sheet"
          onClick={() => setConfirmando(true)}
        >
          Refazer
        </Button>
      </div>

      {recusas.length > 0 ? (
        <>
          <p className="mt-3.5 border-t border-hairline pt-3 text-xs text-muted">
            Cobranças que se repetem e <strong className="font-medium text-ink">não</strong> viraram
            assinatura. Se a régua errou, o botão resolve:
          </p>

          <ul className="mt-1 flex flex-col divide-y divide-hairline">
            {recusas.slice(0, LIMITE).map((recusa) => (
              <li key={recusa.label} className="flex items-center justify-between gap-3 py-2.5">
                <span className="min-w-0">
                  <span className="flex min-w-0 items-center gap-2 text-xs">
                    <Icon name="circle-dashed" size={12} className="shrink-0 text-faint" />
                    <span className="truncate text-ink">{recusa.label}</span>
                    <span className="tnum shrink-0 text-faint">{recusa.count}x</span>
                  </span>
                  <span className="mt-0.5 block pl-5 text-xs text-muted">
                    {MOTIVO_DE_RECUSA[recusa.reason]}
                  </span>
                </span>

                <Button
                  variant="quiet"
                  size="sm"
                  icon="repeat"
                  className="shrink-0 bg-sheet"
                  onClick={() => marcarComoAssinatura(recusa)}
                >
                  É assinatura
                </Button>
              </li>
            ))}
          </ul>

          {recusas.length > LIMITE ? (
            <p className="mt-2 text-xs text-faint">
              E outras {recusas.length - LIMITE}. A lista mostra as que chegaram mais perto
              de virar assinatura.
            </p>
          ) : null}
        </>
      ) : null}

      <ConfirmDialog
        open={confirmando}
        onClose={() => setConfirmando(false)}
        onConfirm={refazer}
        title="Refazer o reconhecimento"
        /*
          O aviso sobre as correções manuais não pode faltar: quem marcou "não é
          assinatura" em alguma linha vai ver ela voltar, e sem esta frase isso
          parece defeito em vez de consequência.
        */
        message="As séries vindas do banco são desfeitas e reconhecidas de novo. Nenhum lançamento é apagado, mas as marcações de “não é assinatura” que você fez à mão voltam atrás. Séries criadas por você no formulário não são tocadas."
        confirmLabel="Refazer"
      />
    </div>
  )
}
