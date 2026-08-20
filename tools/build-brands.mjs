import { mkdirSync, readdirSync, rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

/**
 * Conversão das artes de marca, rodada à mão e não no build.
 *
 * O que chega em `assets/Assinaturas/` vem de onde deu para achar: PNG de 2 MB
 * a 2048px, JPEG de 225px, arte com fundo transparente e arte com fundo
 * chapado. A pastilha que exibe tudo isso tem 36 pixels de lado, e um dos
 * arquivos sozinho pesava mais que o resto do aplicativo somado.
 *
 * A saída é uniforme: 128 pixels, quadrada, sem transparência. O dobro do
 * tamanho de tela cobre a tela retina e para por aí. O fundo branco embaixo
 * existe porque arte transparente sobre a folha branca do tema claro fica sem
 * onde terminar — e a pastilha desenha um anel de hairline contando com isso.
 *
 * Uso: `npm i --no-save sharp && node tools/build-brands.mjs`. O `sharp` não
 * fica nas dependências de propósito: são pacotes com binário nativo que a
 * aplicação não usa e que só atrasariam o `npm ci` da publicação.
 */
const ROOT = fileURLToPath(new URL('../', import.meta.url))
const ORIGEM = `${ROOT}assets/Assinaturas`
const DESTINO = `${ROOT}src/assets/brands`

/** O lado da arte final. O dobro dos 44px da maior pastilha, arredondado. */
const LADO = 128

/** `logo-PrimeVideo.png` e `logo_Ironlegacy_training_center.jpg` viram chaves. */
function chaveDoArquivo(nome) {
  return nome
    .replace(/\.[^.]+$/, '')
    .replace(/^logo[-_]?/i, '')
    .replace(/([a-z])([A-Z])/g, '$1-$2')
    .replace(/[_\s]+/g, '-')
    .toLowerCase()
}

rmSync(DESTINO, { recursive: true, force: true })
mkdirSync(DESTINO, { recursive: true })

for (const arquivo of readdirSync(ORIGEM)) {
  if (!/\.(png|jpe?g|webp)$/i.test(arquivo)) continue

  const chave = chaveDoArquivo(arquivo)
  await sharp(`${ORIGEM}/${arquivo}`)
    .resize(LADO, LADO, { fit: 'cover' })
    .flatten({ background: '#ffffff' })
    .png({ compressionLevel: 9, palette: true })
    .toFile(`${DESTINO}/${chave}.png`)

  console.log(`${arquivo} -> ${chave}.png`)
}
