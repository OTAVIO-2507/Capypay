import { useState, type FormEvent } from 'react'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, TextInput } from '@/components/ui/Field'
import { Select } from '@/components/ui/Select'
import { createUser, type AdminUserSummary } from './adminApi'

interface CreateUserDialogProps {
  open: boolean
  onClose: () => void
  onCreated: (user: AdminUserSummary) => void
}

/**
 * Não existe cadastro público (ver `LoginPage`) — toda conta nasce aqui, e só
 * aqui. A senha inicial é escolhida pelo admin e repassada por fora do app;
 * não há envio de e-mail, porque não há SMTP configurado.
 */
export function CreateUserDialog({ open, onClose, onCreated }: CreateUserDialogProps) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState<'user' | 'admin'>('user')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  function reset() {
    setEmail('')
    setPassword('')
    setRole('user')
    setError(null)
    setSubmitting(false)
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    try {
      const user = await createUser({ email, password, role })
      onCreated(user)
      reset()
      onClose()
    } catch (cause) {
      setSubmitting(false)
      setError(cause instanceof Error ? cause.message : 'Não foi possível criar a conta.')
    }
  }

  return (
    <Dialog
      open={open}
      onClose={() => {
        reset()
        onClose()
      }}
      title="Nova conta"
      description="A pessoa entra com este e-mail e senha. Repasse por fora, não há envio automático."
    >
      <form onSubmit={handleSubmit} className="flex flex-col gap-4" noValidate>
        <Field label="E-mail">
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

        <Field label="Senha inicial" error={error ?? undefined} hint="Pelo menos 6 caracteres.">
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              type="text"
              autoComplete="off"
              aria-describedby={describedBy}
              invalid={invalid}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          )}
        </Field>

        <Field label="Papel">
          {({ id }) => (
            <Select
              id={id}
              value={role}
              onChange={(value) => setRole(value as 'user' | 'admin')}
                options={[
                  { value: 'user', label: 'Usuário (usa o app financeiro)' },
                  { value: 'admin', label: 'Admin (gerencia contas)' },
                ]}
            />
          )}
        </Field>

        <div className="mt-2 flex gap-2">
          <Button
            variant="ghost"
            block
            onClick={() => {
              reset()
              onClose()
            }}
          >
            Cancelar
          </Button>
          <Button type="submit" block icon="user-plus" loading={submitting}>
            Criar conta
          </Button>
        </div>
      </form>
    </Dialog>
  )
}
