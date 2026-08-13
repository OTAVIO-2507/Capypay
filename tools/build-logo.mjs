import { mkdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

/**
 * Conversão única da logo, rodada à mão e não no build.
 *
 * A arte original é traço branco sobre um degradê cinza opaco. Do jeito que
 * está ela só funcionaria sobre fundo escuro — e neste sistema a barra lateral
 * inverte de tinta para papel no tema escuro, então a logo sumiria em metade
 * dos casos.
 *
 * A saída é um PNG onde a **opacidade vem da luminosidade**: o traço branco
 * fica opaco, o fundo cinza vira transparente. Assim o arquivo serve de
 * máscara CSS e a logo passa a assumir a cor do contexto, acompanhando o tema
 * sem precisar de duas versões.
 *
 * Uso: `npm i -D sharp && node tools/build-logo.mjs` depois de trocar a arte em
 * `assets/logo-source.png`. O `sharp` não fica nas dependências do projeto de
 * propósito: são sete pacotes com binário nativo que a aplicação não usa e que
 * só atrasariam o `npm ci` da publicação.
 */
const ROOT = fileURLToPath(new URL('../', import.meta.url))
const SOURCE = `${ROOT}assets/logo-source.png`
const PUBLIC = `${ROOT}public`
// A marca vai para `src/` e não para `public/` porque é importada pelo código:
// assim o Vite coloca o hash no nome e o cache do navegador nunca serve uma
// versão velha depois de uma troca de arte. O favicon fica em `public/`, já
// que quem o referencia é o `index.html`.
const ASSETS = `${ROOT}src/assets`

mkdirSync(PUBLIC, { recursive: true })
mkdirSync(ASSETS, { recursive: true })

/**
 * Abaixo disto o pixel é fundo; acima, traço.
 *
 * O valor foi escolhido comparando as saídas lado a lado, não no chute: a arte
 * de origem tem um brilho difuso em volta do traço, e limiares mais baixos
 * (0.72, 0.84) preservavam esse halo, que numa máscara vira uma nuvem cinza em
 * volta do desenho. Acima de 0.97 o traço começa a esfarelar.
 */
const LIMIAR = 0.94

const { data, info } = await sharp(SOURCE)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

const pixels = Buffer.from(data)
for (let i = 0; i < pixels.length; i += info.channels) {
  const r = pixels[i] / 255
  const g = pixels[i + 1] / 255
  const b = pixels[i + 2] / 255
  // Luminância perceptual: o olho pesa verde muito mais que azul, e usar a
  // média simples deixaria o degradê cinza mais claro do que ele parece.
  const luz = 0.2126 * r + 0.7152 * g + 0.0722 * b

  // Rampa suave a partir do limiar, para a borda do traço não ficar serrilhada.
  const alfa = Math.max(0, Math.min(1, (luz - LIMIAR) / (1 - LIMIAR)))

  pixels[i] = 255
  pixels[i + 1] = 255
  pixels[i + 2] = 255
  pixels[i + 3] = Math.round(alfa * 255)
}

const recortada = sharp(pixels, { raw: { width: info.width, height: info.height, channels: info.channels } })
  .png()
  // Remove a moldura transparente que sobra depois do recorte por luminosidade.
  .trim({ threshold: 1 })

// 256px basta: a marca aparece a 28–40px, e mesmo em tela retina isso dá
// folga. Guardar 512 seria carregar quatro vezes mais bytes por nada.
await recortada
  .clone()
  .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png({ compressionLevel: 9, palette: true })
  .toFile(`${ASSETS}/logo.png`)

// Favicon: a máscara não serve aqui, porque o ícone da aba precisa de fundo
// próprio. Traço branco sobre tinta, com respiro para não encostar na borda.
const marca = await recortada
  .clone()
  .resize(140, 140, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .toBuffer()

await sharp({
  create: { width: 180, height: 180, channels: 4, background: { r: 22, g: 23, b: 26, alpha: 1 } },
})
  .composite([{ input: marca, gravity: 'center' }])
  .png({ compressionLevel: 9 })
  .toFile(`${PUBLIC}/favicon.png`)

const meta = await sharp(`${ASSETS}/logo.png`).metadata()
console.log(`logo.png    ${meta.width}x${meta.height}  ${(meta.size / 1024).toFixed(1)} KB`)
const fav = await sharp(`${PUBLIC}/favicon.png`).metadata()
console.log(`favicon.png ${fav.width}x${fav.height}  ${(fav.size / 1024).toFixed(1)} KB`)
