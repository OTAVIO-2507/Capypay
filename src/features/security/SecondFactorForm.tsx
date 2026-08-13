import { useState, type FormEvent } from 'react'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { useAuthStore } from '@/store/authStore'
import { codigoCompleto, normalizarCodigo } from './twoFactor'

/**
 * A segunda etapa do login.
 *
 * Substitui o formulário de e-mail e senha em vez de aparecer abaixo dele: a
 * senha já foi aceita, e deixar os campos preenchidos na tela sugeriria que
 * ainda há algo a corrigir ali.
 *
 * Sair daqui é sair de verdade (`signOut`), e não voltar para os campos: a
 * sessão de senha já existe, e um "voltar" que a deixasse pendurada seria uma
 * porta entreaberta.
 */
export function SecondFactorForm() {
  const submitSecondFactor = useAuthStore((state) => state.submitSecondFactor)
  const signOut = useAuthStore((state) => state.signOut)

  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setEnviando(true)
    setErro(null)

    const resultado = await submitSecondFactor(codigo)

    setEnviando(false)
    if (resultado.error) {
      setErro(resultado.error)
      setCodigo('')
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-8 flex flex-col gap-4 rounded-lg border border-hairline bg-sheet p-6 shadow-[var(--shadow-float)]"
      noValidate
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-sm bg-block text-block-ink">
          <Icon name="shield" size={17} />
        </span>
        <p className="text-xs leading-relaxed text-muted">
          Abra seu aplicativo autenticador e digite o código de seis dígitos que aparece para o
          CapyPay.
        </p>
      </div>

      <Field label="Código de verificação" error={erro ?? undefined}>
        {({ id, describedBy, invalid }) => (
          <TextInput
            id={id}
            /*
             * `inputMode` numérico em vez de `type="number"`: o segundo traz
             * setinhas de incremento e come o zero à esquerda, e o código
             * pode perfeitamente começar com zero.
             */
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
            placeholder="000000"
            maxLength={6}
            aria-describedby={describedBy}
            invalid={invalid}
            value={codigo}
            onChange={(event) => setCodigo(normalizarCodigo(event.target.value))}
            className="h-12 rounded-full border-hairline-strong bg-sunken text-center font-mono text-base tracking-[0.4em]"
          />
        )}
      </Field>

      <Button
        type="submit"
        block
        loading={enviando}
        disabled={!codigoCompleto(codigo)}
        className="mt-2 h-12 shadow-[var(--shadow-block)]"
      >
        Verificar
      </Button>

      <Button variant="ghost" block onClick={() => void signOut()}>
        Entrar com outra conta
      </Button>
    </form>
  )
}
