import { useMemo, useState } from 'react'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { planSeriesForHistory } from '@/domain/detectSeries'
import { installmentPurchases } from '@/domain/installments'
import { activeSubscriptions } from '@/domain/subscriptions'
import { useAccounts, useCategories, useTransactions } from '@/store/hooks'

/**
 * Diagnóstico da importação.
 *
 * Existe porque depurar "a tela está vazia" sem ver os dados vira adivinhação:
 * cada tentativa custa uma rodada inteira de publicar, reimportar e conferir, e
 * nenhuma delas responde **onde** o lançamento parou. As duas telas que
 * dependem de série descartam em silêncio, por bons motivos, e silêncio é
 * exatamente o que não se consegue investigar.
 *
 * Mostra contagem, nunca conteúdo. O texto para copiar carrega números e
 * motivos, e nenhuma descrição, valor ou nome de estabelecimento: ele existe
 * para ser colado numa conversa de suporte, e um diagnóstico que vaza o extrato
 * da pessoa é pior que o defeito que veio investigar.
 */
export function ImportDiagnosticsCard() {
  const transactions = useTransactions()
  const categories = useCategories()
  const accounts = useAccounts()
  const [copiado, setCopiado] = useState(false)

  const laudo = useMemo(() => {
    const importados = transactions.filter((item) => item.source === 'imported')
    const receitas = importados.filter((item) => item.kind === 'income')
    const despesas = importados.filter((item) => item.kind === 'expense')
    const comSerie = importados.filter((item) => item.seriesId)
    const comParcela = importados.filter((item) => item.installment)

    const planos = planSeriesForHistory(transactions)
    const compras = installmentPurchases(transactions, categories)
    const assinaturas = activeSubscriptions(transactions, categories)

    return {
      total: transactions.length,
      importados: importados.length,
      receitas: receitas.length,
      despesas: despesas.length,
      comSerie: comSerie.length,
      comParcela: comParcela.length,
      contas: accounts.length,
      contasDeCartao: accounts.filter((item) => item.kind === 'credit_card').length,
      planosParcelamento: planos.filter((item) => item.kind === 'installment').length,
      planosAssinatura: planos.filter((item) => item.kind === 'subscription').length,
      compras: compras.length,
      assinaturas: assinaturas.length,
    }
  }, [transactions, categories, accounts])

  /*
   * A suspeita mais provável, dita em uma linha.
   *
   * A ordem importa: cada teste só faz sentido se o anterior passou, e mostrar
   * todos de uma vez faria a pessoa perseguir o sintoma em vez da causa.
   */
  const suspeita = (() => {
    if (laudo.importados === 0) return 'Nenhum lançamento importado ainda.'
    if (laudo.receitas > laudo.despesas)
      return 'Há mais receitas que despesas entre os importados. Sinal invertido é a causa provável, e compra de cartão lida como receita não entra em Parcelamentos nem em Assinaturas.'
    if (laudo.comParcela === 0 && laudo.contasDeCartao > 0)
      return 'Nenhum lançamento traz posição de parcela. A função pluggy-sync no ar pode ser anterior à leitura de creditCardMetadata.'
    if (laudo.comSerie === 0 && laudo.planosParcelamento + laudo.planosAssinatura > 0)
      return 'Há séries reconhecíveis que ainda não foram aplicadas. Use "Reconhecer parcelamentos e assinaturas" acima.'
    if (laudo.comSerie > 0 && laudo.compras + laudo.assinaturas === 0)
      return 'Existem lançamentos em série que as telas não estão exibindo. O problema está na exibição, não na detecção.'
    return 'Nada fora do lugar nos números.'
  })()

  const texto = [
    `lancamentos=${laudo.total}`,
    `importados=${laudo.importados}`,
    `receitas=${laudo.receitas}`,
    `despesas=${laudo.despesas}`,
    `com_serie=${laudo.comSerie}`,
    `com_parcela=${laudo.comParcela}`,
    `contas=${laudo.contas}`,
    `contas_cartao=${laudo.contasDeCartao}`,
    `planos_parc=${laudo.planosParcelamento}`,
    `planos_assin=${laudo.planosAssinatura}`,
    `tela_parcelamentos=${laudo.compras}`,
    `tela_assinaturas=${laudo.assinaturas}`,
  ].join(' ')

  const linhas: readonly (readonly [string, string])[] = [
    ['Lançamentos importados', `${laudo.importados} de ${laudo.total}`],
    ['Entre eles, receitas e despesas', `${laudo.receitas} e ${laudo.despesas}`],
    ['Com posição de parcela', String(laudo.comParcela)],
    ['Já em alguma série', String(laudo.comSerie)],
    ['Contas, sendo cartões', `${laudo.contas}, sendo ${laudo.contasDeCartao}`],
    [
      'Séries reconhecíveis agora',
      `${laudo.planosParcelamento} parcelamentos, ${laudo.planosAssinatura} assinaturas`,
    ],
    ['Chegando às telas', `${laudo.compras} parcelamentos, ${laudo.assinaturas} assinaturas`],
  ]

  return (
    <div className="rounded-md bg-sunken p-3.5">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium text-ink">Diagnóstico da importação</p>
          <p className="text-xs text-muted">
            Onde os lançamentos param antes de chegar em Parcelamentos e Assinaturas. Só contagens,
            nenhuma descrição ou valor.
          </p>
        </div>
        <Button
          variant="quiet"
          size="sm"
          icon="download"
          className="shrink-0 bg-sheet"
          onClick={() => {
            void navigator.clipboard?.writeText(texto)
            setCopiado(true)
          }}
        >
          {copiado ? 'Copiado' : 'Copiar'}
        </Button>
      </div>

      <dl className="mt-3 flex flex-col divide-y divide-hairline border-t border-hairline">
        {linhas.map(([rotulo, valor]) => (
          <div key={rotulo} className="flex items-baseline justify-between gap-3 py-2 text-xs">
            <dt className="text-muted">{rotulo}</dt>
            <dd className="tnum shrink-0 text-ink">{valor}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-3 flex items-start gap-2 border-t border-hairline pt-3 text-xs text-muted">
        <Icon name="circle-alert" size={13} className="mt-px shrink-0" />
        {suspeita}
      </p>
    </div>
  )
}
