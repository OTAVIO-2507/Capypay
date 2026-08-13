import type { IconName } from '@/components/Icon'

/**
 * O roteiro do tour, como dado.
 *
 * Separado do componente de propósito: a sequência é a parte que mais vai
 * mudar (um passo a mais, um texto reescrito), e mantê-la como lista simples
 * evita mexer em posicionamento e foco a cada ajuste de copy.
 *
 * `targets` são valores de `data-tour` postos em elementos **reais** da
 * interface. Nenhum passo desenha uma cópia da tela: o holofote recorta o
 * próprio painel que está atrás, então o que a pessoa aprende aqui é onde as
 * coisas ficam de verdade.
 */
/**
 * As frases que mudam entre um roteiro e outro.
 *
 * A abertura serve aos dois lados sem alteração ("como podemos te chamar" vale
 * para qualquer conta), mas o fecho não: ele aponta para a próxima ação, e a
 * próxima ação de quem administra não é lançar um café. Ficam aqui, ao lado do
 * roteiro que as usa, em vez de dentro do componente.
 */
export interface TextosDoTour {
  /** Sob o campo do nome: onde aquele nome vai aparecer. */
  dicaDoNome: string
  /** O parágrafo da última cena. */
  fecho: string
  botaoFinal: string
}

export interface TourStep {
  /**
   * Candidatos a alvo, em ordem de preferência — o primeiro que estiver
   * visível vence. Mais de um porque a mesma ideia aparece em elementos
   * diferentes conforme o estado: numa conta recém-criada o painel mostra a
   * tela de boas-vindas (com o botão de primeiro lançamento), e numa conta
   * com histórico mostra o cabeçalho normal (com "Novo lançamento").
   */
  targets: readonly string[]
  icon: IconName
  title: string
  body: string
}

/**
 * A narrativa segue a própria barra lateral, de cima para baixo, com a ação
 * mais frequente logo depois da primeira parada. Percorrer o tour é percorrer
 * o produto na ordem em que ele está desenhado: quem termina já passou o olho
 * por todos os destinos, e nenhum vira surpresa depois.
 */
export const TOUR_TEXTOS: TextosDoTour = {
  dicaDoNome: 'Vai impresso como titular no cartão do painel.',
  fecho: 'O painel está vazio porque ainda não aconteceu nada nele. Lance um gasto de ontem (um café serve) e ele começa a responder.',
  botaoFinal: 'Ir para o painel',
}

export const TOUR_STEPS: readonly TourStep[] = [
  {
    targets: ['nav-painel'],
    icon: 'layout-dashboard',
    title: 'Todo mês começa do zero',
    body: 'Este é o painel, e ele fala de um mês por vez: quanto entrou, para onde foi, o que sobrou. Trocar o mês troca a tela inteira.',
  },
  {
    targets: ['new-transaction', 'welcome-first-transaction'],
    icon: 'plus',
    title: 'Aqui é onde tudo começa',
    body: 'Cada café, cada salário, cada valor guardado entra por aqui. Leva menos tempo do que anotar num papel, e é o caminho que você mais vai percorrer.',
  },
  {
    targets: ['nav-transacoes'],
    icon: 'arrow-left-right',
    title: 'Tudo que você lançou fica aqui',
    body: 'A lista completa, com busca e filtros. Dá para corrigir um valor, trocar a categoria ou apagar o que entrou errado, um a um.',
  },
  {
    targets: ['nav-orcamento'],
    icon: 'chart-column',
    title: 'Um teto para cada categoria',
    body: 'Você diz quanto pretende gastar com mercado, transporte, lazer. O painel avisa enquanto o mês corre, não depois que ele acabou.',
  },
  {
    targets: ['nav-metas'],
    icon: 'target',
    title: 'A sobra ganha um destino',
    body: 'Uma viagem, uma reserva para imprevistos. O progresso vem sempre do que você guardou de verdade, nunca de um número digitado à mão.',
  },
  {
    targets: ['nav-contas'],
    icon: 'credit-card',
    title: 'De onde o dinheiro saiu',
    body: 'Conta corrente, cartão, dinheiro em espécie. Cadastrar o cartão faz o painel desenhar ele de verdade, com fechamento e vencimento.',
  },
  {
    targets: ['nav-ajustes'],
    icon: 'settings',
    title: 'O que é seu, do seu jeito',
    body: 'Tema claro ou escuro, modo privacidade para esconder os valores, exportar tudo em CSV e apagar a base quando quiser recomeçar.',
  },
  {
    targets: ['profile'],
    icon: 'user',
    title: 'E este canto é seu',
    body: 'Trocar o retrato, ajustar como você é chamado, ou sair. Fica sempre aqui, em qualquer tela.',
  },
]

export interface Rect {
  top: number
  left: number
  width: number
  height: number
}

export interface Viewport {
  width: number
  height: number
}

export interface BalloonPlacement {
  top: number
  left: number
  /** Para a seta apontar do lado certo. */
  side: 'above' | 'below'
}

export const BALLOON_WIDTH = 340
export const BALLOON_ESTIMATED_HEIGHT = 208
const GAP = 14
const MARGIN = 16

/**
 * Onde encostar o balão em relação ao alvo iluminado.
 *
 * Prefere abaixo; se não couber, vai para cima. Depois disso centraliza no
 * alvo e prende dentro da janela, para o balão nunca nascer metade fora da
 * tela — o erro mais comum deste tipo de tour, e o que mais o faz parecer
 * quebrado justamente nas telas pequenas, onde ele mais importa.
 */
export function placeBalloon(
  target: Rect,
  viewport: Viewport,
  balloonHeight = BALLOON_ESTIMATED_HEIGHT,
): BalloonPlacement {
  const espacoAbaixo = viewport.height - (target.top + target.height)
  const cabeAbaixo = espacoAbaixo >= balloonHeight + GAP + MARGIN

  const side: BalloonPlacement['side'] = cabeAbaixo ? 'below' : 'above'
  const top = cabeAbaixo
    ? target.top + target.height + GAP
    : Math.max(MARGIN, target.top - balloonHeight - GAP)

  const larguraBalao = Math.min(BALLOON_WIDTH, viewport.width - MARGIN * 2)
  const centralizado = target.left + target.width / 2 - larguraBalao / 2
  const limiteDireito = Math.max(MARGIN, viewport.width - larguraBalao - MARGIN)
  const left = Math.min(Math.max(MARGIN, centralizado), limiteDireito)

  return { top, left, side }
}

/**
 * O primeiro elemento **visível** entre os candidatos de um passo.
 *
 * Visibilidade importa aqui por dois motivos que se acumulam: a navegação
 * existe duas vezes no DOM (barra lateral no desktop, barra inferior no
 * celular) e só uma está em cena; e o painel troca de conteúdo conforme a
 * conta tenha ou não histórico. Pegar o primeiro do `querySelectorAll`
 * iluminaria um retângulo sobre nada.
 */
export function findVisibleTarget(root: ParentNode, targets: readonly string[]): Element | null {
  for (const target of targets) {
    for (const candidato of root.querySelectorAll(`[data-tour="${target}"]`)) {
      if (candidato.getClientRects().length > 0) return candidato
    }
  }
  return null
}

/**
 * Descarta os passos cujo alvo não existe nesta tela, uma vez só, na abertura.
 *
 * Filtrar na abertura em vez de a cada passo é o que mantém o contador
 * ("2 de 5") honesto: uma contagem que encolhe no meio do caminho é pior que
 * não ter contagem nenhuma.
 */
export function resolveSteps(root: ParentNode, steps: readonly TourStep[]): TourStep[] {
  return steps.filter((step) => findVisibleTarget(root, step.targets) !== null)
}
