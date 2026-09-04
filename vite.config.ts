import { createHash } from 'node:crypto'
import { copyFileSync, existsSync } from 'node:fs'
import { resolve } from 'node:path'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig, loadEnv, type Plugin } from 'vite'

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

/**
 * A política de segurança de conteúdo, montada no build.
 *
 * Por que aqui e não escrita à mão no `index.html`: dois valores dela não são
 * constantes. O endereço do Supabase muda por ambiente e vem de variável de
 * build, e o resumo do script inline do tema muda a cada edição daquele bloco
 * — um resumo desatualizado no HTML derrubaria o tema sem nenhum aviso além de
 * uma linha no console. Calcular os dois no momento em que o HTML é gerado é o
 * que mantém a política verdadeira sem depender de alguém lembrar.
 *
 * Ela é a diferença entre um XSS que rouba a sessão e um XSS que não consegue
 * mandar nada para lugar nenhum: o token do Supabase vive no armazenamento do
 * navegador, e `connect-src` restrito faz o roubo não ter para onde ir.
 *
 * **Só em produção.** No servidor de desenvolvimento o Vite injeta scripts e
 * mantém uma conexão de recarregamento que a política recusaria, e o efeito
 * seria uma tela quebrada em desenvolvimento para proteger um usuário que não
 * existe ali. Quem é servido pela internet recebe a política; quem roda na
 * própria máquina, não.
 */
function contentSecurityPolicy(supabaseUrl: string | undefined): Plugin {
  return {
    name: 'content-security-policy',
    apply: 'build',
    transformIndexHtml: {
      // `post`: o HTML já está montado, com os scripts que os outros plugins
      // injetaram. Calcular o resumo antes disso deixaria de fora justamente o
      // que foi acrescentado depois.
      order: 'post',
      handler(html) {
        const resumos = [...html.matchAll(/<script(?![^>]*\ssrc=)[^>]*>([\s\S]*?)<\/script>/gi)]
          .map((achado) => achado[1])
          .filter((codigo) => codigo.trim() !== '')
          .map(
            (codigo) => `'sha256-${createHash('sha256').update(codigo, 'utf8').digest('base64')}'`,
          )

        /*
         * O projeto Supabase, e não `*.supabase.co`.
         *
         * O curinga aceitaria o projeto Supabase de qualquer pessoa como
         * destino — inclusive o de quem estivesse explorando um XSS, que é
         * exatamente o destino que esta diretiva existe para negar. O curinga
         * fica só como rede de segurança para um build sem a variável, que é
         * um build que não autentica de qualquer forma.
         */
        const supabase = supabaseUrl?.trim()
        const origemSupabase = (() => {
          if (!supabase) return 'https://*.supabase.co wss://*.supabase.co'
          try {
            const { origin, host } = new URL(supabase)
            return `${origin} wss://${host}`
          } catch {
            return 'https://*.supabase.co wss://*.supabase.co'
          }
        })()

        const politica = [
          // Nada carrega de lugar nenhum, exceto o que as linhas abaixo abrem.
          "default-src 'none'",
          `script-src 'self' ${resumos.join(' ')}`.trim(),
          // `unsafe-inline` só para estilo: React e Recharts escrevem `style`
          // direto no elemento, e não há como enumerar esses valores. Estilo
          // injetado desfigura a página; não exfiltra sessão.
          "style-src 'self' 'unsafe-inline'",
          // `data:` é do QR code da verificação em duas etapas, que o Supabase
          // devolve como SVG embutido. `blob:` é do CSV exportado.
          "img-src 'self' data: blob:",
          // `data:` porque o Vite embute como URI qualquer asset abaixo de
          // `assetsInlineLimit`, e um subset de fonte cabe nesse limite. Sem
          // isto, a página perderia a fonte num build futuro sem nada ter
          // mudado no código — e a política é justamente o que não pode
          // quebrar em silêncio.
          "font-src 'self' data:",
          // Para onde o aplicativo pode falar: o próprio projeto Supabase e a
          // API da Pluggy, usada pelo widget de conexão bancária.
          `connect-src 'self' ${origemSupabase} https://api.pluggy.ai`,
          // O widget da Pluggy abre num quadro servido por eles.
          'frame-src https://connect.pluggy.ai',
          // Ninguém embute esta aplicação. Navegador que respeita a diretiva em
          // `<meta>` fecha aqui; para os outros, o bloco inline do `index.html`
          // faz o mesmo em JavaScript.
          "frame-ancestors 'none'",
          // Sem `<base>` injetado, que reescreveria todo caminho relativo da
          // página para um servidor de fora.
          "base-uri 'none'",
          "form-action 'self'",
          "object-src 'none'",
          'upgrade-insecure-requests',
        ].join('; ')

        /*
         * A tag entra logo **depois** do `charset`, e não antes dele.
         *
         * O navegador precisa descobrir a codificação nos primeiros 1024 bytes
         * do documento; uma política de setecentos caracteres na frente empurra
         * o `charset` para perto desse limite sem necessidade. Como a política
         * só governa o que for carregado depois de ser lida, e tudo o que
         * carrega vem depois destas duas linhas, a ordem entre as duas é livre
         * — e a ordem certa é a que não mexe na detecção de codificação.
         *
         * A política não contém aspas duplas, então o atributo pode usá-las sem
         * escape. Se um dia contiver, este é o lugar que precisa saber disso.
         */
        const tag = `<meta http-equiv="Content-Security-Policy" content="${politica}" />`
        const charset = /<meta\s+charset=["'][^"']*["']\s*\/?>/i

        return charset.test(html)
          ? html.replace(charset, (achado) => `${achado}\n    ${tag}`)
          : html.replace(/<head>/i, `<head>\n    ${tag}`)
      },
    },
  }
}

export default defineConfig(({ command, isPreview, mode }) => {
  /*
   * `loadEnv` e não `process.env`: as chaves moram em `.env.local`, que o Vite
   * lê para a aplicação mas não injeta no processo do próprio arquivo de
   * configuração. Sem isto, um build local cairia sempre no curinga
   * `*.supabase.co` da política — mais frouxo, e sem ninguém perceber.
   */
  const env = loadEnv(mode, import.meta.dirname, 'VITE_')

  return {
    /*
     * `vite preview` roda com `command === 'serve'`, igual ao dev — então
     * testar só por `command` fazia o preview servir na raiz enquanto os
     * arquivos em `dist/` apontavam para `/Capypay/assets/...`. O resultado era
     * 404 em todo asset e uma página em branco, num modo cuja única função é
     * conferir o build antes de publicar. `isPreview` separa os dois casos.
     */
    base: command === 'build' || isPreview ? REPO_BASE : '/',
    plugins: [
      react(),
      tailwindcss(),
      contentSecurityPolicy(env.VITE_SUPABASE_URL),
      spaFallbackFor404(),
    ],
    resolve: {
      alias: {
        '@': resolve(import.meta.dirname, 'src'),
      },
    },
    build: {
      outDir: 'dist',
      sourcemap: false,
      // Sem isto, os arquivos com hash de builds anteriores permanecem em
      // `dist` e vão para o deploy junto — o site publicado carrega os
      // corretos, mas sobem megabytes de código morto a cada versão.
      emptyOutDir: true,
    },
  }
})
