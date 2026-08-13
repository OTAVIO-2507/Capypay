import { useEffect, useLayoutEffect, useState, type FormEvent } from 'react'
import { Avatar } from '@/components/Avatar'
import { Icon } from '@/components/Icon'
import { Wordmark } from '@/components/Wordmark'
import { Button } from '@/components/ui/Button'
import { Field, TextInput } from '@/components/ui/Field'
import { callNameOf } from '@/features/dashboard/Greeting'
import { cn } from '@/lib/cn'
import type { Profile } from '@/domain/types'
import {
  BALLOON_WIDTH,
  findVisibleTarget,
  placeBalloon,
  resolveSteps,
  type Rect,
  type TextosDoTour,
  type TourStep,
} from './tourSteps'

/** Folga entre a borda do alvo e o recorte do holofote. */
const PADDING_ALVO = 8

/** Botão "Próximo" do balão, alvo do foco a cada passo. */
const ID_AVANCAR = 'tour-avancar'

/**
 * As duas camadas opacas que recortam o buraco do desfoque.
 *
 * Máscara lê **alfa**, não cor: o matiz aqui nunca chega à tela, e qualquer
 * valor totalmente opaco serve. `currentColor` em vez de um literal
 * justamente por isso — uma cor escrita à mão aqui pareceria uma adição à
 * paleta do sistema, e não é.
 */
const STENCIL = 'linear-gradient(currentColor 0 0), linear-gradient(currentColor 0 0)'

/**
 * Boas-vindas guiadas, na primeira entrada de cada conta.
 *
 * Duas metades com propósitos diferentes. A primeira é um formulário: sem
 * saber como chamar a pessoa, a saudação do painel fica muda, então ela vem
 * antes de qualquer explicação. A segunda é o tour propriamente dito, e ele
 * **ilumina a interface real** em vez de mostrar uma reprodução dela — quem
 * termina já sabe onde as coisas ficam, porque olhou para elas.
 *
 * O componente só monta na primeira entrada, e a última cena grava esse
 * instante. Sair pelo meio (Esc, ou "Pular") também grava: insistir com quem
 * já disse não é a diferença entre acolher e importunar.
 *
 * Serve aos dois lados do produto. O roteiro, o perfil e a gravação entram por
 * propriedade em vez de serem lidos de uma loja aqui dentro: o app financeiro
 * guarda isso em `FinanceData`, e o painel de administração nas preferências
 * locais, porque uma sessão de administração nunca abre o documento
 * financeiro. Duplicar as seiscentas linhas de holofote e posicionamento para
 * atender a essa diferença de armazenamento seria pagar caro por nada.
 *
 * A única saída que não existe é a da primeira cena sem nome. O nome não é
 * material do tour, é dado da conta: sem ele o painel abre mudo todo dia, e
 * o único lugar que volta a perguntar é a edição de perfil, que a pessoa
 * ainda não sabe que existe. As explicações continuam recusáveis; o campo,
 * não.
 */
export function OnboardingTour({
  roteiro,
  textos,
  perfil,
  onGravarNome,
  onConcluir,
}: {
  roteiro: readonly TourStep[]
  textos: TextosDoTour
  /** Só para o avatar e a saudação do encerramento. */
  perfil: Profile
  /** Chamado ao sair da primeira cena, antes de o tour começar. */
  onGravarNome: (name: string, nickname: string) => void
  /** Chamado quando o tour termina, é pulado ou é fechado. */
  onConcluir: (name: string, nickname: string) => void
}) {
  const [steps, setSteps] = useState<TourStep[]>([])
  const [cena, setCena] = useState(0)
  const [name, setName] = useState(perfil.name)
  const [nickname, setNickname] = useState(perfil.nickname)

  // Depois da montagem: aqui a moldura já existe no DOM e dá para saber quais
  // alvos estão de fato em cena.
  useLayoutEffect(() => {
    setSteps(resolveSteps(document, roteiro))
  }, [roteiro])

  const ultimaCena = steps.length + 1
  const passo = cena >= 1 && cena <= steps.length ? steps[cena - 1] : null
  const rect = useTargetRect(passo?.targets ?? null)

  function encerrar() {
    onConcluir(name.trim(), nickname.trim())
  }

  // Esc encerra, como em qualquer camada modal do sistema, menos na primeira
  // cena: lá ele seria a porta dos fundos do campo obrigatório.
  useEffect(() => {
    const aoTeclar = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && cena > 0) encerrar()
    }
    window.addEventListener('keydown', aoTeclar)
    return () => window.removeEventListener('keydown', aoTeclar)
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Boas-vindas ao CapyPay"
      className="fixed inset-0 z-50"
    >
      <Scrim rect={passo ? rect : null} />

      {cena === 0 ? (
        <CenaCentral>
          <ApresentacaoForm
            name={name}
            nickname={nickname}
            onChangeName={setName}
            onChangeNickname={setNickname}
            dicaDoNome={textos.dicaDoNome}
            onSubmit={() => {
              // Grava já: quem fechar a aba no meio do tour não perde o nome
              // que acabou de digitar, e volta com o campo preenchido.
              onGravarNome(name.trim(), nickname.trim())
              setCena(1)
            }}
            /*
              Pular pula as explicações, não o nome. Passa pela mesma validação
              do "Começar" e grava igual, só não percorre os passos.
            */
            onSkip={encerrar}
          />
        </CenaCentral>
      ) : null}

      {passo ? (
        <Balao
          /*
           * Remonta a cada passo de propósito: sem a chave, o React
           * reaproveitaria o mesmo nó e a animação de entrada não tocaria de
           * novo — o balão trocaria de texto no lugar, sem chegar.
           */
          key={cena}
          passo={passo}
          rect={rect}
          indice={cena}
          total={steps.length}
          onBack={() => setCena((atual) => atual - 1)}
          onNext={() => setCena((atual) => atual + 1)}
          onSkip={encerrar}
        />
      ) : null}

      {cena === ultimaCena && steps.length > 0 ? (
        <CenaCentral>
          <Encerramento perfil={{ ...perfil, name, nickname }} textos={textos} onFinish={encerrar} />
        </CenaCentral>
      ) : null}
    </div>
  )
}

/**
 * Mede o alvo e reage ao que pode movê-lo.
 *
 * A janela mudando de tamanho é o caso óbvio. O menos óbvio, e o que mais
 * estraga um holofote na prática, é a fonte da interface terminando de
 * carregar depois da primeira medida: os itens de navegação mudam de largura
 * e o recorte fica alguns pixels fora do lugar, sem nenhum evento de resize
 * para avisar.
 */
function useTargetRect(targets: readonly string[] | null): Rect | null {
  const [rect, setRect] = useState<Rect | null>(null)

  useLayoutEffect(() => {
    if (!targets) {
      setRect(null)
      return
    }

    let frame = 0

    const medir = () => {
      const alvo = findVisibleTarget(document, targets)
      if (!alvo) return setRect(null)
      const caixa = alvo.getBoundingClientRect()
      setRect({ top: caixa.top, left: caixa.left, width: caixa.width, height: caixa.height })
    }

    const agendar = () => {
      window.cancelAnimationFrame(frame)
      frame = window.requestAnimationFrame(medir)
    }

    medir()
    window.addEventListener('resize', agendar)
    document.fonts?.ready.then(agendar).catch(() => {})

    return () => {
      window.removeEventListener('resize', agendar)
      window.cancelAnimationFrame(frame)
    }
  }, [targets])

  return rect
}

/**
 * O escurecimento — e o buraco nele.
 *
 * O recorte não é uma máscara nem um SVG: é uma sombra projetada de raio zero
 * e espalhamento enorme (`0 0 0 9999px`), que pinta tudo **fora** da caixa e
 * deixa o miolo intacto. Como é uma caixa comum, mudar de alvo é animar
 * `top/left/width/height` — o holofote desliza de um elemento ao outro em vez
 * de piscar, que é o que faz a pessoa acompanhar para onde a atenção foi.
 */
function Scrim({ rect }: { rect: Rect | null }) {
  if (!rect) {
    return (
      <div
        aria-hidden="true"
        className={cn(
          'absolute inset-0 bg-[var(--scrim)] backdrop-blur-[3px]',
          'motion-safe:animate-[tour-veil_420ms_ease-out]',
        )}
      />
    )
  }

  const caixa = {
    top: rect.top - PADDING_ALVO,
    left: rect.left - PADDING_ALVO,
    width: rect.width + PADDING_ALVO * 2,
    height: rect.height + PADDING_ALVO * 2,
  }

  const VIAGEM = cn(
    'motion-safe:transition-[top,left,width,height,padding] motion-safe:duration-[560ms]',
    'motion-safe:ease-[cubic-bezier(0.16,1,0.3,1)]',
  )

  return (
    <>
      {/*
        Profundidade de campo.

        O alvo fica nítido e todo o resto desfoca, como uma câmera mudando o
        foco de plano — é o que a palavra "holofote" promete e o que uma
        cortina escura sozinha não entrega.

        O buraco é feito por máscara, e não por recorte: duas camadas opacas,
        uma presa à caixa de conteúdo e outra à caixa da borda, combinadas por
        `exclude` — sobra tudo menos o miolo. O preenchimento assimétrico é o
        que posiciona esse miolo sobre o alvo. Escrito com `calc(100vw…)` em
        vez de medir a janela no JavaScript para o desfoque não ficar um quadro
        atrás do holofote enquanto a janela é redimensionada.

        Se algum navegador ignorar `mask-composite`, o que se perde é só o
        desfoque: a cortina abaixo continua escurecendo e o tour segue legível.
      */}
      <div
        aria-hidden="true"
        style={{
          paddingTop: caixa.top,
          paddingLeft: caixa.left,
          paddingRight: `calc(100vw - ${caixa.left + caixa.width}px)`,
          paddingBottom: `calc(100dvh - ${caixa.top + caixa.height}px)`,
          maskImage: STENCIL,
          maskClip: 'content-box, border-box',
          maskComposite: 'exclude',
          WebkitMaskImage: STENCIL,
          WebkitMaskClip: 'content-box, border-box',
          WebkitMaskComposite: 'xor',
        }}
        className={cn('pointer-events-none fixed inset-0 text-ink backdrop-blur-[3px]', VIAGEM)}
      />

      <div
        aria-hidden="true"
        style={{ ...caixa, boxShadow: '0 0 0 9999px var(--scrim)' }}
        className={cn('pointer-events-none fixed rounded-md', VIAGEM)}
      />

      {/* O halo: encontra o alvo antes de a leitura começar. */}
      <div
        aria-hidden="true"
        style={caixa}
        className={cn(
          'pointer-events-none fixed rounded-md ring-2 ring-white/70',
          VIAGEM,
          'motion-safe:animate-[tour-halo_2.4s_ease-in-out_infinite]',
        )}
      />
    </>
  )
}

/**
 * Cadência da entrada escalonada.
 *
 * `backwards` no `animation-fill-mode` é o detalhe que faz isto funcionar:
 * sem ele o elemento fica visível no lugar final durante o atraso e só então
 * salta para o início da animação — o efeito vira um piscar.
 */
function surge(atrasoMs: number) {
  return { animation: `tour-line 520ms cubic-bezier(0.16, 1, 0.3, 1) ${atrasoMs}ms backwards` }
}

/** Cena sem alvo: a apresentação e o encerramento moram no centro da tela. */
/*
 * `my-auto` no cartão, no lugar de `items-center` no contêiner: os dois
 * centralizam quando sobra espaço, mas num contêiner rolável `items-center`
 * empurra o excesso para fora dos dois lados e o topo fica inalcançável — e é
 * no topo que a capivara se debruça.
 */
function CenaCentral({ children }: { children: React.ReactNode }) {
  return (
    <div className="absolute inset-0 flex justify-center overflow-y-auto p-4">
      <div
        className={cn(
          'my-auto w-full max-w-md rounded-lg border border-hairline bg-sheet p-7 shadow-[var(--shadow-float)]',
          'motion-safe:animate-[tour-scene_560ms_cubic-bezier(0.16,1,0.3,1)]',
        )}
      >
        {children}
      </div>
    </div>
  )
}

function ApresentacaoForm({
  name,
  nickname,
  onChangeName,
  onChangeNickname,
  dicaDoNome,
  onSubmit,
  onSkip,
}: {
  name: string
  nickname: string
  onChangeName: (value: string) => void
  onChangeNickname: (value: string) => void
  dicaDoNome: string
  onSubmit: () => void
  onSkip: () => void
}) {
  /*
   * O aviso de campo vazio só aparece depois que a pessoa passou pelo campo.
   * Um erro pintado no primeiro quadro repreende alguém que ainda não teve
   * chance de digitar nada, e é o primeiro contato dela com o produto.
   */
  const [tocado, setTocado] = useState(false)

  const nomePreenchido = name.trim() !== ''

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!nomePreenchido) {
      setTocado(true)
      return
    }
    onSubmit()
  }

  const comoChamar = nickname.trim() || name.trim().split(/\s+/)[0]

  /*
   * `noValidate` porque a mensagem de campo vazio é nossa: sem ele o balão
   * nativo do navegador aparece primeiro, com um desenho que não é o do
   * produto, e o aviso escrito logo abaixo do campo nunca chega a ser lido.
   */
  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col">
      {/* A marca abre sozinha, e só depois o texto chega — a batida de
          abertura que separa "a tela carregou" de "a história começou". */}
      <span style={surge(0)} className="block">
        <Wordmark className="text-ink" />
      </span>

      <h2
        style={surge(220)}
        className="mt-7 text-[1.375rem] leading-tight font-semibold tracking-[-0.025em] text-ink"
      >
        Antes de tudo: como podemos te chamar?
      </h2>
      <p style={surge(340)} className="mt-2.5 text-[0.8125rem] leading-relaxed text-muted">
        O painel abre com uma saudação todo dia. Sem saber seu nome, ele abre mudo.
      </p>

      <div style={surge(460)} className="mt-6 flex flex-col gap-4">
        <Field
          label="Seu nome"
          hint={dicaDoNome}
          error={tocado && !nomePreenchido ? 'Escreva seu nome para continuar.' : undefined}
        >
          {({ id, describedBy, invalid }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              invalid={invalid}
              required
              value={name}
              autoFocus
              autoComplete="name"
              placeholder="Otávio Oliveira"
              onChange={(event) => onChangeName(event.target.value)}
              onBlur={() => setTocado(true)}
            />
          )}
        </Field>

        <Field
          label="Como quer ser chamado"
          hint="Opcional. Sem apelido, a saudação usa seu primeiro nome."
        >
          {({ id, describedBy }) => (
            <TextInput
              id={id}
              aria-describedby={describedBy}
              value={nickname}
              placeholder="Tavo"
              onChange={(event) => onChangeNickname(event.target.value)}
            />
          )}
        </Field>
      </div>

      {/* Prévia viva: a frase que a pessoa vai ver amanhã de manhã, montada
          enquanto ela digita. Vale mais que qualquer texto explicando o campo. */}
      <p
        aria-live="polite"
        style={surge(580)}
        className="mt-5 rounded-md bg-sunken px-4 py-3 text-[0.8125rem] text-muted"
      >
        {comoChamar ? (
          <>
            Seu painel vai dizer: <span className="font-semibold text-ink">Bom dia, {comoChamar}!</span>
          </>
        ) : (
          'Seu painel vai dizer: Bom dia!'
        )}
      </p>

      <div style={surge(700)} className="mt-7 flex items-center gap-2">
        {/*
          Pular pula as explicações, não o campo. Sem o nome ele acende o mesmo
          aviso que o "Começar": as duas saídas da cena passam pela mesma porta.
        */}
        <Button
          variant="ghost"
          onClick={() => {
            if (!nomePreenchido) {
              setTocado(true)
              return
            }
            onSkip()
          }}
        >
          Pular
        </Button>
        <Button type="submit" block iconEnd="arrow-right">
          Começar
        </Button>
      </div>
    </form>
  )
}

function Encerramento({
  perfil,
  textos,
  onFinish,
}: {
  perfil: Profile
  textos: TextosDoTour
  onFinish: () => void
}) {
  const nome = callNameOf(perfil)

  return (
    <div className="flex flex-col items-center text-center">
      <span style={surge(0)}>
        <Avatar profile={perfil} size={64} />
      </span>

      <h2
        style={surge(180)}
        className="mt-5 text-[1.375rem] leading-tight font-semibold tracking-[-0.025em] text-ink"
      >
        {nome ? `É isso, ${nome}.` : 'É isso.'}
      </h2>
      <p
        style={surge(300)}
        className="mt-2.5 max-w-[42ch] text-[0.8125rem] leading-relaxed text-muted"
      >
        {textos.fecho}
      </p>

      <span style={surge(440)} className="mt-7 block w-full">
        <Button block icon="check" onClick={onFinish}>
          {textos.botaoFinal}
        </Button>
      </span>
    </div>
  )
}

/**
 * O balão que acompanha o holofote.
 *
 * Fica em `fixed` com posição calculada (ver `placeBalloon`) em vez de
 * ancorado por CSS ao alvo: o alvo pode estar na barra lateral, no cabeçalho
 * ou na barra inferior do celular, e nenhuma relação de `position: relative`
 * cobre os três casos.
 */
function Balao({
  passo,
  rect,
  indice,
  total,
  onBack,
  onNext,
  onSkip,
}: {
  passo: TourStep
  rect: Rect | null
  indice: number
  total: number
  onBack: () => void
  onNext: () => void
  onSkip: () => void
}) {
  // O foco segue a narrativa: cada passo devolve o teclado ao botão que leva
  // ao próximo, para o tour inteiro ser percorrível sem tocar no mouse. O
  // alvo é buscado por `id` porque `Button` é um componente de função sem
  // `forwardRef` — encaminhar um ref até o `<button>` exigiria mexer num
  // componente usado por toda a aplicação, só para esta tela.
  useEffect(() => {
    document.getElementById(ID_AVANCAR)?.focus()
  }, [indice])

  if (!rect) return null

  const posicao = placeBalloon(rect, { width: window.innerWidth, height: window.innerHeight })
  const ultimo = indice === total

  return (
    <div
      style={{
        top: posicao.top,
        left: posicao.left,
        width: Math.min(BALLOON_WIDTH, window.innerWidth - 32),
        /*
         * Entra depois de a luz chegar. Sem o atraso, o balão já estava no
         * destino enquanto o holofote ainda atravessava a tela — duas coisas
         * acontecendo ao mesmo tempo em lugares diferentes, que é exatamente o
         * que tira a sensação de cena e devolve a de interface.
         */
        animation: 'tour-balloon 420ms cubic-bezier(0.16, 1, 0.3, 1) 260ms backwards',
      }}
      className="fixed rounded-lg border border-hairline bg-sheet p-5 shadow-[var(--shadow-float)]"
    >
      <div className="flex items-start gap-3">
        <span
          style={surge(60)}
          className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-sm bg-block text-block-ink"
        >
          <Icon name={passo.icon} size={17} />
        </span>

        <div className="min-w-0">
          <h2 style={surge(140)} className="text-base font-semibold tracking-[-0.02em] text-ink">
            {passo.title}
          </h2>
          <p style={surge(240)} className="mt-1.5 text-xs leading-relaxed text-muted">
            {passo.body}
          </p>
        </div>
      </div>

      <div style={surge(360)} className="mt-5 flex items-center justify-between gap-3">
        {/*
          Filmstrip em vez de "3 de 5": os traços já percorridos ficam longos e
          em tinta cheia, os que faltam curtos e apagados. Diz a mesma coisa
          sem obrigar ninguém a ler número, e a passagem de um passo ao outro
          vira movimento em vez de troca de dígito.

          A proporção é por `flex-grow`, e não por largura fixa. Com largura
          fixa a régua crescia a cada passo dado (traço percorrido é mais
          largo que traço restante) e, com oito passos, empurrava os botões
          para fora do balão. Repartindo o espaço que sobra, ela cabe sempre,
          com qualquer número de passos, e o percorrido continua duas vezes e
          meia mais longo que o que falta.
        */}
        <span aria-hidden="true" className="flex min-w-0 flex-1 items-center gap-1.5">
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              style={{ flexGrow: i < indice ? 2.5 : 1, flexBasis: 0 }}
              className={cn(
                'h-[3px] min-w-1.5 rounded-full',
                'transition-[flex-grow,background-color] duration-500',
                'ease-[cubic-bezier(0.16,1,0.3,1)]',
                i < indice ? 'bg-ink' : 'bg-hairline-strong',
              )}
            />
          ))}
        </span>
        <span className="sr-only">
          Passo {indice} de {total}
        </span>

        {/* Os botões não cedem espaço: é a régua que se ajusta a eles. */}
        <div className="flex shrink-0 items-center gap-1.5">
          {indice > 1 ? (
            <Button size="sm" variant="ghost" onClick={onBack}>
              Voltar
            </Button>
          ) : (
            <Button size="sm" variant="ghost" onClick={onSkip}>
              Pular
            </Button>
          )}
          <Button
            id={ID_AVANCAR}
            size="sm"
            onClick={onNext}
            iconEnd={ultimo ? undefined : 'arrow-right'}
          >
            {ultimo ? 'Terminar' : 'Próximo'}
          </Button>
        </div>
      </div>
    </div>
  )
}
