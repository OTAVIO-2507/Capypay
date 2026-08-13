import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Fontes servidas pelo próprio projeto: sem requisição a CDN, funciona offline
// e não há salto de layout esperando um arquivo remoto.
import '@fontsource-variable/geist'
import '@fontsource-variable/geist-mono'
// Usada em um lugar só, o logotipo. Ver `components/Wordmark.tsx`.
import '@fontsource-variable/figtree'
import './styles.css'

import { App } from './App'

/**
 * Guarda de base.
 *
 * O aplicativo é publicado num subcaminho (`/Capypay/`). Se o
 * endereço aberto está fora dele, o React Router não encontra nem a rota raiz
 * e — este é o detalhe que custa caro — **não renderiza nada**: nem a página
 * de erro, porque `errorElement` pertence a uma rota que nunca chegou a casar.
 * O resultado é uma tela vazia sem nenhuma pista do que houve.
 *
 * Redirecionar antes de montar resolve na origem. Não há risco de laço: depois
 * do desvio o caminho passa a começar pela base, e a condição para de valer.
 */
const base = import.meta.env.BASE_URL
if (base !== '/' && !window.location.pathname.startsWith(base)) {
  window.location.replace(base + window.location.search + window.location.hash)
}

const container = document.getElementById('root')
if (!container) throw new Error('Elemento #root não encontrado no documento.')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
