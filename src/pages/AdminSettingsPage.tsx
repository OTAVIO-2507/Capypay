import { useState, type FormEvent } from 'react'
import { Avatar } from '@/components/Avatar'
import { Icon } from '@/components/Icon'
import { PageHeader } from '@/components/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card, CardHeader, CardWell } from '@/components/ui/Card'
import { Segmented, type SegmentOption } from '@/components/ui/Controls'
import { Field, TextInput } from '@/components/ui/Field'
import { supabase } from '@/data/supabaseClient'
import type { ThemePreference } from '@/domain/types'
import { AdminProfileDialog } from '@/features/admin/AdminProfileDialog'
import { TwoFactorCard } from '@/features/security/TwoFactorCard'
import { useAdminProfile, useAdminPreferences } from '@/store/adminPreferences'
import { useAuthStore } from '@/store/authStore'

const TEMAS: readonly SegmentOption<ThemePreference>[] = [
  { value: 'light', label: 'Claro', icon: 'sun' },
  { value: 'dark', label: 'Escuro', icon: 'moon' },
  { value: 'system', label: 'Automático', icon: 'monitor' },
]

const MINIMO_SENHA = 6

export function AdminSettingsPage() {
  const [editandoPerfil, setEditandoPerfil] = useState(false)

  return (
    <>
      <PageHeader title="Ajustes" description="Preferências desta conta de administração." />

      <div className="grid gap-5 lg:grid-cols-2">
        <Perfil onEdit={() => setEditandoPerfil(true)} />
        <Aparencia />
        {/* Ocupa a linha inteira: com ele numa das colunas, a grade de cinco
            cartões terminaria com um vão vazio ao lado do último. */}
        <TwoFactorCard />
        <TrocarSenha />
        <Sessao />
      </div>

      <AdminProfileDialog open={editandoPerfil} onClose={() => setEditandoPerfil(false)} />
    </>
  )
}

/**
 * Resumo do perfil, com a edição no diálogo.
 *
 * Mesmo arranjo do Ajustes do app financeiro: o cartão mostra quem você é e o
 * botão abre o mesmo diálogo que o menu da barra de topo abre. Um seletor de
 * retrato embutido aqui seria um segundo caminho de edição para manter em pé
 * junto com o primeiro.
 */
function Perfil({ onEdit }: { onEdit: () => void }) {
  const perfil = useAdminProfile()
  const email = useAuthStore((state) => state.session?.user.email)

  return (
    <Card>
      <CardHeader
        title="Perfil"
        description="Nome, retrato e saudação. Fica neste navegador."
      />
      <div className="flex items-center justify-between gap-4">
        <div className="flex min-w-0 items-center gap-3.5">
          <Avatar profile={perfil} size={48} />
          <div className="min-w-0">
            <p className="truncate text-[0.8125rem] font-semibold text-ink">
              {perfil.name.trim() || email || 'Sem nome cadastrado'}
            </p>
            <p className="mt-0.5 truncate text-xs text-muted">
              Ilustração {perfil.avatar.image}
              {perfil.greeting ? ' · com saudação' : ' · sem saudação'}
            </p>
          </div>
        </div>
        <Button variant="quiet" size="sm" icon="square-pen" onClick={onEdit} className="shrink-0">
          Personalizar
        </Button>
      </div>
    </Card>
  )
}

function Aparencia() {
  const theme = useAdminPreferences((state) => state.theme)
  const setTheme = useAdminPreferences((state) => state.setTheme)

  return (
    <Card>
      <CardHeader title="Aparência" description="Como esta tela se apresenta." />
      <Segmented label="Tema" options={TEMAS} value={theme} onChange={setTheme} />
      <p className="mt-4 text-xs leading-relaxed text-muted">
        Automático acompanha o sistema operacional e muda sozinho ao anoitecer. Esta escolha e o
        retrato ficam neste navegador, não na conta: uma sessão de administração não abre o
        documento de dados de ninguém, nem o próprio, e é lá que essas preferências moram do lado
        do app financeiro.
      </p>
    </Card>
  )
}

/**
 * Troca da própria senha.
 *
 * Diferente de tudo o mais no painel, isto **não** passa pela Edge Function:
 * `updateUser` age sobre a sessão de quem chama, então não há privilégio a
 * conceder nem papel a verificar. É também a única forma de alguém trocar a
 * própria senha no produto inteiro hoje — a redefinição pelo painel é sempre
 * mediada por um administrador.
 */
function TrocarSenha() {
  const email = useAuthStore((state) => state.session?.user.email)
  const [senha, setSenha] = useState('')
  const [confirmacao, setConfirmacao] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [pronto, setPronto] = useState(false)
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setErro(null)
    setPronto(false)

    if (senha.length < MINIMO_SENHA) {
      return setErro(`A senha precisa de pelo menos ${MINIMO_SENHA} caracteres.`)
    }
    if (senha !== confirmacao) {
      return setErro('As duas senhas não são iguais.')
    }

    setEnviando(true)
    const { error } = await supabase.auth.updateUser({ password: senha })
    setEnviando(false)

    if (error) return setErro('Não foi possível trocar a senha. Tente entrar de novo.')

    setSenha('')
    setConfirmacao('')
    setPronto(true)
  }

  return (
    <Card>
      <CardHeader
        title="Senha"
        description={email ? `Da conta ${email}. Vale em qualquer dispositivo.` : undefined}
      />

      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="Nova senha" hint={`Pelo menos ${MINIMO_SENHA} caracteres.`}>
          {({ id, describedBy }) => (
            <TextInput
              id={id}
              type="password"
              autoComplete="new-password"
              aria-describedby={describedBy}
              value={senha}
              onChange={(event) => setSenha(event.target.value)}
            />
          )}
        </Field>

        <Field label="Repita a nova senha" error={erro ?? undefined}>
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="password"
              autoComplete="new-password"
              aria-describedby={describedBy}
              invalid={invalid}
              value={confirmacao}
              onChange={(event) => setConfirmacao(event.target.value)}
            />
          )}
        </Field>

        {pronto ? (
          <CardWell className="flex items-center gap-2.5">
            <Icon name="check" size={15} className="text-ink" />
            <span className="text-xs text-ink">
              Senha trocada. A próxima entrada já usa a nova.
            </span>
          </CardWell>
        ) : null}

        <Button type="submit" icon="key-round" loading={enviando} block>
          Trocar senha
        </Button>
      </form>
    </Card>
  )
}

/**
 * A sessão atual e a saída.
 *
 * Ocupa, no Ajustes do admin, o lugar que a "Zona de risco" ocupa no do
 * usuário: o último cartão, o das ações que encerram alguma coisa. A
 * diferença é que aqui não há nada a apagar — quem administra não tem dado
 * financeiro, e excluir a própria conta é recusado pelo servidor, então o
 * fim de linha desta tela é sair.
 */
function Sessao() {
  const email = useAuthStore((state) => state.session?.user.email)
  const signOut = useAuthStore((state) => state.signOut)

  return (
    <Card>
      <CardHeader title="Sessão" description="Este acesso, neste dispositivo." />

      <CardWell className="flex flex-col gap-2.5">
        <Linha rotulo="Conta" valor={email ?? 'desconhecida'} />
        <Linha rotulo="Papel" valor="Administrador" />
      </CardWell>

      <div className="mt-4 flex items-center justify-between gap-4 rounded-md bg-sunken p-3.5">
        <div className="min-w-0">
          <p className="text-[0.8125rem] font-medium text-ink">Sair desta conta</p>
          <p className="text-xs text-muted">
            Encerra a sessão neste navegador. O retrato e o tema continuam salvos aqui.
          </p>
        </div>
        <Button
          variant="quiet"
          size="sm"
          icon="log-out"
          onClick={() => void signOut()}
          className="shrink-0 bg-sheet"
        >
          Sair
        </Button>
      </div>

      <p className="mt-4 text-xs leading-relaxed text-muted">
        Uma conta de administração não tem lançamentos, metas nem limites para apagar: ela
        gerencia acesso e nada além disso.
      </p>
    </Card>
  )
}

function Linha({ rotulo, valor }: { rotulo: string; valor: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4">
      <span className="shrink-0 text-xs text-muted">{rotulo}</span>
      <span className="truncate text-xs text-ink">{valor}</span>
    </div>
  )
}
