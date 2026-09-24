import type { ReactNode } from 'react'

/**
 * Coluna central estreita, para as telas que são uma lista de itens.
 *
 * Parcelamentos e Assinaturas são uma linha por compra ou por serviço: nome à
 * esquerda, valor à direita. Na largura inteira de um monitor de 1900px, os
 * dois ficavam a um metro e meio um do outro, e ligar o valor ao nome certo
 * exigia seguir a linha com o dedo. Estreita e centrada, como no produto de
 * referência, a linha volta a ser lida de uma vez.
 *
 * As telas de painel — Visão geral, Transações — continuam na largura
 * inteira: lá há colunas lado a lado, ou uma tabela com seis campos, e o
 * espaço é ocupado por conteúdo, não por vão.
 */
export function NarrowColumn({
  children,
  width = 'md',
}: {
  children: ReactNode
  /**
   * `md` são os 1120px das listas. `lg` são 1280px, para a tela de Contas:
   * ali a peça principal é o cartão de crédito em meia largura, e numa coluna
   * mais estreita ele ficava apertado — o valor da fatura, o limite e a
   * legenda disputando 470px.
   */
  width?: 'md' | 'lg'
}) {
  return (
    <div className={width === 'lg' ? 'mx-auto w-full max-w-[80rem]' : 'mx-auto w-full max-w-[70rem]'}>
      {children}
    </div>
  )
}
