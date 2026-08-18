import { useMemo, useState } from 'react'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { categoryLabel } from '@/domain/categories'
import { learnCategories, suggestCategory } from '@/domain/importing'
import { useFinanceStore } from '@/store/financeStore'
import { useCategories, useTransactions } from '@/store/hooks'

/**
 * Recategoriza o que já está gravado em "Outros".
 *
 * A sugestão de categoria acontece na importação, então alargar o catálogo ou
 * aprender uma preferência nova não alcança nada do que já entrou. Quem
 * importou dois anos antes da melhoria fica com centenas de linhas em Outros e
 * a única saída seria abrir uma por uma.
 *
 * **Só mexe no que está em Outros.** Toda outra categoria ou foi escolhida pela
 * pessoa ou acertada pela sugestão, e trocá-la por um palpite novo seria
 * desfazer decisão alheia. Outros é a ausência de resposta, e é o único lugar
 * onde não há nada a perder.
 */
export function RecategorizeCard() {
  const transactions = useTransactions()
  const categories = useCategories()
  const recategorize = useFinanceStore((state) => state.recategorize)
  const [aplicado, setAplicado] = useState(false)

  const propostas = useMemo(() => {
    const aprendidas = learnCategories(transactions)

    return transactions
      .filter((item) => item.categoryId === 'outros' && item.kind !== 'contribution')
      .map((item) => ({
        id: item.id,
        description: item.description,
        categoryId: suggestCategory(item.description, item.kind, categories, aprendidas),
      }))
      .filter((item) => item.categoryId !== 'outros')
  }, [transactions, categories])

  const porCategoria = useMemo(() => {
    const contagem = new Map<string, number>()
    for (const proposta of propostas) {
      contagem.set(proposta.categoryId, (contagem.get(proposta.categoryId) ?? 0) + 1)
    }
    return [...contagem.entries()].sort((a, b) => b[1] - a[1])
  }, [propostas])

  if (propostas.length === 0) {
    return (
      <div className="flex items-center justify-between gap-4 rounded-md bg-sunken p-3.5">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium text-ink">Recategorizar o que ficou em Outros</p>
          <p className="text-xs text-muted">
            {aplicado
              ? 'Pronto. O que sobrou em Outros não bate com nenhuma regra conhecida.'
              : 'Nada em Outros que a sugestão saiba classificar agora.'}
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
            Recategorizar o que ficou em Outros
          </p>
          <p className="text-xs text-muted">
            Aplica o catálogo atual e o que você já corrigiu ao histórico. Só mexe no que está em
            Outros, nunca no que você escolheu.
          </p>
        </div>
        <Button
          variant="quiet"
          size="sm"
          icon="refresh-cw"
          className="shrink-0 bg-sheet"
          onClick={() => {
            recategorize(propostas.map(({ id, categoryId }) => ({ id, categoryId })))
            setAplicado(true)
          }}
        >
          Aplicar
        </Button>
      </div>

      {/*
        A prévia por categoria é o que permite recusar antes de aplicar: ver
        "40 para Alimentação" é conferível de relance, e uma lista de quarenta
        descrições não seria.
      */}
      <ul className="mt-3 flex flex-wrap gap-1.5 border-t border-hairline pt-3">
        {porCategoria.map(([categoryId, quantidade]) => (
          <li
            key={categoryId}
            className="rounded-full bg-sheet px-2.5 py-1 text-xs text-muted"
          >
            <span className="text-ink">{quantidade}</span> {categoryLabel(categories, categoryId)}
          </li>
        ))}
      </ul>

      <p className="mt-2.5 text-xs text-muted">
        {propostas.length} {propostas.length === 1 ? 'lançamento sai' : 'lançamentos saem'} de
        Outros.
      </p>
    </div>
  )
}
