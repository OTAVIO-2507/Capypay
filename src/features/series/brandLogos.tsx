/**
 * Logos desenhados aqui, e não baixados de fora.
 *
 * Existe API que serve logo por domínio, e usá-la contaria a um terceiro que
 * **esta** pessoa assina **este** serviço, a cada carregamento da tela. Uma
 * lista de assinaturas é um retrato bastante fiel de alguém, e o argumento do
 * produto é que o extrato não sai do dispositivo — então a marca é redesenhada
 * em SVG e viaja junto com o aplicativo.
 *
 * Só entram formas que dá para reconstituir com honestidade em poucas formas
 * geométricas. Marca que exigiria copiar o arquivo oficial fica de fora e cai
 * no monograma colorido, que identifica sem reproduzir nada.
 */

/** O N do Netflix: duas hastes e a diagonal que as liga. */
export function NetflixLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[58%]">
      <path d="M5 2h4.2l5.6 15.5V2H19v20h-4.2L9.2 6.6V22H5z" fill="currentColor" />
    </svg>
  )
}

/** As três ondas do Spotify, concêntricas e de raios crescentes. */
export function SpotifyLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[62%]">
      <path
        d="M6 9.2c3.7-1.1 8.4-.8 12 1.3M6.8 12.6c3.1-.9 7-.6 10 1.1M7.6 15.9c2.6-.7 5.7-.5 8.2.9"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

/** O botão de play do YouTube. */
export function YoutubeLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[58%]">
      <path d="M9.5 8.2l7 3.8-7 3.8z" fill="currentColor" />
    </svg>
  )
}

/** A nuvem do iCloud e de serviços de hospedagem. */
export function CloudLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[62%]">
      <path
        d="M7 18h10a3.5 3.5 0 0 0 .3-7A5.5 5.5 0 0 0 6.6 11.4 3.3 3.3 0 0 0 7 18z"
        fill="currentColor"
      />
    </svg>
  )
}

/** O halteres de academia. */
export function GymLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[62%]">
      <path
        d="M4 9v6M7 7.5v9M17 7.5v9M20 9v6M7 12h10"
        stroke="currentColor"
        strokeWidth="2.1"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  )
}

/** O balão de conversa, para assistentes e mensageria. */
export function ChatLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[60%]">
      <path
        d="M12 4.5c4.4 0 8 2.8 8 6.3s-3.6 6.3-8 6.3c-.9 0-1.8-.1-2.6-.3L5 19l1-3.2c-1.3-1.1-2-2.5-2-4S7.6 4.5 12 4.5z"
        fill="currentColor"
      />
    </svg>
  )
}

/** A birrete, para plataformas de curso. */
export function CourseLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[62%]">
      <path d="M12 5l9 4-9 4-9-4z" fill="currentColor" />
      <path
        d="M7 11.2V15c0 1.4 2.2 2.5 5 2.5s5-1.1 5-2.5v-3.8"
        stroke="currentColor"
        strokeWidth="1.9"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

/** O play em triângulo cheio, para serviços de vídeo em geral. */
export function StreamLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[56%]">
      <path d="M8.5 5.5l10 6.5-10 6.5z" fill="currentColor" />
    </svg>
  )
}
