import { useMemo, useState } from 'react'
import { Icon, type IconName } from '@/components/Icon'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Segmented, type SegmentOption } from '@/components/ui/Controls'
import { EmptyState } from '@/components/ui/EmptyState'
import { SearchInput } from '@/components/ui/Field'
import type { AuditEntry } from '@/features/admin/adminApi'
import {
  filterAudit,
  formatAbsoluteDateTime,
  formatRelativeTime,
  type AuditFilter,
  type AuditPeriod,
} from '@/features/admin/adminMetrics'
import { useAdminAudit } from '@/features/admin/useAdminAudit'

/**
 * O que a administração fez, e quando.
 *
 * Existe porque este painel pode excluir contas: poder sem rastro é o que
 * transforma um erro honesto numa discussão sem resposta. O registro é escrito
 * pela Edge Function, no mesmo passo da ação, e nunca pelo navegador — daí a
 * tabela não ter policy de escrita para ninguém autenticado.
 *
 * Não há como editar nem apagar entrada por aqui, e isso é a funcionalidade,
 * não uma lacuna: um histórico que o próprio autor pode limpar não serve para
 * o que um histórico serve.
 */

const ACOES: Record<string, { icon: IconName; texto: string }> = {
  create: { icon: 'user-plus', texto: 'criou a conta' },
  invite: { icon: 'mail', texto: 'convidou' },
  disable: { icon: 'user-x', texto: 'desativou' },
  enable: { icon: 'user-check', texto: 'reativou' },
  reset_password: { icon: 'key-round', texto: 'redefiniu a senha de' },
  reset_mfa: { icon: 'shield-alert', texto: 'removeu a verificação em duas etapas de' },
  set_role: { icon: 'shield', texto: 'mudou o papel de' },
  delete_user: { icon: 'trash-2', texto: 'excluiu a conta de' },
  set_defaults: { icon: 'settings', texto: 'alterou os padrões de conta nova' },
}

const GRUPOS: readonly SegmentOption<AuditFilter>[] = [
  { value: 'todas', label: 'Tudo' },
  { value: 'contas', label: 'Contas' },
  { value: 'acesso', label: 'Acesso' },
  { value: 'permissoes', label: 'Permissões' },
  { value: 'ajustes', label: 'Ajustes' },
]

const PERIODOS: readonly SegmentOption<AuditPeriod>[] = [
  { value: 'tudo', label: 'Sempre' },
  { value: 'hoje', label: 'Hoje' },
  { value: '7d', label: '7 dias' },
  { value: '30d', label: '30 dias' },
]

export function AdminAuditPage() {
  const { entries, loading, error, reload } = useAdminAudit()

  const [query, setQuery] = useState('')
  const [grupo, setGrupo] = useState<AuditFilter>('todas')
  const [periodo, setPeriodo] = useState<AuditPeriod>('tudo')

  const agora = Date.now()
  const lista = useMemo(() => entries ?? [], [entries])
  const visiveis = useMemo(
    // `agora` fica fora das dependências de propósito: ele muda a cada render,
    // e refazer o recorte por causa disso não muda nada visível, só gasta
    // trabalho a cada tecla digitada.
    () => filterAudit(lista, { query, filter: grupo, period: periodo }, Date.now()),
    [lista, query, grupo, periodo],
  )

  const filtrando = query.trim() !== '' || grupo !== 'todas' || periodo !== 'tudo'

  return (
    <>
      <PageHeader
        title="Auditoria"
        description="O que foi feito neste painel, na ordem em que aconteceu."
        actions={
          <Button variant="quiet" icon="repeat" onClick={() => void reload()}>
            Atualizar
          </Button>
        }
      />

      <Card>
        {error ? (
          <EmptyState
            icon="triangle-alert"
            title="Não foi possível carregar o histórico"
            description={error}
            action={
              <Button size="sm" variant="quiet" icon="repeat" onClick={() => void reload()}>
                Tentar de novo
              </Button>
            }
          />
        ) : loading ? (
          <p className="text-[0.8125rem] text-muted">Carregando…</p>
        ) : lista.length === 0 ? (
          <EmptyState
            icon="list-filter"
            title="Nada registrado ainda"
            description="Criar, desativar, promover ou excluir uma conta passa a aparecer aqui."
          />
        ) : (
          <>
            {/*
              Os filtros só existem com histórico na mão. Numa tela vazia eles
              seriam controles que não filtram nada, ocupando o lugar da frase
              que explica por que ela está vazia.
            */}
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <SearchInput
                label="Buscar no histórico"
                placeholder="Buscar por e-mail…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="lg:max-w-xs"
              />
              <div className="flex flex-wrap gap-2">
                <Segmented
                  label="Tipo de ação"
                  options={GRUPOS}
                  value={grupo}
                  onChange={setGrupo}
                  size="sm"
                  className="lg:w-auto"
                />
                <Segmented
                  label="Período"
                  options={PERIODOS}
                  value={periodo}
                  onChange={setPeriodo}
                  size="sm"
                  className="lg:w-auto"
                />
              </div>
            </div>

            <div className="mt-5 border-t border-hairline pt-1">
              {visiveis.length === 0 ? (
                <EmptyState
                  icon="list-filter"
                  size="sm"
                  title="Nada neste recorte"
                  description="Nenhum registro combina com a busca, o tipo e o período escolhidos."
                  action={
                    <Button
                      size="sm"
                      variant="quiet"
                      onClick={() => {
                        setQuery('')
                        setGrupo('todas')
                        setPeriodo('tudo')
                      }}
                    >
                      Limpar filtros
                    </Button>
                  }
                />
              ) : (
                <>
                  <ul className="flex flex-col divide-y divide-hairline">
                    {visiveis.map((entry) => (
                      <Linha key={entry.id} entry={entry} agora={agora} />
                    ))}
                  </ul>

                  <p className="mt-4 text-xs text-muted">
                    {visiveis.length} {visiveis.length === 1 ? 'registro' : 'registros'}
                    {filtrando ? ` de ${lista.length}` : null}
                  </p>
                </>
              )}
            </div>
          </>
        )}
      </Card>
    </>
  )
}

function Linha({ entry, agora }: { entry: AuditEntry; agora: number }) {
  const acao = ACOES[entry.action] ?? { icon: 'circle-dashed' as IconName, texto: entry.action }

  return (
    <li className="flex items-start gap-3 py-3.5">
      <span className="mt-0.5 inline-flex size-8 shrink-0 items-center justify-center rounded-sm bg-sunken text-faint">
        <Icon name={acao.icon} size={15} />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-[0.8125rem] leading-relaxed text-ink">
          <span className="font-semibold">{entry.actor_email}</span> {acao.texto}
          {entry.target_email ? <span className="font-semibold"> {entry.target_email}</span> : null}
          {entry.detail ? <span className="text-muted"> ({entry.detail})</span> : null}
        </p>
        {/*
          Relativo e absoluto juntos. "Há 3 min" responde bem enquanto o evento
          é recente e para de responder no dia seguinte, quando a pergunta vira
          que horas aquilo foi — e conferir é exatamente o que se vem fazer
          aqui.
        */}
        <p className="mt-0.5 text-xs text-faint">
          {formatRelativeTime(entry.created_at, agora)} · {formatAbsoluteDateTime(entry.created_at)}
        </p>
      </div>
    </li>
  )
}
