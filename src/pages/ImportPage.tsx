import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Badge, Segmented, type SegmentOption } from '@/components/ui/Controls'
import { SelectInput } from '@/components/ui/Field'
import { Money } from '@/components/ui/Money'
import { categoriesFor } from '@/domain/categories'
import {
  batchFromOfx,
  buildImportCandidates,
  summarizeCandidates,
  type ImportBatch,
  type ImportCandidate,
} from '@/domain/importing'
import { cn } from '@/lib/cn'
import { formatDayMonthYear } from '@/lib/date'
import { MeuPluggyPanel } from '@/features/openfinance/MeuPluggyPanel'
import { OfxError, decodeOfxBytes, parseOfx } from '@/lib/ofx'
import { useFinanceStore } from '@/store/financeStore'
import { useCategories, useTransactions } from '@/store/hooks'

/**
 * Importação de extrato bancário, por arquivo ou pelo Meu Pluggy.
 *
 * As duas origens existem porque resolvem problemas diferentes. O arquivo OFX
 * funciona em qualquer banco, não depende de nada publicado e não pede senha a
 * ninguém: o arquivo sai do internet banking e é lido no dispositivo. O Meu
 * Pluggy é automático, mas depende da Edge Function no ar e de uma conexão
 * vinculada. Por isso o arquivo abre a tela.
 *
 * As duas convergem em `ImportBatch` antes de chegar à conferência, então
 * deduplicação, sugestão de categoria e revisão são as mesmas nos dois
 * caminhos.
 *
 * **Nada entra sem conferência.** A tela é uma lista de candidatos com a
 * categoria já sugerida e as duplicatas já marcadas, e o botão de confirmar só
 * grava o que continua selecionado. Importação que escreve direto é
 * irreversível na prática: são dezenas de linhas de uma vez, e desfazer uma a
 * uma nunca é uma opção real.
 */

type Etapa = 'escolher' | 'conferir'

/**
 * As duas origens.
 *
 * O arquivo funciona em qualquer banco e não depende de nada publicado. O Meu
 * Pluggy é automático, mas exige a Edge Function no ar e uma conexão vinculada.
 * Por isso o arquivo abre a tela: é o caminho que sempre funciona.
 */
type Origem = 'arquivo' | 'pluggy'

const ORIGENS: readonly SegmentOption<Origem>[] = [
  { value: 'arquivo', label: 'Arquivo OFX' },
  { value: 'pluggy', label: 'Meu Pluggy' },
]

export function ImportPage() {
  const navegar = useNavigate()
  const transactions = useTransactions()
  const categories = useCategories()
  const importTransactions = useFinanceStore((state) => state.importTransactions)

  const entrada = useRef<HTMLInputElement>(null)
  const [etapa, setEtapa] = useState<Etapa>('escolher')
  const [origem, setOrigem] = useState<Origem>('arquivo')
  const [erro, setErro] = useState<string | null>(null)
  const [lote, setLote] = useState<ImportBatch | null>(null)
  const [fonte, setFonte] = useState<string>('arquivo')
  const [candidatos, setCandidatos] = useState<ImportCandidate[]>([])
  const [selecionados, setSelecionados] = useState<Set<string>>(new Set())

  const resumo = useMemo(() => summarizeCandidates(candidatos), [candidatos])

  /**
   * O ponto onde as duas origens viram a mesma coisa.
   *
   * Arquivo e Meu Pluggy chegam aqui já convertidos em `ImportBatch`, então a
   * deduplicação, a sugestão de categoria e a conferência são as mesmas nos
   * dois caminhos. Foi para isso que o domínio deixou de conhecer OFX.
   */
  function receberLotes(lotes: ImportBatch[], origem: string) {
    /*
     * Uma origem pode trazer conta e cartão juntos. Concatenar os lançamentos
     * mantém a conferência numa tela só; o `externalId` de cada candidato já
     * carrega a conta, então nada se mistura onde importa, que é a deduplicação.
     */
    const todos = lotes.flatMap((lote) =>
      buildImportCandidates(lote, transactions, categories),
    )

    setLote(lotes[0] ?? null)
    setFonte(origem)
    setCandidatos(todos)
    // Duplicata exata começa desmarcada: é o único caso em que a resposta
    // certa é conhecida, e marcá-la faria a pessoa desmarcar uma a uma.
    setSelecionados(
      new Set(todos.filter((item) => item.duplicate !== 'exact').map((item) => item.externalId)),
    )
    setEtapa('conferir')
  }

  async function receberArquivo(arquivo: File) {
    setErro(null)

    try {
      const lidos = parseOfx(decodeOfxBytes(await arquivo.arrayBuffer()))
      receberLotes(lidos.map(batchFromOfx), 'arquivo')
    } catch (falha) {
      setErro(
        falha instanceof OfxError
          ? falha.message
          : 'Não foi possível ler este arquivo. Confira se ele é o OFX que o banco gerou.',
      )
    }
  }

  function alternar(externalId: string) {
    setSelecionados((atual) => {
      const proximo = new Set(atual)
      if (proximo.has(externalId)) proximo.delete(externalId)
      else proximo.add(externalId)
      return proximo
    })
  }

  function mudarCategoria(externalId: string, categoryId: string) {
    setCandidatos((atual) =>
      atual.map((item) => (item.externalId === externalId ? { ...item, categoryId } : item)),
    )
  }

  function confirmar() {
    const escolhidos = candidatos.filter((item) => selecionados.has(item.externalId))
    if (escolhidos.length === 0) return

    importTransactions(
      escolhidos.map((item) => ({
        kind: item.kind,
        description: item.description,
        amountCents: item.amountCents,
        date: item.date,
        categoryId: item.categoryId,
        externalId: item.externalId,
      })),
    )

    navegar('/transacoes')
  }

  return (
    <>
      <PageHeader
        title="Importar extrato"
        description="Traga os lançamentos do banco sem informar sua senha a ninguém."
        actions={
          etapa === 'conferir' ? (
            <Button
              variant="ghost"
              onClick={() => {
                setEtapa('escolher')
                setCandidatos([])
                setLote(null)
              }}
            >
              Voltar
            </Button>
          ) : (
            <Segmented
              value={origem}
              onChange={setOrigem}
              options={ORIGENS}
              label="Origem dos lançamentos"
            />
          )
        }
      />

      {etapa === 'escolher' ? (
        origem === 'arquivo' ? (
          <EscolherArquivo
            erro={erro}
            inputRef={entrada}
            onArquivo={(arquivo) => void receberArquivo(arquivo)}
          />
        ) : (
          <MeuPluggyPanel
            onExtratos={(extratos) =>
              receberLotes(
                extratos.map((extrato) => ({
                  accountKey: extrato.accountKey,
                  accountLabel: extrato.accountLabel,
                  entries: extrato.entries,
                })),
                'pluggy',
              )
            }
          />
        )
      ) : (
        <div className="flex flex-col gap-5">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-xs text-muted">
                  {lote?.accountLabel ?? 'Extrato'}
                  {lote?.start && lote.end
                    ? ` · ${formatDayMonthYear(lote.start)} a ${formatDayMonthYear(lote.end)}`
                    : ''}
                </p>
                <p className="mt-1 text-sm text-ink">
                  <span className="font-medium">{resumo.total}</span> lançamentos{' '}
                  {fonte === 'pluggy' ? 'no banco' : 'no arquivo'},{' '}
                  <span className="font-medium">{selecionados.size}</span> selecionados
                </p>
              </div>

              <dl className="flex items-center gap-6">
                <div>
                  <dt className="text-xs text-muted">Entradas</dt>
                  <dd>
                    <Money cents={resumo.incomeCents} className="text-sm text-income" />
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-muted">Saídas</dt>
                  <dd>
                    <Money cents={resumo.expenseCents} className="text-sm text-expense" />
                  </dd>
                </div>
              </dl>
            </div>

            {resumo.jaImportados > 0 || resumo.suspeitos > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2 border-t border-hairline pt-4">
                {resumo.jaImportados > 0 ? (
                  <Badge icon="check">
                    {resumo.jaImportados}{' '}
                    {resumo.jaImportados === 1 ? 'já importado' : 'já importados'}
                  </Badge>
                ) : null}
                {resumo.suspeitos > 0 ? (
                  <Badge tone="outline" icon="triangle-alert">
                    {resumo.suspeitos} {resumo.suspeitos === 1 ? 'parecido' : 'parecidos'} com o que
                    você já lançou
                  </Badge>
                ) : null}
              </div>
            ) : null}
          </Card>

          <Card className="p-0">
            <ul className="flex flex-col divide-y divide-hairline">
              {candidatos.map((candidato) => (
                <LinhaDeCandidato
                  key={candidato.externalId}
                  candidato={candidato}
                  marcado={selecionados.has(candidato.externalId)}
                  categorias={categoriesFor(categories, candidato.kind)}
                  onAlternar={() => alternar(candidato.externalId)}
                  onCategoria={(id) => mudarCategoria(candidato.externalId, id)}
                />
              ))}
            </ul>
          </Card>

          {/*
            A barra de confirmação é fixa no rodapé porque um extrato de mês
            cheio passa de trinta linhas: sem ela, confirmar exigiria rolar de
            volta até o fim de uma lista que a pessoa acabou de percorrer.
          */}
          <div className="sticky bottom-0 -mx-1 flex flex-wrap items-center justify-between gap-3 rounded-t-2xl border-t border-hairline bg-sheet px-5 py-4 shadow-float">
            <p className="text-xs text-muted">
              {selecionados.size === 0
                ? 'Nenhum lançamento selecionado.'
                : `${selecionados.size} de ${resumo.total} entram no histórico.`}
            </p>
            <Button onClick={confirmar} disabled={selecionados.size === 0}>
              Importar {selecionados.size > 0 ? selecionados.size : ''}
            </Button>
          </div>
        </div>
      )}
    </>
  )
}

function EscolherArquivo({
  erro,
  inputRef,
  onArquivo,
}: {
  erro: string | null
  inputRef: React.RefObject<HTMLInputElement | null>
  onArquivo: (arquivo: File) => void
}) {
  const [arrastando, setArrastando] = useState(false)

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div
          onDragOver={(evento) => {
            evento.preventDefault()
            setArrastando(true)
          }}
          onDragLeave={() => setArrastando(false)}
          onDrop={(evento) => {
            evento.preventDefault()
            setArrastando(false)
            const arquivo = evento.dataTransfer.files[0]
            if (arquivo) onArquivo(arquivo)
          }}
          className={cn(
            'flex flex-col items-center rounded-md border border-dashed px-6 py-12 text-center transition-colors duration-150',
            arrastando ? 'border-ink bg-sunken' : 'border-hairline-strong',
          )}
        >
          <Icon name="upload" size={28} className="text-faint" />
          <p className="mt-4 text-sm font-medium text-ink">
            Arraste o arquivo OFX aqui, ou escolha no computador
          </p>
          <p className="mt-1 max-w-sm text-xs text-muted">
            O arquivo é lido no seu dispositivo. Ele não é enviado para lugar nenhum, e nenhuma
            senha do banco é pedida em momento algum.
          </p>

          <input
            ref={inputRef}
            type="file"
            accept=".ofx,.OFX,application/x-ofx,text/plain"
            className="sr-only"
            onChange={(evento) => {
              const arquivo = evento.target.files?.[0]
              if (arquivo) onArquivo(arquivo)
              // Permite escolher o mesmo arquivo de novo depois de um erro.
              evento.target.value = ''
            }}
          />
          <Button className="mt-5" onClick={() => inputRef.current?.click()}>
            Escolher arquivo
          </Button>

          {erro ? (
            <p
              role="alert"
              className="mt-5 flex items-start gap-2 text-left text-xs text-expense"
            >
              <Icon name="triangle-alert" size={14} className="mt-px shrink-0" />
              {erro}
            </p>
          ) : null}
        </div>
      </Card>

      <Card>
        <h2 className="text-sm font-medium text-ink">Onde baixar o OFX</h2>
        <ol className="mt-3 flex flex-col gap-2 text-xs text-muted">
          <li>
            <span className="text-ink">1.</span> Entre no aplicativo ou site do seu banco e abra o
            extrato da conta ou a fatura do cartão.
          </li>
          <li>
            <span className="text-ink">2.</span> Procure por "Exportar", "Baixar extrato" ou
            "Compartilhar", e escolha o formato <span className="text-ink">OFX</span>. Alguns bancos
            chamam de "OFX (Money)" ou "extrato para software financeiro".
          </li>
          <li>
            <span className="text-ink">3.</span> Selecione o período desejado e baixe. Se você
            importar o mesmo mês duas vezes, os repetidos são reconhecidos e não entram de novo.
          </li>
        </ol>
      </Card>
    </div>
  )
}

const MOTIVO: Record<'exact' | 'possible', { rotulo: string; dica: string }> = {
  exact: { rotulo: 'Já importado', dica: 'Este lançamento já está no histórico.' },
  possible: {
    rotulo: 'Parecido',
    dica: 'Há um lançamento seu com o mesmo valor em data próxima.',
  },
}

function LinhaDeCandidato({
  candidato,
  marcado,
  categorias,
  onAlternar,
  onCategoria,
}: {
  candidato: ImportCandidate
  marcado: boolean
  categorias: readonly { id: string; label: string }[]
  onAlternar: () => void
  onCategoria: (id: string) => void
}) {
  const motivo = candidato.duplicate ? MOTIVO[candidato.duplicate] : null

  return (
    <li
      className={cn(
        'flex flex-wrap items-center gap-x-4 gap-y-3 px-5 py-3.5 transition-opacity duration-150',
        !marcado && 'opacity-55',
      )}
    >
      {/*
        A caixa de seleção é o controle principal da linha, então a linha
        inteira responde ao clique. Só o seletor de categoria escapa disso, por
        ser o outro controle.
      */}
      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-3">
        <input
          type="checkbox"
          checked={marcado}
          onChange={onAlternar}
          className="size-4 shrink-0 accent-[var(--ink)]"
        />
        <span className="min-w-0">
          <span className="block truncate text-sm text-ink">{candidato.description}</span>
          <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
            <span className="tnum">{formatDayMonthYear(candidato.date)}</span>
            {motivo ? (
              <>
                <span aria-hidden="true">·</span>
                <span title={motivo.dica} className="text-ink">
                  {motivo.rotulo}
                </span>
              </>
            ) : null}
          </span>
        </span>
      </label>

      <SelectInput
        aria-label={`Categoria de ${candidato.description}`}
        value={candidato.categoryId}
        onChange={(evento) => onCategoria(evento.target.value)}
        className="w-40 shrink-0 text-xs"
      >
        {categorias.map((categoria) => (
          <option key={categoria.id} value={categoria.id}>
            {categoria.label}
          </option>
        ))}
      </SelectInput>

      <Money
        cents={candidato.amountCents}
        className={cn(
          'w-28 shrink-0 text-right text-sm',
          candidato.kind === 'income' ? 'text-income' : 'text-expense',
        )}
      />
    </li>
  )
}
