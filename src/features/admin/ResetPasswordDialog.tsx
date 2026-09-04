import { useEffect, useState } from 'react'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { Dialog } from '@/components/ui/Dialog'
import { Field, TextInput } from '@/components/ui/Field'

/** O mesmo mínimo que o Supabase aplica, conferido de novo no servidor. */
export const MINIMO_SENHA = 6

/**
 * Uma senha sorteada aqui, e não pedida ao servidor.
 *
 * `crypto.getRandomValues` porque `Math.random` não é imprevisível o
 * bastante para uma credencial, mesmo temporária. O alfabeto deixa de fora
 * `0`, `O`, `l` e `1`: esta senha vai ser lida em voz alta ou copiada à mão
 * por alguém, e um caractere ambíguo vira um chamado de suporte.
 */
const ALFABETO = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'

/**
 * Quantidade de caracteres da senha sorteada.
 *
 * Quatorze caracteres neste alfabeto de 55 são cerca de 81 bits — muito além
 * do que faz diferença para uma senha que existe até a pessoa trocá-la, e
 * ainda curta o bastante para caber numa mensagem sem quebrar linha.
 */
const COMPRIMENTO = 14

/*
 * O maior múltiplo do alfabeto que cabe num byte.
 *
 * `byte % 55` parece inofensivo e não é: 256 não é múltiplo de 55, então os
 * 36 primeiros caracteres do alfabeto saem com probabilidade maior que os
 * outros 19. O desvio é pequeno, e é exatamente o tipo de coisa que se acumula
 * quando alguém decide procurar por ele. Descartar os bytes que caem no pedaço
 * incompleto custa uma repetição eventual e devolve um sorteio uniforme.
 */
const TETO = Math.floor(256 / ALFABETO.length) * ALFABETO.length

function sortearSenha(): string {
  const escolhidos: string[] = []

  while (escolhidos.length < COMPRIMENTO) {
    // Pede com folga: em média 14 bytes bastam, e pedir de uma vez evita uma
    // chamada por caractere.
    const bytes = new Uint8Array(COMPRIMENTO)
    crypto.getRandomValues(bytes)

    for (const byte of bytes) {
      if (byte >= TETO) continue
      escolhidos.push(ALFABETO[byte % ALFABETO.length])
      if (escolhidos.length === COMPRIMENTO) break
    }
  }

  return escolhidos.join('')
}

/**
 * Redefinição de senha com a senha à escolha do administrador.
 *
 * Sortear era o único caminho antes, e servia mal ao caso mais comum: alguém
 * pede ajuda por telefone e precisa de algo que dê para ditar. Escolher a
 * senha resolve isso, e o sorteio continua a um clique para quem prefere não
 * pensar em uma.
 *
 * A senha resultante é mostrada uma vez só, depois, pelo diálogo que já
 * existia para isso. Aqui ela é apenas digitada.
 */
export function ResetPasswordDialog({
  email,
  open,
  busy,
  erro,
  onClose,
  onConfirm,
}: {
  email: string
  open: boolean
  busy: boolean
  /*
   * O erro do servidor é mostrado aqui dentro, e não na ficha atrás. Este
   * diálogo não se fecha sozinho ao confirmar, então uma recusa exibida lá
   * atrás ficaria escondida justamente de quem precisa reagir a ela.
   */
  erro: string | null
  onClose: () => void
  onConfirm: (senha: string) => void
}) {
  const [senha, setSenha] = useState('')
  const [mostrar, setMostrar] = useState(false)

  // Uma senha digitada não pode sobreviver ao fechamento do diálogo e
  // reaparecer na próxima conta que o admin abrir.
  useEffect(() => {
    if (!open) {
      setSenha('')
      setMostrar(false)
    }
  }, [open])

  const curta = senha.length > 0 && senha.length < MINIMO_SENHA

  return (
    <Dialog
      open={open}
      onClose={onClose}
      title="Redefinir senha"
      description={`A senha atual de ${email} deixa de valer imediatamente.`}
    >
      <div className="flex flex-col gap-4">
        <Field
          label="Nova senha"
          hint={`Pelo menos ${MINIMO_SENHA} caracteres. Você vai poder copiá-la na tela seguinte.`}
          error={curta ? `A senha precisa de pelo menos ${MINIMO_SENHA} caracteres.` : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <div className="relative">
              <TextInput
                id={id}
                type={mostrar ? 'text' : 'password'}
                autoComplete="new-password"
                placeholder="Digite ou sorteie uma senha"
                aria-describedby={describedBy}
                invalid={invalid}
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                className="pr-11"
              />
              <button
                type="button"
                onClick={() => setMostrar((valor) => !valor)}
                aria-label={mostrar ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute top-1/2 right-3.5 -translate-y-1/2 text-faint transition-colors duration-150 hover:text-ink"
              >
                <Icon name={mostrar ? 'eye-off' : 'eye'} size={17} />
              </button>
            </div>
          )}
        </Field>

        <Button
          variant="quiet"
          icon="rotate-cw"
          onClick={() => {
            setSenha(sortearSenha())
            // Sorteou, então mostra: uma senha que ninguém pode ler não serve
            // para ser repassada.
            setMostrar(true)
          }}
        >
          Sortear uma senha
        </Button>

        {erro ? (
          <p className="flex items-start gap-2 text-xs font-medium text-ink">
            <Icon name="circle-alert" size={14} className="mt-px" />
            {erro}
          </p>
        ) : null}

        <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button variant="ghost" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            loading={busy}
            disabled={senha.length < MINIMO_SENHA}
            onClick={() => onConfirm(senha)}
          >
            Redefinir senha
          </Button>
        </div>
      </div>
    </Dialog>
  )
}
