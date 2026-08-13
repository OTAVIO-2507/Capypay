import { isRouteErrorResponse, useRouteError } from 'react-router-dom'
import { Icon } from '@/components/Icon'

/**
 * Página de erro da raiz do roteador.
 *
 * Ela cobre dois casos que não têm nada a ver um com o outro, e a versão
 * anterior mostrava "esta página não existe" para os dois — o que fazia uma
 * falha de renderização se disfarçar de link errado e mandava quem estava
 * depurando para o lado errado.
 *
 * Caso 1: nenhuma rota casou. Quase sempre é a base do endereço: o aplicativo
 * é publicado num subcaminho, e abrir fora dele faz o roteador não reconhecer
 * nada. Por isso o botão daqui é `<a href>` com a base real, e não um `<Link>`
 * — sob base divergente, o `<Link>` erraria de novo, exatamente do mesmo jeito.
 *
 * Caso 2: algo lançou durante a renderização. Aí o que importa é a mensagem.
 */
export function ErrorPage() {
  const error = useRouteError()
  const base = import.meta.env.BASE_URL
  const isNotFound = isRouteErrorResponse(error) && error.status === 404
  const path = typeof window === 'undefined' ? '' : window.location.pathname

  return (
    <div className="flex min-h-dvh items-center justify-center bg-desk px-6 py-16">
      <div className="w-full max-w-lg text-center">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-sunken text-faint">
          <Icon name={isNotFound ? 'circle-alert' : 'triangle-alert'} size={24} />
        </span>

        <h1 className="mt-4 text-base font-semibold text-ink">
          {isNotFound ? 'Este endereço não corresponde a nenhuma tela' : 'A aplicação falhou'}
        </h1>

        <p className="mx-auto mt-2 max-w-[46ch] text-xs leading-relaxed text-muted">
          {isNotFound
            ? 'O aplicativo é servido a partir de um subcaminho. Abrir por um endereço fora dele faz o roteador não reconhecer a rota.'
            : 'Um erro inesperado interrompeu a renderização. Recarregar costuma resolver; se voltar a acontecer, a mensagem abaixo diz o que quebrou.'}
        </p>

        {/*
          O diagnóstico fica visível de propósito. Sem ele, o caminho esperado e
          o caminho aberto são justamente os dois dados que ninguém consegue ver
          — e são os que resolvem o problema em um segundo.
        */}
        <dl className="mt-6 grid gap-px overflow-hidden rounded-md border border-hairline bg-hairline text-left">
          <div className="flex items-baseline justify-between gap-4 bg-sheet px-4 py-2.5">
            <dt className="text-xs text-muted">Endereço aberto</dt>
            <dd className="truncate font-mono text-xs text-ink">{path || '—'}</dd>
          </div>
          <div className="flex items-baseline justify-between gap-4 bg-sheet px-4 py-2.5">
            <dt className="text-xs text-muted">Base esperada</dt>
            <dd className="truncate font-mono text-xs text-ink">{base}</dd>
          </div>
          {!isNotFound ? (
            <div className="bg-sheet px-4 py-2.5">
              <dt className="text-xs text-muted">Erro</dt>
              <dd className="mt-1 font-mono text-xs break-words text-ink">
                {error instanceof Error ? error.message : String(error)}
              </dd>
            </div>
          ) : null}
        </dl>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          <a
            href={base}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-block px-5 text-[0.8125rem] font-semibold text-block-ink transition-colors duration-150 hover:bg-block-hover"
          >
            <Icon name="layout-dashboard" size={16} />
            Abrir o painel
          </a>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="inline-flex h-11 items-center gap-2 rounded-full bg-sunken px-5 text-[0.8125rem] font-semibold text-ink transition-colors duration-150 hover:bg-hairline"
          >
            <Icon name="repeat" size={16} />
            Recarregar
          </button>
        </div>
      </div>
    </div>
  )
}
