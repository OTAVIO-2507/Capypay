import { LEGACY_STORAGE_KEY, STORAGE_KEY } from './defaults'

/**
 * O que sai do navegador quando a sessão acaba.
 *
 * Os dados financeiros vivem no Supabase desde a versão 2, mas o navegador de
 * quem usou as versões anteriores ainda guarda o documento inteiro em
 * `localStorage` — lançamentos, valores, nomes de conta —, e nada nunca
 * apagou aquilo. Não é hipótese remota: é a base de qualquer pessoa que usou o
 * produto antes da conta existir, parada em claro num computador que pode ser
 * de trabalho, de casa ou compartilhado.
 *
 * Sair da conta é o momento certo de limpar. É quando a pessoa diz que
 * terminou, e é o gesto que ela faz justamente quando outra pessoa vai usar a
 * máquina.
 *
 * Fica fora de `authStore` de propósito: aquele arquivo cria o cliente
 * Supabase no escopo do módulo, e testar uma limpeza de armazenamento não deve
 * exigir credenciais.
 */

/** A oferta de segundo fator adiada nesta sessão do navegador. */
const CHAVE_2FA_ADIADO = 'capypay/2fa-adiado'

/*
 * `capypay/admin-preferences` fica, e a decisão é deliberada.
 *
 * Ela guarda nome, apelido e avatar de quem administra — dado de pessoa, não
 * de dinheiro — e já está isolada por conta: `adotarDono` zera tudo assim que
 * outra pessoa entra no mesmo navegador, que é o caso em que o resíduo teria
 * consequência. Apagá-la aqui levaria junto o marcador do tour de boas-vindas,
 * e a apresentação recomeçaria a cada saída e entrada.
 */

/**
 * Apaga o que identifica uma pessoa ou descreve o dinheiro dela.
 *
 * Cada remoção é isolada: armazenamento pode lançar (navegação privativa,
 * cookies bloqueados), e uma chave que falha não pode impedir a próxima de
 * ser removida — a limpeza pela metade é pior do que a limpeza que tentou
 * tudo.
 */
export function limparResiduosLocais(): void {
  const chaves = [STORAGE_KEY, LEGACY_STORAGE_KEY]

  for (const chave of chaves) {
    try {
      window.localStorage.removeItem(chave)
    } catch {
      // Sem armazenamento não há resíduo para apagar.
    }
  }

  try {
    window.sessionStorage.removeItem(CHAVE_2FA_ADIADO)
  } catch {
    // Idem.
  }
}
