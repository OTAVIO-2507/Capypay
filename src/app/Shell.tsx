import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { Wordmark } from '@/components/Wordmark'
import { cn } from '@/lib/cn'
import type { NavDestination } from './navigation'

/**
 * A moldura, compartilhada pelo app financeiro e pelo painel de administração.
 *
 * A partir de 1024px, onde a barra lateral substitui a barra inferior, a
 * moldura para de rolar com a página: ganha altura fixa (a do viewport, ou a
 * do viewport menos o respiro de 20px a partir de 1280px) e `overflow-hidden`,
 * e vira o teto de tudo que existe nela. Barra lateral e cabeçalho passam a
 * ser paisagem fixa; só o `<main>` rola, por dentro de si mesmo.
 *
 * Antes era o inverso: a página inteira rolava, e a barra lateral usava
 * `position: sticky` para *parecer* fixa. Um elemento sticky com fundo e
 * canto arredondado próprios tem dois jeitos de sair errado: um bug do
 * Chromium que perde a repintura do recorte no instante em que ele "gruda",
 * e uma conta de altura que nunca fecha exatamente com o fim real da página,
 * deixando a mesa cinza aparecer por baixo da barra no fim da rolagem. A
 * barra fixa de verdade não tem nenhum dos dois problemas: ela não faz nada
 * de especial, porque não precisa.
 *
 * Abaixo de 1024px a moldura é dispensada de novo: a barra vira barra
 * inferior, e a página volta a rolar inteira. Não sobra altura de tela para
 * gastar com um cabeçalho fixo separado do conteúdo.
 *
 * Administração usa exatamente esta moldura, e não uma parecida. Duas
 * molduras que quase combinam envelhecem em direções diferentes: a primeira
 * correção de layout aplicada só num lado já abre a distância.
 */
export function Shell({
  nav,
  footerNav,
  navLabel,
  topBar,
  children,
}: {
  nav: readonly NavDestination[]
  /** Destino separado no rodapé da barra, como Ajustes. */
  footerNav?: NavDestination
  navLabel: string
  topBar: ReactNode
  children: ReactNode
}) {
  return (
    <div className="min-h-dvh bg-desk lg:h-dvh lg:min-h-0 lg:overflow-hidden xl:p-5">
      <div
        className={cn(
          'mx-auto flex min-h-dvh w-full max-w-[1600px] bg-raised',
          // `min-h-dvh` sem prefixo é o piso para telas estreitas, onde a
          // moldura fixa não existe e uma tela quase vazia não deve parecer
          // cortada. A partir de 1024px, `lg:min-h-0` cancela esse piso:
          // sem ele, `min-height: 100dvh` (900px) vence sobre a altura de
          // `xl:h-[calc(100dvh-2.5rem)]` (860px) sempre que a segunda for
          // menor, porque `min-height` sempre tem prioridade sobre `height`
          // quando os dois entram em conflito. A moldura ficava 40px mais
          // alta do que a mesa reservava para ela, e o excesso, sem
          // `overflow-hidden` no invólucro externo para contê-lo, vazava
          // para a página inteira, que passava a rolar por baixo da moldura.
          'lg:h-dvh lg:min-h-0 lg:overflow-hidden xl:h-[calc(100dvh-2.5rem)] xl:rounded-xl xl:shadow-[var(--shadow-frame)]',
        )}
      >
        <Sidebar nav={nav} footerNav={footerNav} label={navLabel} />

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center justify-between gap-4 px-4 pt-5 pb-6 lg:px-7 lg:pt-6">
            <Wordmark size="sm" className="text-ink lg:hidden" />
            <span className="hidden lg:block" />
            {topBar}
          </header>

          <main className="flex-1 px-4 pb-28 lg:min-h-0 lg:overflow-y-auto lg:px-7 lg:pb-8">
            {children}
          </main>
        </div>
      </div>

      <MobileBar nav={nav} label={navLabel} />
    </div>
  )
}

/**
 * A barra lateral, em tinta cheia.
 *
 * Ela é escura porque o efeito que a define depende disso: o item selecionado
 * assume a cor do papel e avança até a borda direita, virando um pedaço da
 * página que entra na barra. Sem contraste entre barra e conteúdo não há de
 * onde a aba "vir", e o recurso deixa de existir.
 *
 * É o maior bloco de tinta do sistema, e por isso ele custa a cota: com a
 * barra escura, o painel gasta os outros dois blocos no cartão e na meta em
 * foco, e nada mais.
 */
function Sidebar({
  nav,
  footerNav,
  label,
}: {
  nav: readonly NavDestination[]
  footerNav?: NavDestination
  label: string
}) {
  const navRef = useRef<HTMLElement>(null)
  const { pathname } = useLocation()
  const [tab, setTab] = useState<{ top: number; height: number } | null>(null)
  // Sem isto a aba deslizaria do topo da barra até o destino no primeiro
  // desenho: uma animação de entrada que ninguém pediu e que atrapalha.
  const [animar, setAnimar] = useState(false)

  useLayoutEffect(() => {
    const elemento = navRef.current
    if (!elemento) return

    /*
     * A posição é medida, e não calculada por índice × altura. O item de
     * Ajustes fica separado no rodapé, então não existe passo constante entre
     * os itens; medir é o que faz a aba parar no lugar certo em qualquer
     * arranjo, inclusive com listas de tamanhos diferentes entre as duas
     * molduras que compartilham este componente.
     */
    const medir = () => {
      // `aria-current="page"` é posto pelo próprio NavLink no item ativo, então
      // não há um segundo atributo para manter em sincronia com a rota.
      const alvo = elemento.querySelector<HTMLElement>('[aria-current="page"]')
      if (!alvo) return setTab(null)

      // Diferença entre retângulos, e não `offsetTop`: este último é medido a
      // partir do `offsetParent`, cuja identidade muda conforme o que estiver
      // posicionado na árvore, e a especificação diverge entre navegadores
      // sobre contar ou não o padding. A diferença de retângulos não tem essa
      // ambiguidade.
      const caixaNav = elemento.getBoundingClientRect()
      const caixaAlvo = alvo.getBoundingClientRect()
      setTab({ top: caixaAlvo.top - caixaNav.top, height: caixaAlvo.height })
    }

    medir()

    // A altura da barra muda com a janela e depois que a fonte carrega; sem
    // observar, a aba fica alguns pixels fora do item até a próxima navegação.
    const observer = new ResizeObserver(medir)
    observer.observe(elemento)
    return () => observer.disconnect()
  }, [pathname])

  useEffect(() => {
    const id = window.requestAnimationFrame(() => setAnimar(true))
    return () => window.cancelAnimationFrame(id)
  }, [])

  return (
    /*
     * Um elemento só. Isto já foi duas caixas, um fundo esticado mais uma
     * `nav` grudada com `position: sticky`, porque a moldura em volta rolava
     * com a página, e uma barra "fixa" dentro de algo que rola só se consegue
     * por truque. Agora a moldura tem altura fixa e não rola nunca, então a
     * barra não precisa fingir nada: `h-full` já a estica pela altura
     * inteira, sempre, sem cálculo e sem estado de "presa".
     */
    <nav
      ref={navRef}
      aria-label={label}
      className="hidden h-full w-[232px] shrink-0 flex-col overflow-hidden bg-block py-6 text-block-ink lg:relative lg:flex xl:rounded-l-xl"
    >
      <Wordmark className="px-6" />

      {tab ? <ActiveTab top={tab.top} height={tab.height} animar={animar} /> : null}

      <ul className="mt-9 flex flex-1 flex-col gap-1">
        {nav.map((destination) => (
          <li key={destination.to}>
            <SidebarLink destination={destination} />
          </li>
        ))}
      </ul>

      {footerNav ? <SidebarLink destination={footerNav} /> : null}
    </nav>
  )
}

/**
 * A aba ativa, como elemento único que viaja.
 *
 * Antes o fundo pertencia ao próprio link, e trocar de rota fazia a aba sumir
 * de um lugar e aparecer em outro. Com um só elemento posicionado por medida,
 * a mudança de rota vira um deslocamento contínuo: o olho acompanha para onde
 * foi, em vez de reprocurar.
 *
 * O movimento é `transform`, e não `top`: só transform e opacidade são
 * animados pelo compositor, então a viagem não força recálculo de layout a
 * cada quadro.
 */
function ActiveTab({ top, height, animar }: { top: number; height: number; animar: boolean }) {
  return (
    <div
      aria-hidden="true"
      className={cn(
        // `top-0` é obrigatório: sem ele o elemento absoluto assume a posição
        // estática, onde ele cairia no fluxo normal (logo abaixo da marca),
        // e a aba nascia deslocada dezenas de pixels para baixo.
        'pointer-events-none absolute top-0 right-0 left-0 z-0 rounded-l-full bg-raised',
        // Ease-out exponencial: sai rápido e assenta devagar, que é como a
        // matéria se move. Linear ou ease-in-out aqui parecem mecânicos.
        animar && 'transition-[transform,height] duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
      )}
      style={{ height, transform: `translateY(${top}px)` }}
    >
      <ConcaveCorner position="above" />
      <ConcaveCorner position="below" />
    </div>
  )
}

/**
 * Item da barra.
 *
 * O fundo do selecionado não vive aqui: é a `ActiveTab` que viaja por cima.
 * Este elemento só carrega o conteúdo e a cor.
 */
function SidebarLink({ destination }: { destination: NavDestination }) {
  return (
    <NavLink
      to={destination.to}
      end={destination.end ?? destination.to === '/'}
      data-tour={destination.tour}
      className={({ isActive }) =>
        cn(
          'relative z-10 flex h-[52px] items-center gap-3 rounded-l-full pr-5 pl-6 text-[0.8125rem]',
          'transition-colors duration-300',
          isActive
            ? 'font-semibold text-ink'
            : 'font-medium text-block-muted hover:bg-block-ink/10 hover:text-block-ink',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon
            name={destination.icon}
            size={19}
            className={cn(
              'shrink-0 transition-transform duration-[420ms] ease-[cubic-bezier(0.16,1,0.3,1)]',
              // Um assentar de 4%, não um salto: confirma o toque sem chamar
              // atenção para si a cada navegação.
              isActive && 'scale-[1.04]',
            )}
          />
          {destination.label}
        </>
      )}
    </NavLink>
  )
}

/**
 * Curva côncava no encontro da aba com a barra.
 *
 * O desenho é um quadrado na cor do conteúdo com um quarto de disco na cor da
 * barra recortado por `border-radius`. É o único jeito de obter canto
 * invertido em CSS sem máscara nem SVG, e sobrevive a qualquer mudança de cor
 * porque as duas superfícies vêm dos mesmos tokens.
 *
 * O raio é grande de propósito. Na primeira versão ele era de 16px e a curva
 * saía curta demais para ser lida como curva: virava um degrau, e a aba
 * parecia ter duas orelhas em vez de nascer da barra. Em 26px, praticamente o
 * mesmo raio da lateral arredondada da aba, as três curvas formam uma linha só.
 */
const RAIO_CONCAVO = 26

function ConcaveCorner({ position }: { position: 'above' | 'below' }) {
  return (
    <span
      aria-hidden="true"
      style={{
        width: RAIO_CONCAVO,
        height: RAIO_CONCAVO,
        [position === 'above' ? 'top' : 'bottom']: -RAIO_CONCAVO,
      }}
      className="pointer-events-none absolute right-0 bg-raised"
    >
      <span
        style={{
          [position === 'above' ? 'borderBottomRightRadius' : 'borderTopRightRadius']:
            RAIO_CONCAVO,
        }}
        className="absolute inset-0 bg-block"
      />
    </span>
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
      className="fixed inset-x-0 bottom-0 z-30 border-t border-hairline bg-sheet pb-[env(safe-area-inset-bottom)] lg:hidden"
    >
      <ul className="flex items-stretch justify-around">
        {nav.map((destination) => (
          <li key={destination.to} className="flex-1">
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
                  <Icon name={destination.icon} size={19} strokeWidth={isActive ? 2.25 : 1.75} />
                  <span className={cn('text-[10px]', isActive && 'font-semibold')}>
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
