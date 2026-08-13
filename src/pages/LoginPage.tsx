import { useEffect, useState, type FormEvent } from 'react'
import { Navigate } from 'react-router-dom'
import loginIllustration from '@/assets/login-illustration.png'
import { Icon } from '@/components/Icon'
import { Wordmark } from '@/components/Wordmark'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { SecondFactorForm } from '@/features/security/SecondFactorForm'
import { TwoFactorSetup } from '@/features/security/TwoFactorSetup'
import {
  adiarOferta,
  iniciarInscricao,
  ofertaAdiada,
  temSegundoFator,
} from '@/features/security/twoFactor'
import { useAuthStore } from '@/store/authStore'

/**
 * Fora do `AppShell` de propósito: quem chega aqui ainda não tem sessão, e a
 * moldura inteira (barra lateral, avatar, mês selecionado) pressupõe uma.
 *
 * Sem link de "criar conta" — contas nascem só pelo painel de admin, nunca
 * por cadastro público. Sem login social — nunca foi discutido, e reabriria
 * a mesma pergunta do cadastro público por outra porta. Sem "lembrar de
 * mim" — a sessão do Supabase já persiste por padrão; um checkbox que não
 * muda nada seria enfeite, não controle.
 *
 * Três exceções ao sistema monocromático, restritas a esta tela: a
 * ilustração (fornecida pelo usuário, plena cor de propósito), a borda
 * ondulada do painel que a molda (o único lugar do sistema com forma
 * orgânica, sempre cantos retos em todo o resto), e o tema — `.force-light`
 * (`styles.css`) prende esta tela ao claro, sempre, porque é a primeira
 * impressão do produto e o painel de ilustração só lê bem contra fundo
 * claro. Os campos usam a mesma `TextInput`/`Field` do resto do app — só o
 * `className` muda aqui, então o resto do sistema não herda o formato
 * pílula nem o tema fixo.
 */
export function LoginPage() {
  const status = useAuthStore((state) => state.status)
  const role = useAuthStore((state) => state.role)
  const signIn = useAuthStore((state) => state.signIn)
  const authError = useAuthStore((state) => state.authError)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Senha aceita, segundo fator pendente: a tela troca de etapa em vez de
  // redirecionar, porque quem está aqui não terminou de entrar.
  const segundaEtapa = status === 'mfaRequired'

  /*
   * A oferta de ativar a verificação vive aqui, e não em Ajustes: é o momento
   * em que a pessoa acabou de provar que a conta é dela, e proteção que mora
   * atrás de dois cliques é proteção que quase ninguém liga.
   *
   * `null` enquanto a consulta não volta, para a tela não piscar entre
   * redirecionar e oferecer.
   */
  const [ofereceSetup, setOfereceSetup] = useState<boolean | null>(null)

  useEffect(() => {
    if (status !== 'signedIn') {
      setOfereceSetup(null)
      return
    }
    if (ofertaAdiada()) {
      setOfereceSetup(false)
      return
    }

    let ativo = true

    void (async () => {
      try {
        if (await temSegundoFator()) {
          if (ativo) setOfereceSetup(false)
          return
        }

        /*
         * O QR é pedido aqui, antes de trocar de etapa, e não lá dentro. São
         * duas idas à rede em sequência (consultar os fatores, depois cadastrar
         * um), e feitas dentro do painel a segunda virava um "Gerando…" numa
         * tela que a pessoa acabou de abrir. Esperando aqui, a espera inteira
         * acontece no botão que ela apertou, e o painel nasce pronto.
         *
         * A falha é engolida de propósito: o painel refaz o pedido e tem a
         * tela de erro que sabe explicar o que houve.
         */
        await iniciarInscricao().catch(() => undefined)
        if (ativo) setOfereceSetup(true)
      } catch {
        // Falha ao consultar não pode deixar quem já entrou preso do lado de
        // fora: na dúvida, segue para o app sem a oferta.
        if (ativo) setOfereceSetup(false)
      }
    })()

    return () => {
      ativo = false
    }
  }, [status])

  // Chegou aqui com sessão viva (link direto, ou meio de um redirecionamento):
  // manda pra onde essa sessão realmente pertence, sem piscar o formulário.
  if (status === 'signedIn' && ofereceSetup === false) {
    return <Navigate to={role === 'admin' ? '/admin' : '/'} replace />
  }

  const convidandoASetup = status === 'signedIn' && ofereceSetup === true

  // A senha já foi aceita, mas ainda não se sabe o destino. O botão continua
  // girando porque a espera é do login: soltá-lo aqui devolveria por um
  // instante um formulário que já não tem nada a receber.
  const decidindo = status === 'signedIn' && ofereceSetup === null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)

    const result = await signIn(email, password)

    setSubmitting(false)
    if (result.error) setError(result.error)
  }

  return (
    /*
      Branco no contêiner inteiro, e não só na metade do formulário: a onda
      recorta a imagem por dentro do painel esquerdo, então a faixa que sobra
      entre a curva e a metade direita mostra o fundo deste elemento. Com a
      mesa cinza aqui, essa faixa aparecia como uma tira cinza vertical
      separando a ilustração do formulário.
    */
    <div className="force-light flex h-dvh bg-sheet">
      {/* Ponta a ponta nas bordas superior, inferior e esquerda — só a direita
          é recortada pela onda, então não sobra nenhum canto reto para
          arredondar. */}
      <div className="relative hidden shrink-0 lg:block lg:w-1/2">
        <img
          src={loginIllustration}
          alt=""
          className="absolute inset-0 size-full object-cover"
          style={{ clipPath: 'url(#login-wave-clip)' }}
        />
      </div>

      {/*
        Fundo branco sólido, e não a mesa cinza do resto do produto: aqui a
        folha não está apoiada em nada, ela é a própria página. O relevo fica
        por conta do cartão do formulário, logo abaixo.
      */}
      {/*
        Quem rola é esta coluna, não a página: de 1024px para cima o projeto
        trava `overflow: hidden` em `html, body` (ver `styles.css`), porque no
        app a rolagem pertence ao `<main>`. Esta tela vive fora daquela
        moldura, então sem um contêiner rolável próprio o conteúdo alto (a
        etapa do QR code) some para fora da viewport sem jeito de alcançar.

        A ilustração fica de fora da rolagem de propósito: ela é o pano de
        fundo da cena, e pano de fundo que desliza junto vira conteúdo.
      */}
      <div className="relative flex w-full flex-1 flex-col overflow-y-auto bg-sheet px-6 py-12 lg:px-16 xl:px-20">
        {/*
          `my-auto` no lugar de `justify-center` no pai: os dois centralizam
          quando sobra espaço, mas `justify-center` num contêiner rolável
          empurra o excesso para fora dos dois lados, e o topo fica
          inalcançável. Margem automática colapsa para zero quando falta
          espaço, então nada é perdido.
        */}
        {/*
          A etapa do QR pede mais largura que o formulário de senha: dois
          elementos lado a lado dentro de 384px deixam a explicação numa
          coluna de quatro palavras. Quem cresce é a coluna inteira, título
          junto, senão o cartão ficaria mais largo que o texto que o anuncia.
        */}
        <div
          className={`relative my-auto w-full ${convidandoASetup ? 'max-w-md' : 'max-w-sm'}`}
        >
          <Wordmark className="mb-10 text-ink" />

          <h1 className="text-[1.75rem] leading-tight font-semibold tracking-[-0.025em] text-ink sm:text-[2.125rem]">
            {segundaEtapa
              ? 'Mais uma etapa'
              : convidandoASetup
                ? 'Proteja sua conta'
                : 'Bem-vindo de volta'}
          </h1>
          <p className="mt-3 text-[0.8125rem] text-muted">
            {segundaEtapa
              ? 'Sua conta pede verificação em duas etapas.'
              : convidandoASetup
                ? 'Com a verificação em duas etapas, saber sua senha não basta para entrar.'
                : 'Acesse sua conta para continuar.'}
          </p>

          {/*
            O cartão é o relevo, e sobre página branca ele não pode vir da
            cor: Folha e Folha Erguida diferem em três unidades de 255, o que
            não separa nada. Sobram o contorno de 1px e a sombra, e por isso a
            escolhida é a longa e difusa (`--shadow-float`) e não a de folha
            apoiada: aqui o cartão flutua sobre a página, não descansa nela.

            Os campos, ao contrário, ficam em Rebaixado. Campo branco dentro de
            cartão branco desapareceria, e a superfície rebaixada é o que o
            sistema inteiro já usa para dizer "isto é receptáculo, não conteúdo".
          */}
          {convidandoASetup ? (
            <TwoFactorSetup
              onDone={() => setOfereceSetup(false)}
              onSkip={() => {
                adiarOferta()
                setOfereceSetup(false)
              }}
            />
          ) : segundaEtapa ? (
            <SecondFactorForm />
          ) : (
            <form
              onSubmit={handleSubmit}
              className="mt-8 flex flex-col gap-4 rounded-lg border border-hairline bg-sheet p-6 shadow-[var(--shadow-float)]"
              noValidate
            >
              <Field label="E-mail">
                {({ id, describedBy, invalid }) => (
                  <div className="relative">
                    <Icon
                      name="mail"
                      size={17}
                      className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint"
                    />
                    <TextInput
                      id={id}
                      type="email"
                      autoComplete="email"
                      placeholder="voce@exemplo.com"
                      aria-describedby={describedBy}
                      invalid={invalid}
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      required
                      className="h-12 rounded-full border-hairline-strong bg-sunken pl-11"
                    />
                  </div>
                )}
              </Field>

              <Field label="Senha" error={error ?? authError ?? undefined}>
                {({ id, describedBy, invalid }) => (
                  <div className="relative">
                    <Icon
                      name="lock"
                      size={17}
                      className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-faint"
                    />
                    <TextInput
                      id={id}
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      placeholder="Sua senha"
                      aria-describedby={describedBy}
                      invalid={invalid}
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      className="h-12 rounded-full border-hairline-strong bg-sunken pr-11 pl-11"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((value) => !value)}
                      aria-label={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      title={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
                      className="absolute top-1/2 right-3.5 -translate-y-1/2 text-faint transition-colors duration-150 hover:text-ink"
                    >
                      <Icon name={showPassword ? 'eye-off' : 'eye'} size={17} />
                    </button>
                  </div>
                )}
              </Field>

              <Button
                type="submit"
                block
                loading={submitting || decidindo}
                className="mt-2 h-12 shadow-[var(--shadow-block)]"
              >
                Entrar
              </Button>
            </form>
          )}

          {/* Frase deliberadamente sem "?" de pergunta: parece link clicável
              e não é — não existe reset de senha self-service (ver SETUP.md). */}
          <p className="mt-6 text-center text-xs text-muted">
            {segundaEtapa
              ? 'Perdeu o acesso ao aplicativo? Peça a um administrador.'
              : convidandoASetup
                ? 'Dá para pular agora e ativar em outra entrada.'
                : 'Somente um administrador pode redefinir sua senha.'}
          </p>
        </div>
      </div>

      {/* Só define a forma; não renderiza nada visível por si só. */}
      <svg width="0" height="0" className="absolute" aria-hidden="true">
        <defs>
          <clipPath id="login-wave-clip" clipPathUnits="objectBoundingBox">
            <path d="M0,0 H0.8 C0.58,0.16 1,0.32 0.76,0.5 C0.52,0.68 1,0.84 0.8,1 H0 Z" />
          </clipPath>
        </defs>
      </svg>
    </div>
  )
}
