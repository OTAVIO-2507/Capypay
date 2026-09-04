import { useEffect, useState } from 'react'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Segmented, type SegmentOption } from '@/components/ui/Controls'
import { Field, TextInput } from '@/components/ui/Field'
import { shiftDate, todayIso } from '@/lib/date'
import { listarConexoes, type Conexao } from './connectionsApi'
import { registrarItemDoMeuPluggy, sincronizarComPluggy, type ExtratoSincronizado } from './pluggyApi'

/**
 * A ponte com o Meu Pluggy.
 *
 * O Meu Pluggy é o portal pessoal e gratuito da Pluggy: a pessoa conecta os
 * próprios bancos lá, e as credenciais do Dashboard dão acesso de leitura a
 * essas conexões. É o único caminho automático que existe sem plano pago, e a
 * razão é a mesma que travou o widget: criar conexão é o que custa, ler o que
 * já está conectado não.
 *
 * O identificador da conexão é digitado à mão porque a API não tem como listar
 * conexões, e isso é deliberado do lado deles: expor "quais items são meus"
 * seria transformar a credencial da aplicação numa chave mestra. Cabe a quem
 * integra guardar o identificador de cada conexão.
 *
 * Ele fica no **Dashboard**, e não no portal do Meu Pluggy — em Dados
 * Financeiros, ou no app Demo da aplicação pelo menu de três pontos. O webhook
 * preenche sozinho as conexões criadas depois que ele foi configurado; este
 * campo existe para as anteriores e para quando o webhook não está no ar.
 */

interface Props {
  onExtratos: (extratos: ExtratoSincronizado[]) => void
}

/**
 * Quanto histórico buscar.
 *
 * Não é preferência de gosto: o aplicativo calcula saldo somando lançamentos,
 * então o período escolhido é o que decide se o número do painel faz sentido.
 * Noventa dias abre a tela porque é rápido e cobre a conferência do mês; quem
 * está começando a usar quer o ano inteiro, e paga por isso em tempo de espera.
 */
const PERIODOS: readonly SegmentOption<string>[] = [
  { value: '3', label: '3 meses' },
  { value: '6', label: '6 meses' },
  { value: '12', label: '1 ano' },
  { value: '24', label: '2 anos' },
]

/**
 * O formato do identificador de conexão da Pluggy, que é um UUID.
 *
 * Deliberadamente mais frouxo que a checagem do servidor: aqui só interessa
 * separar "digitou errado" de "é um identificador", e uma regra mais estrita
 * que a do servidor recusaria na tela algo que o servidor aceitaria — o pior
 * tipo de divergência, porque não há como a pessoa descobrir qual das duas
 * está certa.
 */
const PARECE_ITEM_ID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/**
 * A data de partida da busca, contada a partir de hoje.
 *
 * Usa `shiftDate` em vez de montar a data à mão, e os dois motivos são os que o
 * cabeçalho de `lib/date.ts` descreve como aprendidos do jeito caro:
 *
 * `new Date(ano, mes - 3, dia).toISOString()` constrói no fuso local e formata
 * em UTC. No Brasil o dia sobrevive por três horas de folga; em qualquer fuso a
 * leste de Greenwich, a data volta um dia — e o produto passaria a buscar uma
 * janela diferente da escolhida, sem nada na tela dizendo isso.
 *
 * E `mes - 3` transborda: em 31 de maio, três meses atrás é 31 de fevereiro,
 * que o `Date` normaliza para 3 de março. A busca começaria três dias depois do
 * pedido, e quem procurasse um lançamento do fim de fevereiro não o encontraria
 * sem entender por quê. `shiftDate` fixa no último dia do mês, que é o que
 * "mesmo dia, três meses atrás" quer dizer quando esse dia não existe.
 */
function inicioDe(mesesAtras: number): string {
  return shiftDate(todayIso(), -mesesAtras, 'month')
}

export function MeuPluggyPanel({ onExtratos }: Props) {
  const [conexoes, setConexoes] = useState<Conexao[] | null>(null)
  const [itemId, setItemId] = useState('')
  const [periodo, setPeriodo] = useState('3')
  const [ocupado, setOcupado] = useState<string | null>(null)
  const [erro, setErro] = useState<string | null>(null)

  useEffect(() => {
    let ativo = true

    listarConexoes()
      .then((lista) => ativo && setConexoes(lista))
      // Ler conexões falha quando a tabela ainda não existe no projeto. Isso não
      // é erro da pessoa e não deve virar alerta vermelho: a tela cai no estado
      // de "nenhuma conexão", que é o que ela veria de qualquer forma.
      .catch(() => ativo && setConexoes([]))

    return () => {
      ativo = false
    }
  }, [])

  async function vincular() {
    const limpo = itemId.trim()
    if (!limpo) return

    /*
     * O formato é conferido aqui só para a mensagem ser útil.
     *
     * Quem recusa de verdade é a Edge Function, e é lá que a recusa importa —
     * mas a mensagem dela ("Informe a conexão do Meu Pluggy") foi escrita para
     * campo vazio e não ajuda quem colou um pedaço do identificador ou copiou
     * a linha errada do painel. Este campo é preenchido à mão, olhando para
     * outra tela; errar aqui é o caso comum, não a exceção.
     */
    if (!PARECE_ITEM_ID.test(limpo)) {
      setErro(
        'Isto não parece um Item ID. Ele tem 36 caracteres, no formato 00000000-0000-0000-0000-000000000000, e fica no Dashboard da Pluggy.',
      )
      return
    }

    setOcupado('vincular')
    setErro(null)
    try {
      await registrarItemDoMeuPluggy(limpo)
      setConexoes(await listarConexoes())
      setItemId('')
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível vincular a conexão.')
    } finally {
      setOcupado(null)
    }
  }

  async function sincronizar(item: string) {
    setOcupado(item)
    setErro(null)
    try {
      const extratos = await sincronizarComPluggy(item, inicioDe(Number(periodo)))
      const comLancamentos = extratos.filter((extrato) => extrato.entries.length > 0)

      if (comLancamentos.length === 0) {
        setErro(
          'A conexão respondeu, mas não veio nenhum lançamento no período. Tente um período maior.',
        )
        return
      }

      onExtratos(comLancamentos)
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível buscar os lançamentos.')
    } finally {
      setOcupado(null)
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <Card>
        <div className="flex items-start gap-3">
          <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-sunken text-faint">
            <Icon name="link" size={16} />
          </span>
          <div className="min-w-0">
            <h2 className="text-sm font-medium text-ink">Meu Pluggy</h2>
            <p className="mt-1 text-xs text-muted">
              Conecte seus bancos no portal do Meu Pluggy, ligue os itens à aplicação demo no
              Dashboard, e vincule a conexão aqui. A partir daí os lançamentos vêm sozinhos, sem
              arquivo. O uso pessoal é gratuito e não expira.
            </p>
          </div>
        </div>

        {conexoes !== null && conexoes.length > 0 ? (
          <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-hairline pt-5">
            <span className="text-xs text-muted">Quanto histórico buscar</span>
            <Segmented
              value={periodo}
              onChange={setPeriodo}
              options={PERIODOS}
              label="Período a buscar"
              size="sm"
            />
          </div>
        ) : null}

        {conexoes === null ? (
          <p className="mt-5 text-xs text-muted">Carregando suas conexões...</p>
        ) : conexoes.length > 0 ? (
          <ul className="mt-4 flex flex-col divide-y divide-hairline border-t border-hairline">
            {conexoes.map((conexao) => (
              <li key={conexao.itemId} className="flex items-center justify-between gap-3 py-3">
                <span className="min-w-0">
                  <span className="block truncate font-mono text-xs text-ink">{conexao.itemId}</span>
                  <span className="mt-0.5 block text-xs text-muted">
                    {conexao.lastError
                      ? 'A conexão precisa ser renovada no Meu Pluggy'
                      : conexao.pendingSync
                        ? 'Há dados novos esperando'
                        : 'Em dia'}
                  </span>
                </span>
                <Button
                  variant="quiet"
                  size="sm"
                  icon="refresh-cw"
                  disabled={ocupado !== null}
                  onClick={() => void sincronizar(conexao.itemId)}
                  className="shrink-0"
                >
                  {ocupado === conexao.itemId ? 'Buscando...' : 'Buscar lançamentos'}
                </Button>
              </li>
            ))}
          </ul>
        ) : null}

        <div className="mt-5 border-t border-hairline pt-5">
          <Field
            label="Vincular uma conexão"
            hint="No Dashboard da Pluggy: Dados Financeiros, ou a aplicação e “Ir para Demo”, menu de três pontos, Copiar Item ID."
          >
            {({ id, describedBy }) => (
              <div className="flex gap-2">
                <TextInput
                  id={id}
                  aria-describedby={describedBy}
                  value={itemId}
                  onChange={(evento) => setItemId(evento.target.value)}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  spellCheck={false}
                  className="font-mono text-xs"
                />
                <Button
                  variant="quiet"
                  disabled={itemId.trim() === '' || ocupado !== null}
                  onClick={() => void vincular()}
                  className="shrink-0"
                >
                  {ocupado === 'vincular' ? 'Conferindo...' : 'Vincular'}
                </Button>
              </div>
            )}
          </Field>

          <p className="mt-3 text-xs text-muted">
            Ainda não tem conta?{' '}
            <a
              href="https://meu.pluggy.ai"
              target="_blank"
              rel="noreferrer noopener"
              className="inline-flex items-center gap-1 font-medium text-ink underline-offset-2 hover:underline"
            >
              Criar no meu.pluggy.ai
              <Icon name="arrow-right" size={12} />
            </a>
          </p>
        </div>

        {erro ? (
          <p role="alert" className="mt-4 flex items-start gap-2 text-xs text-expense">
            <Icon name="triangle-alert" size={14} className="mt-px shrink-0" />
            {erro}
          </p>
        ) : null}
      </Card>
    </div>
  )
}
