import { useState, type FormEvent } from 'react'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { CardWell } from '@/components/ui/Card'
import { Dialog } from '@/components/ui/Dialog'
import { Field, SelectInput, TextInput } from '@/components/ui/Field'
import { inviteUser } from './adminApi'
import type { Role } from '@/store/authStore'

/**
 * Convite por link.
 *
 * A alternativa a criar a conta com uma senha escolhida por outra pessoa: aqui
 * quem recebe define a própria senha, e nenhuma senha temporária precisa
 * circular por conversa de trabalho.
 *
 * O link é gerado e mostrado, não enviado: não há SMTP configurado nesta
 * instalação, então o envio fica com quem convida, pelo canal que já usa.
 * Assumir um e-mail que nunca sai seria pior que pedir a cópia à mão.
 */
export function InviteUserDialog({
  open,
  onClose,
  onInvited,
}: {
  open: boolean
  onClose: () => void
  onInvited: () => void
}) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<Role>('user')
  const [link, setLink] = useState<string | null>(null)
  const [copiado, setCopiado] = useState(false)
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  function fechar() {
    setEmail('')
    setRole('user')
    setLink(null)
    setCopiado(false)
    setErro(null)
    setEnviando(false)
    onClose()
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setEnviando(true)
    setErro(null)

    try {
      setLink(await inviteUser(email, role))
      onInvited()
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : 'Não foi possível gerar o convite.')
    } finally {
      setEnviando(false)
    }
  }

  async function copiar() {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopiado(true)
    } catch {
      // Área de transferência bloqueada (contexto sem HTTPS, permissão negada):
      // o link continua visível e selecionável na tela, então nada se perde.
      setErro('Não foi possível copiar. Selecione o link e copie à mão.')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={fechar}
      title="Convidar por link"
      description={
        link
          ? 'Repasse este link para a pessoa definir a própria senha.'
          : 'A pessoa recebe um link e escolhe a própria senha.'
      }
    >
      {link ? (
        <div className="flex flex-col gap-4">
          <CardWell>
            <p className="font-mono text-xs break-all text-ink">{link}</p>
          </CardWell>

          <p className="text-xs leading-relaxed text-muted">
            O link vale por tempo limitado e só pode ser usado uma vez. Se expirar, gere outro
            por aqui.
          </p>

          {erro ? (
            <p className="flex items-start gap-2 text-xs font-medium text-ink">
              <Icon name="circle-alert" size={14} className="mt-px" />
              {erro}
            </p>
          ) : null}

          <div className="flex gap-2">
            <Button variant="ghost" onClick={fechar} block>
              Fechar
            </Button>
            <Button icon={copiado ? 'check' : 'download'} onClick={() => void copiar()} block>
              {copiado ? 'Copiado' : 'Copiar link'}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
          <Field label="E-mail" error={erro ?? undefined}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                type="email"
                autoComplete="off"
                aria-describedby={describedBy}
                invalid={invalid}
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            )}
          </Field>

          <Field label="Papel">
            {({ id }) => (
              <SelectInput
                id={id}
                value={role}
                onChange={(event) => setRole(event.target.value as Role)}
              >
                <option value="user">Usuário (usa o app financeiro)</option>
                <option value="admin">Admin (gerencia contas)</option>
              </SelectInput>
            )}
          </Field>

          <div className="mt-2 flex gap-2">
            <Button variant="ghost" onClick={fechar} block>
              Cancelar
            </Button>
            <Button type="submit" block icon="mail" loading={enviando}>
              Gerar convite
            </Button>
          </div>
        </form>
      )}
    </Dialog>
  )
}
