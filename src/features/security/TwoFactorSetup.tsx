import { useEffect, useState } from 'react'
import { Icon } from '@/components/Icon'
import { Button } from '@/components/ui/Button'
import { CardWell } from '@/components/ui/Card'
import { Field, TextInput } from '@/components/ui/Field'
import {
  codigoCompleto,
  confirmarInscricao,
  descartarInscricao,
  FalhaDeSegundoFator,
  iniciarInscricao,
  inscricaoGuardada,
  normalizarCodigo,
  type Inscricao,
} from './twoFactor'

/**
 * Oferta de verificação em duas etapas, logo depois da senha.
 *
 * Fica no caminho do login, e não numa tela de ajustes, porque proteção que
 * mora atrás de dois cliques é proteção que quase ninguém liga. Aqui ela
 * aparece uma vez, no momento em que a pessoa acabou de provar que a conta é
 * dela.
 *
 * É recusável de propósito. Uma etapa obrigatória entre a senha e o aplicativo
 * transformaria "não tenho o celular agora" em "não consigo trabalhar hoje",
 * e a saída dessa situação seria pedir socorro a um administrador.
 *
 * A composição é de duas etapas com rótulos paralelos, escaneie e depois
 * digite, porque é exatamente essa a ordem obrigatória da tarefa: sem o
 * aplicativo cadastrado não existe código para digitar. Cada etapa é um
 * agrupamento em Rebaixado com raio de 18px, que é o que o sistema usa para
 * agrupar por dentro de uma folha, e não uma segunda folha branca por cima da
 * primeira.
 */
export function TwoFactorSetup({ onDone, onSkip }: { onDone: () => void; onSkip: () => void }) {
  /*
   * Estado inicial lido do QR já guardado, e não `null`: quem chega aqui pela
   * tela de login chega com o código em mãos, e começar em `null` custaria um
   * quadro de "Gerando…" para uma espera que já terminou.
   */
  const [inscricao, setInscricao] = useState<Inscricao | null>(inscricaoGuardada)
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState<string | null>(null)
  const [detalhe, setDetalhe] = useState<string | null>(null)
  const [tentativa, setTentativa] = useState(0)
  const [ocupado, setOcupado] = useState(false)
  const [mostrarChave, setMostrarChave] = useState(false)

  // Rede de segurança: se a etapa abrir sem QR guardado (montagem direta, ou
  // um "Tentar de novo"), ele é pedido aqui. Fazer a pessoa clicar em "gerar"
  // antes de ver qualquer coisa só adiaria o que ela veio fazer.
  useEffect(() => {
    if (inscricaoGuardada()) return

    let ativo = true

    iniciarInscricao()
      .then((resultado) => {
        if (!ativo) return
        setInscricao(resultado)
        setErro(null)
        setDetalhe(null)
      })
      .catch((cause: unknown) => {
        if (!ativo) return
        setErro(cause instanceof Error ? cause.message : 'Não foi possível gerar o QR code.')
        setDetalhe(cause instanceof FalhaDeSegundoFator ? cause.detalhe : null)
      })

    return () => {
      ativo = false
    }
  }, [tentativa])

  async function confirmar() {
    if (!inscricao) return
    setOcupado(true)
    setErro(null)
    try {
      await confirmarInscricao(inscricao.factorId, codigo)
      onDone()
    } catch (cause) {
      setErro(cause instanceof Error ? cause.message : 'Código não aceito.')
      setCodigo('')
      setOcupado(false)
    }
  }

  return (
    <div className="mt-8 flex flex-col gap-5 rounded-lg border border-hairline bg-sheet p-6 shadow-[var(--shadow-float)]">
      {erro && !inscricao ? (
        <>
          <p className="flex items-start gap-2 text-xs font-medium text-ink">
            <Icon name="circle-alert" size={14} className="mt-px" />
            {erro}
          </p>

          {/*
            O texto cru do servidor, fechado por padrão: é inglês técnico que
            não ajuda quem só quer entrar, e é a única pista de quem for
            consertar. Esconder não é o mesmo que descartar.
          */}
          {detalhe ? (
            <details className="text-xs text-muted">
              <summary className="cursor-pointer select-none">Detalhe técnico</summary>
              <CardWell className="mt-2">
                <p className="font-mono text-xs break-all text-ink">{detalhe}</p>
              </CardWell>
            </details>
          ) : null}

          <div className="flex flex-col gap-2">
            <Button
              block
              icon="rotate-cw"
              onClick={() => {
                descartarInscricao()
                setTentativa((valor) => valor + 1)
              }}
            >
              Tentar de novo
            </Button>
            <Button variant="ghost" block onClick={onSkip}>
              Continuar sem a verificação
            </Button>
          </div>
        </>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <p className="text-xs font-medium text-muted">Escaneie com seu aplicativo autenticador</p>

            {/*
              QR e explicação dividem um agrupamento só. Lado a lado, e não
              empilhados, porque empilhado o cartão passava da altura da janela
              e escondia o botão de confirmar justamente no passo em que a
              pessoa está com o celular na mão olhando para a tela.
            */}
            <div className="flex flex-col gap-3 rounded-md bg-sunken p-4">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center">
                {/*
                  O QR fica sobre a própria superfície do agrupamento. O
                  arredondamento é do desenho, não de uma placa branca por
                  baixo: folha dentro de folha é a única coisa que o sistema
                  proíbe sem exceção.

                  A espera ocupa exatamente o espaço do QR, e nada além dele.
                  O resto do cartão já está pronto antes da resposta chegar,
                  então marcá-lo inteiro como carregando anunciava uma ausência
                  maior do que a real e escondia o que já dava para ler.
                */}
                {inscricao ? (
                  <img
                    src={inscricao.qrCode}
                    alt="QR code para cadastrar a verificação em duas etapas"
                    className="size-32 shrink-0 rounded-xs"
                  />
                ) : (
                  <div className="flex size-32 shrink-0 items-center justify-center rounded-xs bg-sheet">
                    <span role="status" className="text-xs text-muted">
                      Gerando…
                    </span>
                  </div>
                )}

                <div className="flex min-w-0 flex-col items-start gap-2">
                  <p className="text-xs leading-relaxed text-muted">
                    Google Authenticator, Authy ou o autenticador do gerenciador de senhas que você
                    já usa.
                  </p>

                  {/*
                    Divulgação controlada em vez de `<details>`: o marcador
                    nativo é um triângulo que nenhum outro controle do produto
                    tem, e a chave precisa aparecer na largura inteira do
                    agrupamento, não espremida nesta coluna.
                  */}
                  <button
                    type="button"
                    onClick={() => setMostrarChave((valor) => !valor)}
                    aria-expanded={mostrarChave}
                    disabled={!inscricao}
                    className="flex items-center gap-1 rounded-xs text-xs text-muted transition-colors duration-150 hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ink disabled:opacity-40"
                  >
                    Sem câmera?
                    <Icon
                      name="chevron-down"
                      size={13}
                      className={`transition-transform duration-200 ${mostrarChave ? 'rotate-180' : ''}`}
                    />
                  </button>
                </div>
              </div>

              {mostrarChave && inscricao ? (
                <div>
                  <p className="text-xs text-muted">Digite esta chave no aplicativo:</p>
                  <p className="mt-1 font-mono text-xs break-all text-ink">{inscricao.secret}</p>
                </div>
              ) : null}
            </div>
          </div>

          <Field label="Digite o código de seis dígitos" error={erro ?? undefined}>
            {({ id, describedBy, invalid }) => (
              <TextInput
                id={id}
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000000"
                maxLength={6}
                disabled={!inscricao}
                aria-describedby={describedBy}
                invalid={invalid}
                value={codigo}
                onChange={(event) => setCodigo(normalizarCodigo(event.target.value))}
                className="h-12 rounded-full border-hairline-strong bg-sunken text-center font-mono text-base tracking-[0.4em]"
              />
            )}
          </Field>

          <div className="flex flex-col gap-2">
            <Button
              block
              icon="shield"
              loading={ocupado}
              disabled={!inscricao || !codigoCompleto(codigo)}
              onClick={() => void confirmar()}
              className="h-12 shadow-[var(--shadow-block)]"
            >
              Ativar e entrar
            </Button>

            <Button variant="ghost" block onClick={onSkip}>
              Agora não
            </Button>
          </div>
        </>
      )}
    </div>
  )
}
