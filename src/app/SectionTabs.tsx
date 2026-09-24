import { NavLink } from 'react-router-dom'
import { Icon } from '@/components/Icon'
import { cn } from '@/lib/cn'
import type { NavDestination } from './navigation'

/**
 * A fila de abas em pílula, centralizada no topo do conteúdo.
 *
 * Ela substitui a barra lateral como navegador de seções, e a troca não é de
 * gosto: no produto de referência a lateral não navega seções — ela carrega o
 * assistente, os agentes e o histórico de conversa, e quem troca de seção é
 * esta fila. São dois sistemas com dois papéis, e misturá-los foi o erro da
 * primeira versão desta tela.
 *
 * O item ativo é a única coisa colorida: borda, texto e ícone no acento, sobre
 * um preenchimento do mesmo matiz a 12%. Os inativos ficam em pílula neutra
 * com hairline. Não há indicador deslizante aqui, ao contrário da lateral —
 * numa fila horizontal com rótulos de larguras diferentes, a viagem do
 * indicador atravessa três ou quatro pílulas e vira ruído em vez de pista.
 *
 * Rola na horizontal no celular, com as bordas desvanecendo para anunciar que
 * há mais coisa fora da vista. `scrollbar-width: none` esconde a barra sem
 * tirar a rolagem: o dedo continua funcionando, e no desktop a fila cabe
 * inteira e nunca rola.
 */
export function SectionTabs({
  destinations,
  label,
  className,
}: {
  destinations: readonly NavDestination[]
  label: string
  className?: string
}) {
  return (
    <nav
      aria-label={label}
      className={cn(
        'relative -mx-4 overflow-x-auto px-4 [scrollbar-width:none]',
        '[&::-webkit-scrollbar]:hidden',
        // A máscara vale em toda largura. Ela já foi só do celular, quando a
        // fila cabia inteira no desktop; com oito abas ela transborda numa
        // janela de 1100px, e sem o esmaecimento a última aba simplesmente
        // termina cortada, sem nada que diga que há mais para o lado. Onde a
        // fila cabe, a borda esmaecida cai sobre a margem vazia.
        '[mask-image:linear-gradient(to_right,transparent,black_16px,black_calc(100%-16px),transparent)]',
        className,
      )}
    >
      {/*
        `w-max` com `mx-auto`, e não `justify-center`: centralizar com
        justify empurra o que transborda para os dois lados, e o começo da
        fila fica cortado sem rolagem que o alcance. Com margem automática,
        a fila cabe centrada quando cabe e começa na borda quando não cabe —
        que é o caso de oito abas numa janela de 1100px.
      */}
      <ul className="mx-0 flex w-max items-center gap-2 lg:mx-auto">
        {destinations.map((destination) => (
          <li key={destination.to}>
            <NavLink
              to={destination.to}
              end={destination.end ?? destination.to === '/'}
              data-tour={destination.tour}
              className={({ isActive }) =>
                cn(
                  'inline-flex h-12 items-center gap-2 rounded-full border px-5 text-[0.8125rem] whitespace-nowrap',
                  'transition-colors duration-150',
                  isActive
                    ? 'border-accent/45 bg-accent/12 font-semibold text-accent'
                    : 'border-hairline bg-sheet font-medium text-muted hover:border-hairline-strong hover:text-ink',
                )
              }
            >
              {({ isActive }) => (
                <>
                  <Icon
                    name={destination.icon}
                    size={17}
                    strokeWidth={isActive ? 2.25 : 1.75}
                    aria-hidden="true"
                  />
                  {destination.label}
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}
