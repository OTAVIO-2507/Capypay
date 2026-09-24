/**
 * CONTRATO DE DIREÇÃO — CapyPay
 *
 * THESIS: Contornos flutuando sobre quase-preto, e um verde que carrega tudo
 * o que é positivo, ativo ou em foco. A página é #09090B e os painéis têm a
 * mesma cor dela: o que os separa é uma hairline de 1px, não um degrau de
 * superfície. O antigo monocromático de papel foi aposentado inteiro — onde a
 * hierarquia vinha de tamanho, peso e espaço numa folha branca, agora ela vem
 * do contraste entre o fundo escuro, a tinta clara e poucos matizes com papel
 * fixo.
 *
 * OWN-WORLD: Página e painel #09090B, receptáculo #18181B, hairline #27272A.
 * Acento menta #34D399 (emerald-400), despesa #EF4444, atenção âmbar #FBBF24.
 * Sem sombra — no escuro não há luz para bloquear; só o que flutua ganha uma.
 * Pílula em todo controle, 16px em toda superfície. Altura de controle em
 * 56 / 44 / 36. Geist em tudo, inclusive nos números, com algarismos
 * tabulares em toda coluna de valor; Figtree só no logotipo. A ação principal
 * é uma pílula clara com tinta #18181B.
 *
 * STORY: O usuário chega para uma consulta de segundos. Lê a frase do mês no
 * primeiro painel e fecha, ou fica e varre os outros; vê para onde o dinheiro
 * foi e se algum limite apertou; lança o que faltava sem sair da página.
 *
 * FIRST VIEWPORT: Rail estreito de ícones à esquerda. No topo do conteúdo, a
 * fila de abas em pílula com as seções — a ativa em menta. Abaixo, em duas
 * colunas, a leitura do mês ao lado do ritmo de gastos. No rodapé, fixo em
 * todas as abas, o botão do assistente com o anel iridescente.
 *
 * FORM: Painel operacional de densidade alta. Direção fixada por referência
 * externa (pierre.finance), com três decisões confirmadas por pergunta
 * estruturada: tema único escuro, camada de IA conversacional real, e o
 * redesenho alcançando o app inteiro.
 */

import { RouterProvider } from 'react-router-dom'
import { router } from '@/app/router'

export function App() {
  return <RouterProvider router={router} />
}
