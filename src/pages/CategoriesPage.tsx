import { useMemo, useState } from 'react'
import { Icon } from '@/components/Icon'
import { MonthPicker } from '@/components/MonthPicker'
import { NarrowColumn } from '@/components/NarrowColumn'
import { Card } from '@/components/ui/Card'
import { EmptyState } from '@/components/ui/EmptyState'
import { Money } from '@/components/ui/Money'
import { spendingTree, type GroupSpend } from '@/domain/selectors'
import { CategoryRing, sliceColors } from '@/features/charts/CategoryDonut'
import { cn } from '@/lib/cn'
import { formatMonthLong } from '@/lib/date'
import { useFinanceStore } from '@/store/financeStore'
import { useCategories, useSelectedMonth, useTransactions } from '@/store/hooks'

/**
 * Categorias: para onde o dinheiro do mês foi, grupo por grupo.
 *
 * Em cima, o total do mês e o anel da composição. Embaixo, cada grupo com o
 * valor e uma barra, e aberto nas subcategorias que o formam. É a pergunta
 * que o anel sozinho não responde: ele mostra que Transporte pesou, a lista
 * mostra que foi combustível.
 */
export function CategoriesPage() {
  const month = useSelectedMonth()
  const setSelectedMonth = useFinanceStore((state) => state.setSelectedMonth)
  const transactions = useTransactions()
  const categories = useCategories()

  const arvore = useMemo(
    () => spendingTree(transactions, categories, month),
    [transactions, categories, month],
  )
  const total = arvore.reduce((soma, grupo) => soma + grupo.amount, 0)
  // As barras medem contra o maior grupo, e não contra o total: com um gasto
  // dominante, escalar pelo total achataria todo o resto em traços. A
  // subcategoria usa a mesma régua do grupo, para "Universidade" ao lado de
  // "Educação" ter o comprimento que os dois números dizem.
  const maior = arvore[0]?.amount ?? 0
  const rotuloDoMes = formatMonthLong(month)
  // A cor de cada grupo sai da mesma conta que pinta o anel, para a barra ter
  // sempre a cor exata da fatia — inclusive nos grupos sem matiz próprio, que
  // alternam dois neutros conforme a posição.
  const cores = useMemo(() => sliceColors(arvore), [arvore])

  return (
    <NarrowColumn>
      <h1 className="sr-only">Categorias</h1>

      <Card className="mb-5 flex flex-col items-center gap-6 p-6 text-center sm:flex-row sm:justify-between sm:p-8 sm:text-left">
        <div className="min-w-0">
          <Money
            cents={total}
            className="block text-4xl leading-none font-bold tracking-tight sm:text-[2.75rem]"
          />
          <p className="mt-2 text-base text-muted">gasto em {rotuloDoMes}</p>
        </div>
        {arvore.length > 0 ? <CategoryRing data={arvore} size={128} /> : null}
        <MonthPicker value={month} onChange={setSelectedMonth} />
      </Card>

      <Card flush>
        <h2 className="border-b border-hairline px-4 py-5 text-xs font-medium tracking-[0.06em] text-muted uppercase sm:px-6">
          Categorias
        </h2>

        {arvore.length === 0 ? (
          <EmptyState
            icon="chart-column"
            title={`Nenhum gasto em ${rotuloDoMes.toLowerCase()}`}
            description="As despesas do mês aparecem aqui agrupadas por categoria, abertas nas subcategorias."
          />
        ) : (
          <ul className="divide-y divide-hairline">
            {arvore.map((grupo) => (
              <Grupo
                key={grupo.groupId}
                grupo={grupo}
                maior={maior}
                cor={cores.get(grupo.groupId) ?? 'var(--ink)'}
              />
            ))}
          </ul>
        )}
      </Card>
    </NarrowColumn>
  )
}

/**
 * Um grupo e as subcategorias dele.
 *
 * Começa aberto, como na referência. Fechado, a tela seria só o anel
 * repetido em forma de lista; a informação nova — de qual subcategoria veio
 * o número — é justamente o que fica dentro.
 */
function Grupo({ grupo, maior, cor }: { grupo: GroupSpend; maior: number; cor: string }) {
  const [aberto, setAberto] = useState(true)
  const idDaLista = `categoria-${grupo.groupId}`
  const subcategorias = grupo.items.length

  return (
    <li>
      <button
        type="button"
        onClick={() => setAberto((valor) => !valor)}
        aria-expanded={aberto}
        aria-controls={idDaLista}
        className="flex w-full items-center gap-3 px-4 py-4 text-left transition-colors duration-150 hover:bg-sunken/60 sm:gap-4 sm:px-6"
      >
        <span className="inline-flex size-6 shrink-0 items-center justify-center text-muted sm:size-8">
          <Icon
            name="chevron-down"
            size={16}
            className={cn('transition-transform duration-200', aberto && 'rotate-180')}
          />
        </span>
        {/*
          Com mais de uma subcategoria, a pastilha do grupo mostra quantas são,
          em cor cheia, como na referência: é o aviso de que abrir o grupo vai
          mostrar uma divisão. Com uma só, abrir repete o grupo, e a pastilha
          fica com o ícone.
        */}
        {subcategorias > 1 ? (
          <span
            aria-hidden
            style={{ backgroundColor: cor }}
            className="tnum inline-flex size-11 shrink-0 items-center justify-center rounded-md text-sm font-bold text-accent-ink"
          >
            {subcategorias}
          </span>
        ) : (
          <Pastilha icone={grupo.icon} cor={cor} tamanho={44} />
        )}
        <span className="min-w-0 flex-1 truncate text-lg font-semibold text-ink">
          {grupo.label}
          {subcategorias > 1 ? <span className="sr-only"> com {subcategorias} subcategorias</span> : null}
        </span>
        <Money cents={grupo.amount} className="shrink-0 text-lg font-bold text-ink" />
        <Barra valor={grupo.amount} maior={maior} cor={cor} />
      </button>

      {aberto ? (
        /*
          O fio à esquerda liga as subcategorias ao grupo e fica embaixo da
          seta, e as pastilhas se alinham com a do grupo: é a mesma coluna,
          um nível abaixo. As medidas acompanham as da linha do grupo — no
          celular, 16 de margem, seta de 24 e vão de 12 põem a pastilha a 52px
          e o fio a 28; a partir de 640px, 24 + 32 + 16 dão 72 e 40.
        */
        <ul
          id={idDaLista}
          className="mb-3 ml-7 border-l border-hairline-strong pl-6 sm:ml-10 sm:pl-8"
        >
          {grupo.items.map((item) => (
            <li key={item.categoryId} className="flex items-center gap-3 py-2.5 pr-4 sm:gap-4 sm:pr-6">
              <Pastilha icone={item.icon} cor={cor} tamanho={36} />
              <span title={item.label} className="min-w-0 flex-1 truncate text-sm text-muted sm:text-base">
                {item.label}
              </span>
              <Money cents={item.amount} className="shrink-0 text-sm font-medium text-muted sm:text-base" />
              <Barra valor={item.amount} maior={maior} cor={cor} />
            </li>
          ))}
        </ul>
      ) : null}
    </li>
  )
}

/**
 * A pastilha tingida: a cor do grupo a 16% no fundo e cheia no ícone, como a
 * pílula de categoria da tabela de Transações. Tingida, e não sólida, porque
 * aqui são dezenas delas empilhadas, e uma coluna de quadrados de cor cheia
 * gritaria mais alto que os valores ao lado.
 */
function Pastilha({ icone, cor, tamanho }: { icone: string; cor: string; tamanho: number }) {
  return (
    <span
      aria-hidden
      style={{
        width: tamanho,
        height: tamanho,
        color: cor,
        backgroundColor: `color-mix(in srgb, ${cor} 16%, transparent)`,
      }}
      className="inline-flex shrink-0 items-center justify-center rounded-md"
    >
      <Icon name={icone} size={Math.round(tamanho * 0.42)} />
    </span>
  )
}

/**
 * A barra de proporção. Decorativa para leitor de tela: o valor já está
 * escrito ao lado, e a barra só o repete em comprimento. Some no celular, onde
 * os 160px dela sairiam do nome da categoria.
 */
function Barra({ valor, maior, cor }: { valor: number; maior: number; cor: string }) {
  return (
    <span aria-hidden className="hidden h-1.5 w-40 shrink-0 overflow-hidden rounded-full bg-sunken sm:block">
      <span
        style={{
          width: `${maior === 0 ? 0 : Math.max((valor / maior) * 100, 2)}%`,
          backgroundColor: cor,
        }}
        className="block h-full rounded-full"
      />
    </span>
  )
}
