import { useMemo, useState } from 'react'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { Popover } from '@/components/ui/Popover'
import { CATEGORY_GROUPS, categoryColor } from '@/domain/categories'
import type { Category, CategoryGroup, CategoryId } from '@/domain/types'
import { cn } from '@/lib/cn'

interface CategoryFilterProps {
  categories: readonly Category[]
  /** Subcategorias aceitas agora. Vazio é "todas". */
  value: readonly CategoryId[]
  onChange: (next: CategoryId[]) => void
  /**
   * Quantos lançamentos cada subcategoria tem no período à mostra. É o que
   * acende ou apaga a linha e o que dá o "2/9" do grupo. Subcategoria sem
   * nenhum continua na lista, em cinza: sumir com ela faria a pessoa procurar
   * "Estacionamentos" e concluir que a subcategoria não existe.
   */
  counts: ReadonlyMap<CategoryId, number>
}

interface Ramo {
  group: CategoryGroup
  folhas: Category[]
  /** Quantas folhas do grupo têm lançamento no período. */
  comLancamento: number
}

/**
 * O filtro de categorias, em árvore: grupo e subcategorias.
 *
 * O grupo abre e fecha; dentro dele, "Selecionar todas" e uma caixa por
 * subcategoria. Ao lado de cada grupo, "2/9": quantas das nove subcategorias
 * tiveram lançamento no período. É a leitura que diz onde vale a pena abrir
 * antes de abrir — dos vinte e poucos grupos, num mês comum, uns oito têm
 * alguma coisa.
 *
 * A escolha só vale no "Aplicar". Marcar três subcategorias uma a uma, com a
 * tabela refazendo a cada clique, faz a lista pular embaixo do painel três
 * vezes enquanto a pessoa ainda está escolhendo. Com rascunho, a tabela muda
 * uma vez, no fim, e "Cancelar" desfaz tudo sem deixar rastro.
 *
 * Marcação feita com `<input type="checkbox">` de verdade, escondido atrás do
 * desenho: espaço marca, Tab anda, e o leitor de tela anuncia "marcado" e
 * "parcialmente marcado" sem ARIA escrito à mão.
 */
export function CategoryFilter({ categories, value, onChange, counts }: CategoryFilterProps) {
  const [rascunho, setRascunho] = useState<CategoryId[]>([])
  const [busca, setBusca] = useState('')
  const [abertos, setAbertos] = useState<ReadonlySet<string>>(new Set())

  const ramos = useMemo<Ramo[]>(
    () =>
      CATEGORY_GROUPS.map((group) => {
        const folhas = categories.filter((category) => category.group === group.id)
        const comLancamento = folhas.filter((folha) => (counts.get(folha.id) ?? 0) > 0).length
        return { group, folhas, comLancamento }
      }).filter((ramo) => ramo.folhas.length > 0),
    [categories, counts],
  )

  // Buscando, cada grupo mostra só as folhas que casam — ou todas, quando o
  // termo casa com o nome do próprio grupo — e todo grupo com resultado abre
  // sozinho: esconder o que foi achado atrás de mais um clique seria a busca
  // pela metade.
  const termo = normalizar(busca.trim())
  const visiveis = useMemo(() => {
    if (!termo) return ramos
    return ramos
      .map((ramo) => ({
        ...ramo,
        folhas: normalizar(ramo.group.label).includes(termo)
          ? ramo.folhas
          : ramo.folhas.filter((folha) => normalizar(folha.label).includes(termo)),
      }))
      .filter((ramo) => ramo.folhas.length > 0)
  }, [ramos, termo])

  const marcadas = new Set(rascunho)
  const ativas = value.length

  const alternarGrupo = (id: string) =>
    setAbertos((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(id)) proximo.delete(id)
      else proximo.add(id)
      return proximo
    })

  return (
    <Popover
      label="Filtrar por categoria"
      width={360}
      align="start"
      trigger={({ open, toggle, controls }) => (
        <button
          type="button"
          onClick={() => {
            // Abrir parte sempre do que está valendo: um rascunho abandonado
            // da última vez não pode reaparecer como se tivesse sido aplicado.
            if (!open) {
              setRascunho([...value])
              setBusca('')
              setAbertos(new Set())
            }
            toggle()
          }}
          aria-expanded={open}
          aria-controls={controls}
          className={cn(
            'inline-flex h-10 items-center gap-2 rounded-full border px-4 text-[0.8125rem] text-ink',
            'transition-colors duration-150',
            ativas > 0 ? 'border-accent/45 bg-accent/12' : 'border-hairline hover:bg-sunken',
            open && ativas === 0 && 'bg-sunken',
          )}
        >
          <span>{ativas > 0 ? 'Categorias' : 'Todas as categorias'}</span>
          {ativas > 0 ? (
            <span className="tnum rounded-full bg-accent px-1.5 text-[0.6875rem] font-semibold text-accent-ink">
              {ativas}
              <span className="sr-only"> {ativas === 1 ? 'selecionada' : 'selecionadas'}</span>
            </span>
          ) : null}
          <Icon
            name="chevron-down"
            size={14}
            className={cn('shrink-0 text-faint transition-transform duration-200', open && 'rotate-180')}
          />
        </button>
      )}
    >
      {({ close }) => (
        <div className="flex max-h-[min(32rem,72vh)] flex-col">
          <div className="border-b border-hairline p-3">
            <label className="relative block">
              <span className="sr-only">Buscar categoria</span>
              <Icon
                name="search"
                size={14}
                className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-faint"
              />
              <input
                type="search"
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
                placeholder="Buscar categoria…"
                className="h-10 w-full rounded-sm border border-hairline bg-sunken pr-3 pl-9 text-[0.8125rem] text-ink placeholder:text-faint focus:border-hairline-strong"
              />
            </label>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto p-1.5">
            {/*
              "Todas" é a lista vazia. Marcá-la limpa as escolhas; desmarcá-la
              não faz nada, porque "nenhuma categoria" não é um filtro que
              alguém queira — seria uma tabela sempre vazia.
            */}
            {!termo ? (
              <Caixa
                marcada={rascunho.length === 0}
                aoMarcar={() => setRascunho([])}
                rotulo="Todas as categorias"
                forte
              />
            ) : null}

            {visiveis.length === 0 ? (
              <p className="px-2.5 py-6 text-center text-xs text-muted">
                Nenhuma categoria com “{busca.trim()}”.
              </p>
            ) : (
              <ul>
                {visiveis.map((ramo) => {
                  const aberto = Boolean(termo) || abertos.has(ramo.group.id)
                  const idDaLista = `filtro-grupo-${ramo.group.id}`
                  const doGrupo = ramo.folhas.map((folha) => folha.id)
                  const quantasMarcadas = doGrupo.filter((id) => marcadas.has(id)).length
                  const cor = categoryColor(ramo.group.id)

                  return (
                    <li key={ramo.group.id}>
                      <button
                        type="button"
                        onClick={() => alternarGrupo(ramo.group.id)}
                        aria-expanded={aberto}
                        aria-controls={idDaLista}
                        className="flex w-full items-center gap-2.5 rounded-sm px-2.5 py-2.5 text-left transition-colors duration-100 hover:bg-sunken"
                      >
                        <Icon
                          name="chevron-right"
                          size={14}
                          className={cn(
                            'shrink-0 text-muted transition-transform duration-150',
                            aberto && 'rotate-90',
                          )}
                        />
                        <span
                          aria-hidden
                          style={{ backgroundColor: cor ?? undefined }}
                          className={cn(
                            'inline-flex size-6 shrink-0 items-center justify-center rounded-[7px]',
                            cor ? 'text-accent-ink' : 'bg-sunken text-muted',
                          )}
                        >
                          <Icon name={ramo.group.icon} size={12} />
                        </span>
                        <span className="min-w-0 flex-1 truncate text-[0.8125rem] font-semibold text-accent">
                          {ramo.group.label}
                        </span>
                        {quantasMarcadas > 0 ? (
                          <span className="size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
                        ) : null}
                        <span className="tnum shrink-0 text-xs text-muted">
                          {ramo.comLancamento}/{ramo.folhas.length}
                          <span className="sr-only">
                            {' '}
                            subcategorias com lançamento
                            {quantasMarcadas > 0 ? `, ${quantasMarcadas} marcadas` : ''}
                          </span>
                        </span>
                      </button>

                      {aberto ? (
                        <div id={idDaLista} className="mb-1 pl-6">
                          {ramo.folhas.length > 1 ? (
                            <Caixa
                              marcada={quantasMarcadas === doGrupo.length}
                              parcial={quantasMarcadas > 0 && quantasMarcadas < doGrupo.length}
                              aoMarcar={() =>
                                setRascunho((atual) =>
                                  quantasMarcadas === doGrupo.length
                                    ? atual.filter((id) => !doGrupo.includes(id))
                                    : [...new Set([...atual, ...doGrupo])],
                                )
                              }
                              rotulo="Selecionar todas"
                              rotuloAcessivel={`Selecionar todas de ${ramo.group.label}`}
                              pequena
                            />
                          ) : null}
                          {ramo.folhas.map((folha) => (
                            <Caixa
                              key={folha.id}
                              marcada={marcadas.has(folha.id)}
                              aoMarcar={() =>
                                setRascunho((atual) =>
                                  atual.includes(folha.id)
                                    ? atual.filter((id) => id !== folha.id)
                                    : [...atual, folha.id],
                                )
                              }
                              rotulo={folha.label}
                              apagada={(counts.get(folha.id) ?? 0) === 0}
                            />
                          ))}
                        </div>
                      ) : null}
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="flex items-center justify-between gap-2 border-t border-hairline p-3">
            <span className="text-xs text-muted" aria-live="polite">
              {rascunho.length === 0
                ? 'Nenhuma selecionada'
                : `${rascunho.length} ${rascunho.length === 1 ? 'selecionada' : 'selecionadas'}`}
            </span>
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" onClick={close}>
                Cancelar
              </Button>
              <Button
                size="sm"
                variant="accent"
                onClick={() => {
                  onChange(rascunho)
                  close()
                }}
              >
                Aplicar
              </Button>
            </div>
          </div>
        </div>
      )}
    </Popover>
  )
}

function Caixa({
  marcada,
  parcial = false,
  aoMarcar,
  rotulo,
  rotuloAcessivel,
  forte = false,
  pequena = false,
  apagada = false,
}: {
  marcada: boolean
  /** Parte do grupo marcada: o traço no lugar do visto. */
  parcial?: boolean
  aoMarcar: () => void
  rotulo: string
  rotuloAcessivel?: string
  forte?: boolean
  pequena?: boolean
  /** Sem lançamento no período. Continua marcável. */
  apagada?: boolean
}) {
  return (
    // `relative` ancora o input escondido dentro da própria linha. Sem ele, o
    // `sr-only` se posiciona pelo painel, e focar a caixa por Tab rolava a
    // lista até o topo em vez de até a linha.
    <label
      title={apagada ? 'Sem lançamentos no período' : undefined}
      className="relative flex cursor-pointer items-center gap-3 rounded-sm px-2.5 py-2 transition-colors duration-100 hover:bg-sunken"
    >
      <input
        type="checkbox"
        checked={marcada}
        ref={(el) => {
          if (el) el.indeterminate = parcial
        }}
        onChange={aoMarcar}
        aria-label={rotuloAcessivel}
        className="peer sr-only"
      />
      {/*
        A caixa desenhada. O anel de foco vem do `peer`, porque o foco está no
        input escondido: sem isto, quem navega por Tab andaria às cegas.
      */}
      <span
        aria-hidden
        className={cn(
          'inline-flex size-4 shrink-0 items-center justify-center rounded-[5px] border transition-colors duration-100',
          'peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-accent',
          marcada || parcial ? 'border-accent bg-accent text-accent-ink' : 'border-hairline-strong',
        )}
      >
        {marcada ? (
          <Icon name="check" size={11} strokeWidth={3} />
        ) : parcial ? (
          <Icon name="minus" size={11} strokeWidth={3} />
        ) : null}
      </span>

      <span
        className={cn(
          'min-w-0 flex-1 truncate',
          pequena ? 'text-xs' : 'text-[0.8125rem]',
          forte && 'font-semibold',
          apagada ? 'text-faint' : 'text-ink',
        )}
      >
        {rotulo}
      </span>
    </label>
  )
}

/** Busca sem acento e sem caixa: "saude" tem de achar "Saúde". */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}
