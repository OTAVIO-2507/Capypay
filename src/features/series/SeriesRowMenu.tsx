import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { ConfirmDialog } from '@/components/ui/Dialog'
import { Popover } from '@/components/ui/Popover'
import { cn } from '@/lib/cn'
import { useFinanceStore } from '@/store/financeStore'

/**
 * A saída para quando o reconhecimento erra.
 *
 * Nenhuma regra separa com certeza uma academia cobrada todo dia 10 de uma
 * assinatura de streaming: as duas têm dia fixo, valor fixo e um mês de
 * distância. A detecção aperta o que dá para apertar — dia do mês, valor
 * estável, intervalo mensal — e ainda assim vai classificar coisa errada,
 * porque a evidência que sobra é ambígua de verdade. Sem um jeito de dizer
 * "isto não é", a lista fica com um erro que ninguém consegue corrigir, e uma
 * projeção anual errada é pior que uma projeção incompleta.
 *
 * **Desfazer a série não apaga nada.** As compras aconteceram e continuam no
 * extrato, no orçamento e no total do mês; o que sai é só o parentesco entre
 * elas, que era o que estava errado.
 */
export function SeriesRowMenu({
  seriesId,
  label,
  kind,
}: {
  seriesId: string
  label: string
  kind: 'subscription' | 'installment'
}) {
  const ungroupSeries = useFinanceStore((state) => state.ungroupSeries)
  const [confirmando, setConfirmando] = useState(false)

  const nome = kind === 'subscription' ? 'assinatura' : 'parcelamento'
  const tela = kind === 'subscription' ? 'Assinaturas' : 'Parcelamentos'

  return (
    <>
      <Popover
        label={`Ações de ${label}`}
        width={208}
        trigger={({ open, toggle, controls }) => (
          <button
            type="button"
            onClick={toggle}
            aria-expanded={open}
            aria-controls={controls}
            aria-label={`Ações de ${label}`}
            className={cn(
              'inline-flex size-8 shrink-0 items-center justify-center rounded-sm',
              'transition-colors duration-150',
              open ? 'bg-sunken text-ink' : 'text-faint hover:bg-sunken hover:text-ink',
            )}
          >
            <Icon name="ellipsis" size={16} />
          </button>
        )}
      >
        {({ close }) => (
          <div className="p-1.5">
            <button
              type="button"
              onClick={() => {
                close()
                setConfirmando(true)
              }}
              className={
                'flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-[0.8125rem] ' +
                'font-medium text-ink transition-colors duration-150 hover:bg-sunken'
              }
            >
              <Icon name="unlink" size={16} className="text-faint" />
              Não é {nome}
            </button>
          </div>
        )}
      </Popover>

      <ConfirmDialog
        open={confirmando}
        onClose={() => setConfirmando(false)}
        onConfirm={() => ungroupSeries(seriesId)}
        title={`Tirar de ${tela}`}
        /*
          O aviso sobre o reconhecimento é a parte que não pode faltar. Quem
          desfaz aqui e depois roda "Reconhecer parcelamentos e assinaturas" em
          Ajustes vê a linha voltar, e sem esta frase isso parece defeito.
        */
        message={`Os lançamentos de “${label}” continuam no histórico, soltos, e a linha sai de ${tela}. Ela volta se você rodar o reconhecimento de séries em Ajustes.`}
        confirmLabel={`Não é ${nome}`}
      />
    </>
  )
}
