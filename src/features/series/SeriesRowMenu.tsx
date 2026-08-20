import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { Field, TextInput } from '@/components/ui/Field'
import { Popover } from '@/components/ui/Popover'
import { cn } from '@/lib/cn'
import { useFinanceStore } from '@/store/financeStore'

/**
 * A saída para quando o reconhecimento erra.
 *
 * Nenhuma regra separa com certeza uma compra em oito vezes de uma assinatura
 * quando o banco não declara a parcela: as duas cobram o mesmo valor, no mesmo
 * dia, todo mês. A detecção aperta o que dá para apertar e ainda assim vai
 * classificar coisa errada, porque a evidência que sobra é ambígua de verdade.
 *
 * **Sair de Assinaturas e entrar em Parcelamentos são coisas diferentes.**
 * Desfazer a série tira a linha da tela e deixa as compras soltas; virar
 * parcelamento é dizer o que elas são. Oferecer só o primeiro obrigava a
 * pessoa a escolher entre um erro e um buraco.
 *
 * Nada aqui apaga lançamento. As compras aconteceram e continuam no extrato,
 * no orçamento e no total do mês.
 */

const ITEM_CLASS =
  'flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2 text-[0.8125rem] font-medium ' +
  'text-ink transition-colors duration-150 hover:bg-sunken'

export function SeriesRowMenu({
  seriesId,
  label,
  kind,
  charges,
}: {
  seriesId: string
  label: string
  kind: 'subscription' | 'installment'
  /** Lançamentos da série, que é o piso do número de parcelas. */
  charges: number
}) {
  const ungroupSeries = useFinanceStore((state) => state.ungroupSeries)
  const convertToInstallment = useFinanceStore((state) => state.convertToInstallment)

  const [soltando, setSoltando] = useState(false)
  const [convertendo, setConvertendo] = useState(false)
  const [vezes, setVezes] = useState(String(charges))

  const nome = kind === 'subscription' ? 'assinatura' : 'parcelamento'
  const tela = kind === 'subscription' ? 'Assinaturas' : 'Parcelamentos'

  const total = Number(vezes)
  const valido = Number.isInteger(total) && total >= charges && total <= 99

  return (
    <>
      <Popover
        label={`Ações de ${label}`}
        width={216}
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
            {kind === 'subscription' ? (
              <button
                type="button"
                onClick={() => {
                  close()
                  setVezes(String(charges))
                  setConvertendo(true)
                }}
                className={ITEM_CLASS}
              >
                <Icon name="credit-card" size={16} className="text-faint" />
                É parcelamento
              </button>
            ) : null}

            <button
              type="button"
              onClick={() => {
                close()
                setSoltando(true)
              }}
              className={ITEM_CLASS}
            >
              <Icon name="unlink" size={16} className="text-faint" />
              Não é {nome}
            </button>
          </div>
        )}
      </Popover>

      <Dialog
        open={convertendo}
        onClose={() => setConvertendo(false)}
        title="Passar para Parcelamentos"
        description={`“${label}” sai de Assinaturas e vira uma compra parcelada. Nenhum lançamento é apagado.`}
        size="sm"
        footer={
          <>
            <Button variant="quiet" onClick={() => setConvertendo(false)}>
              Cancelar
            </Button>
            <Button
              disabled={!valido}
              onClick={() => {
                convertToInstallment(seriesId, total)
                setConvertendo(false)
              }}
            >
              Passar para parcelas
            </Button>
          </>
        }
      >
        {/*
          O número de vezes precisa ser perguntado. Ele não existe em lugar
          nenhum quando o banco não declarou a parcela, e é justamente o que
          Parcelamentos existe para responder: contar só as cobranças que
          chegaram diria "3 de 3" sobre uma compra em oito vezes, e a tela
          anunciaria dívida zero para quem ainda deve cinco parcelas.
        */}
        <Field
          label="Em quantas vezes"
          hint={`${charges} ${charges === 1 ? 'cobrança lançada' : 'cobranças lançadas'}. As que faltarem entram como previstas.`}
          error={vezes !== '' && !valido ? `Informe um número entre ${charges} e 99.` : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              type="number"
              inputMode="numeric"
              min={charges}
              max={99}
              value={vezes}
              invalid={invalid}
              onChange={(event) => setVezes(event.target.value)}
            />
          )}
        </Field>
      </Dialog>

      <ConfirmDialog
        open={soltando}
        onClose={() => setSoltando(false)}
        onConfirm={() => ungroupSeries(seriesId)}
        title={`Tirar de ${tela}`}
        /*
          O aviso sobre o reconhecimento é a parte que não pode faltar. Quem
          desfaz aqui e depois roda "Refazer" em Ajustes vê a linha voltar, e
          sem esta frase isso parece defeito.
        */
        message={`Os lançamentos de “${label}” continuam no histórico, soltos, e a linha sai de ${tela}. Ela volta se você refizer o reconhecimento de séries em Ajustes.`}
        confirmLabel={`Não é ${nome}`}
      />
    </>
  )
}
