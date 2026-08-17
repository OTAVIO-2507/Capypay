import { useEffect, useState } from 'react'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Field, TextInput } from '@/components/ui/Field'
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

export function MeuPluggyPanel({ onExtratos }: Props) {
  const [conexoes, setConexoes] = useState<Conexao[] | null>(null)
  const [itemId, setItemId] = useState('')
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
      const extratos = await sincronizarComPluggy(item)
      const comLancamentos = extratos.filter((extrato) => extrato.entries.length > 0)

      if (comLancamentos.length === 0) {
        setErro('A conexão respondeu, mas não há lançamentos nos últimos 90 dias.')
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

        {conexoes === null ? (
          <p className="mt-5 text-xs text-muted">Carregando suas conexões...</p>
        ) : conexoes.length > 0 ? (
          <ul className="mt-5 flex flex-col divide-y divide-hairline border-t border-hairline">
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
