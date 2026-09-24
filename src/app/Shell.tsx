import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { Logo } from '@/components/Logo'
import { Wordmark } from '@/components/Wordmark'
import { SectionTabs } from './SectionTabs'
import { cn } from '@/lib/cn'
import type { NavDestination } from './navigation'

/**
 * A moldura, compartilhada pelo app financeiro e pelo painel de administração.
 *
 * **Quem rola é a página.** A barra de rolagem fica na borda direita da
 * janela, como a de qualquer site, e não por dentro da moldura — foi pedido
 * explícito, e a razão é de leitura: uma barra no meio da tela não parece a
 * barra da página, parece um painel que rola sozinho.
 *
 * A moldura já teve altura fixa, com o `<main>` rolando por dentro de si
 * mesmo. O que aquilo evitava — uma barra lateral `sticky` com conta de
 * altura que nunca fechava com o fim da página, e um bug de repintura do
 * Chromium quando ela grudava — está evitado de outro jeito agora: a faixa
 * da esquerda acompanha a moldura inteira e só o conteúdo dela gruda, com a
 * altura da **janela**. Não há conta a errar, e nada a repintar.
 *
 * Abaixo de 1024px a barra lateral vira barra inferior fixa, e a moldura
 * deixa de existir: não sobra altura de tela para gastar com ela.
 *
 * Administração usa exatamente esta moldura, e não uma parecida. Duas
 * molduras que quase combinam envelhecem em direções diferentes: a primeira
 * correção de layout aplicada só num lado já abre a distância.
 */
export function Shell({
  nav,
  railNav,
  railFooter,
  navLabel,
  topBar,
  children,
}: {
  nav: readonly NavDestination[]
  /**
   * Os destinos da barra lateral, que **não** são os de seção: a lateral do
   * produto de referência não navega seções, quem faz isso é a fila de abas.
   * Aqui ela guarda o que é ferramenta — importar extrato, ajustes.
   */
  railNav?: readonly NavDestination[]
  /** O que fica no pé da barra lateral. É o lugar do avatar, como na referência. */
  railFooter?: ReactNode
  navLabel: string
  topBar: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh bg-desk xl:p-5">
      <div
        className={cn(
          'mx-auto flex w-full max-w-[1600px] bg-desk',
          // A moldura cresce com o conteúdo, e a janela é só o piso dela: uma
          // tela de conteúdo curto não pode parecer cortada no meio.
          // Nenhum `overflow` aqui — recorte neste nível faria da moldura o
          // contêiner de rolagem, e a barra lateral `sticky` lá dentro
          // deixaria de grudar.
          'min-h-dvh xl:min-h-[calc(100dvh-2.5rem)] xl:rounded-xl xl:border xl:border-hairline',
        )}
      >
        <Rail nav={railNav} footer={railFooter} label={navLabel} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-4 px-4 pt-5 pb-6 lg:px-7 lg:pt-6">
            <Wordmark size="sm" className="text-ink lg:hidden" />
            <span className="hidden lg:block" />
            {topBar}
          </header>

          {/*
            As abas só existem a partir de 1024px. Abaixo disso quem navega é a
            barra inferior, e ter as duas seria dizer a mesma coisa duas vezes
            gastando uma faixa de altura que o celular não tem para dar. Não é
            o que o produto de referência faz — mas lá a fila de abas é a única
            navegação de seção que existe, e aqui a barra inferior já era um
            caminho de primeira classe antes desta mudança.
          */}
          <div className="hidden px-4 pb-6 lg:block lg:px-7">
            <SectionTabs destinations={nav} label={navLabel} />
          </div>

          {/*
            A folga de baixo cobre dois flutuantes, não um: no celular, a barra
            de navegação e o botão do assistente acima dela; no desktop, só o
            botão. Sem ela, a última linha da página fica embaixo dele e não há
            como rolá-la para fora.
          */}
          <main className="flex-1 px-4 pb-44 lg:px-7 lg:pb-24">
            {children}
          </main>
        </div>
      </div>

      <MobileBar nav={nav} label={navLabel} />
    </div>
  )
}

/**
 * O rail de ícones.
 *
 * Isto já foi uma barra de 232px com os sete destinos e uma pílula que viajava
 * entre eles. A pílula era um bom componente e mesmo assim saiu, porque estava
 * respondendo à pergunta errada: no produto de referência a lateral **não
 * navega seções**. Ela carrega o assistente, os agentes e o histórico de
 * conversa; quem troca de seção é a fila de abas no topo do conteúdo.
 *
 * Então o rail guarda o que é ferramenta — importar extrato, ajustes — e
 * ganha o assistente quando ele existir. A alternativa era repetir os sete
 * destinos aqui e nas abas, que é o mesmo caminho oferecido duas vezes na
 * mesma tela.
 *
 * A anatomia é a da referência: a marca no topo, os ícones embaixo dela, e o
 * avatar no pé. O avatar morava na barra de topo; desceu para cá porque é
 * "quem é você", e isso pertence à coluna que acompanha a pessoa pelo produto
 * inteiro, não ao cabeçalho da tela em que ela está. Abaixo de 1024px, onde
 * não existe rail, ele volta para o cabeçalho.
 *
 * São **duas** peças, e isto não é detalhe de implementação: a coluna e o que
 * gruda nela.
 *
 * A coluna é o `<div>` de fora. Ela tem a cor, a borda e o canto arredondado,
 * e acompanha a moldura de cima a baixo — é ela que faz a faixa da esquerda
 * existir na página inteira. O `<nav>` de dentro é que é `sticky`, com a
 * altura da **janela**, e não carrega cor nenhuma.
 *
 * A cor já morou no `<nav>`, e o defeito era visível: a faixa só existia onde
 * o `<nav>` estava. Ao rolar, ele descolava do topo da moldura e a barra
 * virava uma lousa de 860px boiando no meio da página — canto arredondado
 * aparecendo na altura do olho, mesa cinza acima e abaixo dela, e a borda da
 * direita começando e terminando no nada.
 *
 * A largura é 56px — `--sidebar-width-icon: 3.5rem` no produto de referência,
 * lido do atributo de estado da barra colapsada deles.
 */
function Rail({
  nav,
  footer,
  label,
}: {
  nav?: readonly NavDestination[]
  footer?: ReactNode
  label: string
}) {
  return (
    <div className="hidden w-14 shrink-0 border-r border-hairline bg-sunken lg:block xl:rounded-l-xl">
      <nav
        aria-label={label}
        className={cn(
          'flex flex-col items-center gap-2 py-5',
          'sticky top-0 h-dvh xl:top-5 xl:h-[calc(100dvh-2.5rem)]',
        )}
      >
        {/* Só a marca: o nome não cabe em 56px, e o rail é a única
            superfície do produto onde ele não aparece. */}
        <Logo decorative size={26} className="mb-4 text-ink" />
        {nav?.map((destination) => <RailLink key={destination.to} destination={destination} />)}

        {/* O avatar no pé, empurrado para lá pelo `mt-auto`. */}
        {footer ? <div className="mt-auto">{footer}</div> : null}
      </nav>
    </div>
  )
}

/**
 * Item do rail: quadrado arredondado, ícone sozinho.
 *
 * Sem rótulo visível, o nome acessível não é opcional — `title` serve ao
 * ponteiro e `aria-label` ao leitor de tela, e os dois carregam o mesmo texto
 * porque são a mesma informação para pessoas diferentes.
 */
function RailLink({ destination }: { destination: NavDestination }) {
  return (
    <NavLink
      to={destination.to}
      end={destination.end ?? destination.to === '/'}
      data-tour={destination.tour}
      aria-label={destination.label}
      title={destination.label}
      className={({ isActive }) =>
        cn(
          'inline-flex size-10 items-center justify-center rounded-xs border transition-colors duration-150',
          isActive
            ? 'border-accent/45 bg-accent/12 text-accent'
            : 'border-transparent text-faint hover:bg-sunken hover:text-ink',
        )
      }
    >
      {({ isActive }) => (
        <Icon name={destination.icon} size={18} strokeWidth={isActive ? 2.25 : 1.75} />
      )}
    </NavLink>
  )
}

/**
 * Barra inferior no celular. Substitui a lateral abaixo de 1024px, onde uma
 * coluna de 232px consumiria mais da metade da largura da tela.
 */
function MobileBar({ nav, label }: { nav: readonly NavDestination[]; label: string }) {
  return (
    <nav
      aria-label={label}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-sunken pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {nav.map((destination) => (
          // `min-w-0` é o que deixa o `truncate` do rótulo agir. Item de flex
          // não encolhe abaixo da largura do próprio texto por padrão, então as
          // reticências nunca apareciam: os sete itens somavam mais que a tela
          // e o último saía pela borda do mesmo jeito.
          <li key={destination.to} className="min-w-0 flex-1">
            <NavLink
              to={destination.to}
              end={destination.end ?? destination.to === '/'}
              data-tour={destination.tour}
              className={({ isActive }) =>
                cn(
                  'flex min-h-[60px] flex-col items-center justify-center gap-1 px-1 py-2',
                  'transition-colors duration-150',
                  isActive ? 'text-ink' : 'text-faint',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    name={destination.icon}
                    size={19}
                    strokeWidth={isActive ? 2.25 : 1.75}
                    className={isActive ? 'text-accent' : undefined}
                  />
                  {/*
                    `truncate` porque sete destinos em 400px dão 57px por item,
                    e "Parcelamentos" em 10px pede uns 75px. Sem isto o rótulo
                    do último item atravessa a borda da tela e some cortado —
                    era assim antes, e continuava sendo depois que a barra
                    trocou de cor. Reticências são ruins; rótulo cortado pela
                    janela é pior, porque não se anuncia.
                  */}
                  <span
                    className={cn(
                      'w-full truncate text-center text-[10px]',
                      isActive && 'font-semibold',
                    )}
                  >
                    {destination.label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
