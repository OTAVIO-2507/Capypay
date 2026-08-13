import { useState } from 'react'
import { Icon } from '@/components/Icon'
import { CardWell } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Controls'
import { ConfirmDialog, Dialog } from '@/components/ui/Dialog'
import { ResetPasswordDialog } from './ResetPasswordDialog'
import { deleteUser, disableUser, enableUser, resetMfa, resetPassword, setRole } from './adminApi'
import type { AdminUserSummary } from './adminApi'
import { formatAbsoluteDate, formatRelativeTime } from './adminMetrics'

/*
 * Toda ação daqui passa por uma confirmação, sem exceção. As três primeiras
 * são reversíveis, e mesmo assim confirmam: o clique errado numa lista de
 * ações empilhadas é o modo de falha real desta tela, e desfazer uma promoção
 * indevida exige lembrar que ela aconteceu.
 */
type Confirmacao =
  | 'senha'
  | 'promover'
  | 'reativar'
  | 'remover-2fa'
  | 'desativar'
  | 'rebaixar'
  | 'excluir'
  | null

/**
 * A ficha de uma conta: tudo que se sabe dela e tudo que se pode fazer com
 * ela, num lugar só.
 *
 * As ações moravam soltas na linha da tabela, o que limitava o que cabia
 * (três ícones) e obrigava a adivinhar cada um pelo desenho. Aqui elas têm
 * nome, consequência escrita, e espaço para as que faltavam: trocar o papel
 * e excluir.
 */
export function UserDetailDialog({
  user,
  onClose,
  onChanged,
  onTemporaryPassword,
}: {
  user: AdminUserSummary | null
  onClose: () => void
  onChanged: () => void
  onTemporaryPassword: (email: string, password: string) => void
}) {
  const [busy, setBusy] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState<Confirmacao>(null)

  if (!user) return null

  async function executar(acao: () => Promise<void>) {
    setBusy(true)
    setErro(null)
    try {
      await acao()
      setConfirmando(null)
      onChanged()
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : 'Não foi possível concluir a ação.')
    } finally {
      setBusy(false)
    }
  }

  const alvo = user
  const ehAdmin = alvo.role === 'admin'

  return (
    <>
      <Dialog open onClose={onClose} title={alvo.email} description="Conta de acesso">
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={ehAdmin ? 'strong' : 'quiet'} icon={ehAdmin ? 'shield' : 'user'}>
              {ehAdmin ? 'Administrador' : 'Usuário'}
            </Badge>
            <Badge
              tone={alvo.disabled ? 'outline' : 'quiet'}
              icon={alvo.disabled ? 'user-x' : 'user-check'}
            >
              {alvo.disabled ? 'Desativada' : 'Ativa'}
            </Badge>
          </div>

          <CardWell className="flex flex-col gap-2.5">
            <Linha rotulo="Criada em" valor={formatAbsoluteDate(alvo.createdAt)} />
            <Linha
              rotulo="Último acesso"
              valor={
                alvo.lastSignInAt
                  ? `${formatRelativeTime(alvo.lastSignInAt, Date.now())} (${formatAbsoluteDate(alvo.lastSignInAt)})`
                  : 'Nunca entrou'
              }
            />
            <Linha rotulo="Identificador" valor={alvo.id} mono />
          </CardWell>

          {erro ? (
            <p className="flex items-start gap-2 text-xs font-medium text-ink">
              <Icon name="circle-alert" size={14} className="mt-px" />
              {erro}
            </p>
          ) : null}

          <div className="flex flex-col gap-2">
            <Acao
              icon="key-round"
              titulo="Redefinir senha"
              descricao="Gera uma senha temporária para você repassar."
              disabled={busy}
              onClick={() => setConfirmando('senha')}
            />

            <Acao
              icon={ehAdmin ? 'user' : 'shield'}
              titulo={ehAdmin ? 'Rebaixar para usuário' : 'Promover a administrador'}
              descricao={
                ehAdmin
                  ? 'Perde o painel de administração e passa a usar o app financeiro.'
                  : 'Passa a gerenciar contas e deixa de acessar o app financeiro.'
              }
              disabled={busy}
              onClick={() => setConfirmando(ehAdmin ? 'rebaixar' : 'promover')}
            />

            {alvo.disabled ? (
              <Acao
                icon="user-check"
                titulo="Reativar conta"
                descricao="Volta a conseguir entrar."
                disabled={busy}
                onClick={() => setConfirmando('reativar')}
              />
            ) : (
              <Acao
                icon="user-x"
                titulo="Desativar conta"
                descricao="Bloqueia o acesso sem apagar nada."
                disabled={busy}
                onClick={() => setConfirmando('desativar')}
              />
            )}

            <Acao
              icon="shield"
              titulo="Remover verificação em duas etapas"
              descricao="Para quem perdeu o aparelho com o aplicativo autenticador."
              disabled={busy}
              onClick={() => setConfirmando('remover-2fa')}
            />

            <Acao
              icon="trash-2"
              titulo="Excluir conta"
              descricao="Apaga a conta e todos os dados financeiros dela."
              disabled={busy}
              onClick={() => setConfirmando('excluir')}
            />
          </div>
        </div>
      </Dialog>

      <ResetPasswordDialog
        email={alvo.email}
        open={confirmando === 'senha'}
        busy={busy}
        erro={confirmando === 'senha' ? erro : null}
        onClose={() => {
          setErro(null)
          setConfirmando(null)
        }}
        onConfirm={(senha) =>
          void executar(async () => {
            onTemporaryPassword(alvo.email, await resetPassword(alvo.id, senha))
          })
        }
      />

      <ConfirmDialog
        open={confirmando === 'promover'}
        onClose={() => setConfirmando(null)}
        onConfirm={() => void executar(() => setRole(alvo.id, 'admin'))}
        title="Promover a administrador"
        message={`${alvo.email} passa a gerenciar contas e perde o acesso ao app financeiro. Os dados financeiros da conta continuam guardados, mas ninguém consegue abri-los enquanto ela for de administração.`}
        confirmLabel="Promover"
      />

      <ConfirmDialog
        open={confirmando === 'reativar'}
        onClose={() => setConfirmando(null)}
        onConfirm={() => void executar(() => enableUser(alvo.id))}
        title="Reativar conta"
        message={`${alvo.email} volta a conseguir entrar, com a mesma senha de antes.`}
        confirmLabel="Reativar"
      />

      <ConfirmDialog
        open={confirmando === 'remover-2fa'}
        onClose={() => setConfirmando(null)}
        onConfirm={() => void executar(() => resetMfa(alvo.id))}
        title="Remover verificação em duas etapas"
        message={`${alvo.email} volta a entrar só com a senha, e a oferta de cadastrar um aplicativo novo reaparece na próxima entrada. Faça isto apenas se você tiver certeza de quem está pedindo.`}
        confirmLabel="Remover verificação"
      />

      <ConfirmDialog
        open={confirmando === 'desativar'}
        onClose={() => setConfirmando(null)}
        onConfirm={() => void executar(() => disableUser(alvo.id))}
        title="Desativar conta"
        message={`${alvo.email} não vai conseguir entrar até a conta ser reativada. Nada é apagado.`}
        confirmLabel="Desativar conta"
      />

      <ConfirmDialog
        open={confirmando === 'rebaixar'}
        onClose={() => setConfirmando(null)}
        onConfirm={() => void executar(() => setRole(alvo.id, 'user'))}
        title="Rebaixar para usuário"
        message={`${alvo.email} perde o acesso ao painel de administração. Se for a única conta de administrador, a troca é recusada pelo servidor.`}
        confirmLabel="Rebaixar"
      />

      <ConfirmDialog
        open={confirmando === 'excluir'}
        onClose={() => setConfirmando(null)}
        onConfirm={() =>
          void executar(async () => {
            await deleteUser(alvo.id)
            onClose()
          })
        }
        title="Excluir conta"
        message={`A conta ${alvo.email} e todos os lançamentos, metas e limites dela serão apagados definitivamente. Não há como desfazer.`}
        confirmLabel="Excluir definitivamente"
      />
    </>
  )
}

function Linha({ rotulo, valor, mono = false }: { rotulo: string; valor: string; mono?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-xs text-muted">{rotulo}</span>
      <span className={`truncate text-xs text-ink ${mono ? 'font-mono' : ''}`}>{valor}</span>
    </div>
  )
}

function Acao({
  icon,
  titulo,
  descricao,
  disabled,
  onClick,
}: {
  icon: Parameters<typeof Icon>[0]['name']
  titulo: string
  descricao: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className="-mx-2 flex items-start gap-3 rounded-md px-2 py-2.5 text-left transition-colors duration-150 hover:bg-sunken disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
    >
      <Icon name={icon} size={16} className="mt-0.5 text-faint" />
      <span className="min-w-0">
        <span className="block text-[0.8125rem] font-medium text-ink">{titulo}</span>
        <span className="block text-xs leading-relaxed text-muted">{descricao}</span>
      </span>
    </button>
  )
}
