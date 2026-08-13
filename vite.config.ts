import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

/**
 * O deploy é o GitHub Pages em `/Capypay/`. Um Pages de projeto serve
 * a partir de um subcaminho, então `base` precisa combinar com o nome do repositório;
 * localmente ele volta a ser `/` para o dev server não sofrer com o prefixo.
 */
const REPO_BASE = '/Capypay/'

/**
 * O GitHub Pages não sabe reescrever rotas de SPA: um refresh em `/transacoes`
 * bate num 404 do servidor. Servindo o mesmo documento como `404.html`, o Pages
 * devolve a aplicação para qualquer caminho desconhecido e o React Router lê a
 * URL original. É o custo de manter URLs limpas em hospedagem estática.
 */
function spaFallbackFor404() {
  return {
    name: 'spa-fallback-404',
    closeBundle() {
      const index = resolve(import.meta.dirname, 'dist/index.html')
      if (existsSync(index)) {
        copyFileSync(index, resolve(import.meta.dirname, 'dist/404.html'))
      }
    },
  }
}

export default defineConfig(({ command, isPreview }) => ({
  /*
   * `vite preview` roda com `command === 'serve'`, igual ao dev — então testar
   * só por `command` fazia o preview servir na raiz enquanto os arquivos em
   * `dist/` apontavam para `/Capypay/assets/...`. O resultado era
   * 404 em todo asset e uma página em branco, num modo cuja única função é
   * conferir o build antes de publicar. `isPreview` separa os dois casos.
   */
  base: command === 'build' || isPreview ? REPO_BASE : '/',
  plugins: [react(), tailwindcss(), spaFallbackFor404()],
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, 'src'),
    },
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Sem isto, os arquivos com hash de builds anteriores permanecem em `dist`
    // e vão para o deploy junto — o site publicado carrega os corretos, mas
    // sobem megabytes de código morto a cada versão.
    emptyOutDir: true,
  },
}))
