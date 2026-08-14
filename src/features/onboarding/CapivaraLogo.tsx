import capivaraAcena from './capivara-acena.svg?raw'
import capivaraLogo from './capivara.svg?raw'
import { cn } from '@/lib/cn'

/**
 * A capivara da marca, animada, guiando o tour.
 *
 * É o logotipo de verdade, e não um desenho parecido com ele: o SVG em
 * `capivara.svg` veio do traçado da própria arte, com o cascalho do traçador
 * removido e os caminhos separados em grupos nomeados (brilho, moedas, corpo,
 * orelhas, olhos, focinho, pelo). É essa separação que permite mover uma parte
 * sem mover o resto.
 *
 * Entra por `?raw` em vez de virar JSX: são dezenove quilobytes de curva, que
 * dentro de um componente afogariam o código que de fato faz alguma coisa. A
 * arte fica sendo arte, num arquivo que qualquer editor vetorial abre, e o
 * componente fica sendo código. O conteúdo é constante de build, escrito por
 * nós, então não há entrada de usuário passando por aqui.
 *
 * Pintada com `currentColor`: herda a tinta do contexto e acompanha os dois
 * temas sozinha, exatamente como a `Logo` da barra superior. Nenhuma exceção
 * de cor é aberta.
 *
 * **Nenhum membro inventado.** O logotipo é cabeça, ombros e a pilha de
 * moedas, e é só isso que se move: acenar é inclinar, comemorar é a pilha
 * saltando e o brilho estourando. Uma mascote que ganha partes novas a cada
 * gesto deixa de ser a marca e vira um desenho parecido com ela.
 *
 * Sem rótulo acessível: quem usa leitor de tela recebe o texto do passo, que é
 * onde a informação está. A capivara é companhia, não conteúdo.
 */

/** Como ela se comporta. */
export type HumorDaCapivara = 'saudacao' | 'calma' | 'festa'

/**
 * Duas artes, e a diferença entre elas é de enquadramento.
 *
 * `retrato` é a marca do logotipo, cabeça e ombros: cabe pequena, ao lado de
 * um texto, sem virar mancha. `inteira` é a capivara de corpo todo com a
 * patinha levantada, que precisa de altura para ser lida e por isso só entra
 * na abertura, onde há tela sobrando.
 *
 * A arte da pose inteira repete a figura nove vezes de propósito: o corpo mais
 * oito elos do braço, cada um revelado por uma máscara numa faixa diferente. O
 * traçado saiu com braço e cabeça no mesmo contorno, e repartir o giro entre
 * vários elos é o que faz o braço encurvar sem deixar degrau na emenda. As
 * nove cópias são `<use>` do mesmo caminho, então o arquivo continua em 20 KB.
 * Quem move os elos é o CSS (`capy-elo1` a `capy-elo8`, em `styles.css`), que
 * documenta o eixo e o porquê de cada decisão.
 */
export type PoseDaCapivara = 'retrato' | 'inteira'

const ARTE: Record<PoseDaCapivara, string> = {
  retrato: capivaraLogo,
  inteira: capivaraAcena,
}

export function CapivaraLogo({
  humor,
  pose = 'retrato',
  size = 128,
  /** Muda a cada passo para ela dar um pulinho de novo. */
  hop,
  className,
}: {
  humor: HumorDaCapivara
  pose?: PoseDaCapivara
  size?: number
  hop?: number
  className?: string
}) {
  return (
    <span
      // `key` remonta o nó a cada troca de passo, que é o que faz a animação
      // de pulo tocar de novo em vez de ficar parada depois da primeira vez.
      key={hop}
      aria-hidden="true"
      style={{ width: size }}
      className={cn(
        'block [&>svg]:block [&>svg]:w-full [&>svg]:h-auto',
        'capy',
        pose === 'inteira' && 'capy--inteira',
        humor === 'saudacao' && 'capy--saudacao',
        humor === 'festa' && 'capy--festa',
        hop !== undefined && 'capy--pula',
        className,
      )}
      dangerouslySetInnerHTML={{ __html: ARTE[pose] }}
    />
  )
}
