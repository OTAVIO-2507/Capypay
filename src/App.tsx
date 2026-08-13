/**
 * CONTRATO DE DIREÇÃO — CapyPay
 *
 * THESIS: "Papel sobre papel". Folhas de papel encorpado apoiadas numa mesa
 * cinza, tinta preta e nenhum matiz. A ausência de cor é a decisão: sem
 * matiz para carregar significado, a hierarquia recai sobre tamanho, peso,
 * densidade e espaço — coisas que não envelhecem e que nenhum leitor perde.
 * Recusa a estrutura padrão da categoria (quatro cards de métrica idênticos)
 * e as duas muletas semânticas de sempre (o gradiente colorido e o par
 * verde/vermelho).
 *
 * OWN-WORLD: Mesa #E9EBEE, folha branca, hairline de 1px, sombra de duas
 * camadas — contato curto e difusão longa. Cantos de 24px, moldura de 32px.
 * Geist para texto, Geist Mono com tabular-nums em toda coluna de valor. O
 * único acento é o inverso: um bloco de tinta cheia, no máximo três por tela,
 * que inverte para claro no tema escuro.
 *
 * STORY: O usuário chega para uma consulta de segundos. Vê a figura do mês e
 * a curva do ano; varre orçamento e categorias para saber onde apertou; lança
 * o que faltava sem sair da página.
 *
 * FIRST VIEWPORT: Moldura flutuante com rail de 76px à esquerda. Título e
 * seletor global de mês no topo. Abaixo, à esquerda, o cartão cadastrado em
 * bloco de tinta; à direita, a figura do resultado em ~44px sobre a curva do
 * ano, com as pílulas de mês servindo de eixo e de controle. A ação primária,
 * "Novo lançamento", fica na barra de topo à direita.
 *
 * FORM: Painel operacional de densidade alta. Mundo fixado pelo brief do
 * usuário (referência monocromática de painéis flutuantes), com duas decisões
 * confirmadas por pergunta estruturada: monocromático puro com alerta pela
 * forma, e profundidade suave em vez de neumorfismo estampado. Direção fixada
 * pelo brief vence o sorteio, então nenhum concept-seed foi rodado.
 */

import { RouterProvider } from 'react-router-dom'
import { ThemeProvider } from '@/app/ThemeProvider'
import { router } from '@/app/router'

export function App() {
  return (
    <ThemeProvider>
      <RouterProvider router={router} />
    </ThemeProvider>
  )
}
