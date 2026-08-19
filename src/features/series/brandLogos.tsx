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
      <path
        d="M5 2h4.2l5.6 15.5V2H19v20h-4.2L9.2 6.6V22H5z"
        fill="currentColor"
      />
    </svg>
  );
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
  );
}

/** O botão de play do YouTube. */
export function YoutubeLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[58%]">
      <path d="M9.5 8.2l7 3.8-7 3.8z" fill="currentColor" />
    </svg>
  );
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
  );
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
  );
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
  );
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
  );
}

/** O play em triângulo cheio, para serviços de vídeo em geral. */
export function StreamLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[56%]">
      <path d="M8.5 5.5l10 6.5-10 6.5z" fill="currentColor" />
    </svg>
  );
}

/**
 * A estrela da Anthropic, que identifica o Claude.
 *
 * Oito raios saindo do mesmo centro, os retos mais longos que os diagonais.
 * O comprimento alternado é o que separa esta forma de um asterisco comum:
 * com todos os raios iguais o desenho vira tipografia, e não marca.
 */
export function AnthropicLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[64%]">
      <path
        d="M12 12V2.6M12 12v9.4M12 12H2.6M12 12h9.4M12 12 7.4 7.4M12 12l4.6 4.6M12 12l4.6-4.6M12 12l-4.6 4.6"
        stroke="currentColor"
        strokeWidth="2.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

/**
 * A figura de braços abertos da Vivo.
 *
 * Cabeça solta e corpo em arco, que é o que sobra da marca quando ela é
 * reduzida ao tamanho de um ícone de aplicativo.
 */
export function VivoLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[66%]">
      <circle cx="12" cy="6.9" r="3.2" fill="currentColor" />
      <path
        d="M12 11.6c-4.5 0-8.2 3.5-8.5 8-.07 1 .74 1.9 1.75 1.9h13.5c1.01 0 1.82-.9 1.75-1.9-.3-4.5-4-8-8.5-8z"
        fill="currentColor"
      />
    </svg>
  )
}

/**
 * O G do Google: o anel aberto em cima e a barra que entra pela direita.
 *
 * Desenhado em traço único, então a barra nasce da própria ponta do arco, que
 * é a junção que faz a letra ser lida como G e não como C com um risco.
 */
export function GoogleLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[64%]">
      <path
        d="M16.95 7.05A7 7 0 1 0 19 12h-6.2"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

/**
 * O sorriso da Amazon, com a flecha subindo à direita.
 *
 * É o que distingue Prime Video de qualquer outro serviço de vídeo: um
 * triângulo de play serviria para os dez concorrentes, e este arco só serve
 * para um.
 */
export function SmileLogo() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="size-[76%]">
      <path
        d="M4.5 12.2c2.5 4.4 8.9 5.8 13.7 2.4"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        fill="none"
      />
      <path d="M21 12.6 18.8 16.9 16.3 13.3z" fill="currentColor" />
    </svg>
  )
}
