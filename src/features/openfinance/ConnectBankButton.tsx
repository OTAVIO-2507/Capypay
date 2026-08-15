import { lazy, Suspense, useState } from 'react'
import { Button } from '@/components/ui/Button'
import { registrarConexao } from './connectionsApi'
import { criarConnectToken } from './pluggyApi'
import { useFinanceStore } from '@/store/financeStore'

/**
 * O widget vem por `lazy` e não por import direto.
 *
 * `react-pluggy-connect` arrasta o SDK da Pluggy junto — cerca de 250 KB
 * descompactados, contra um bundle de 800 KB. Quem nunca abre a conexão
 * bancária não deve pagar por isso no primeiro carregamento, que é o mesmo
 * motivo pelo qual os gráficos vivem em `LazyCharts`.
 *
 * O `default` é montado à mão porque o pacote exporta nomeado.
 */
const PluggyConnect = lazy(async () => {
  const modulo = await import('react-pluggy-connect')
  return { default: modulo.PluggyConnect }
})

/**
 * Falhas que não são falhas de conexão, e que "tente de novo" não resolve.
 *
 * O widget devolve um código quando a recusa é de regra, e não de rede ou de
 * senha errada. Sem esta tabela, todas viram a mesma mensagem genérica — e
 * mandar tentar de novo quem esbarrou num limite de plano é mandar repetir um
 * gesto que vai falhar igual, todas as vezes.
 */
const RECUSAS_CONHECIDAS: Record<string, string> = {
  TRIAL_CLIENT_ITEM_CREATE_NOT_ALLOWED:
    'A conta da Pluggy está em período de teste, e nesse plano não é possível conectar bancos. É preciso ativar o plano no painel deles.',
  ITEM_LOGIN_ERROR: 'O banco recusou os dados de acesso. Confira e tente de novo.',
  CONNECTOR_NOT_AVAILABLE: 'Esse banco está indisponível no momento. Tente mais tarde ou escolha outro.',
}

/** O código da recusa, quando o widget mandou um. */
function codigoDaFalha(falha: unknown): string | null {
  const texto = falha instanceof Error ? falha.message : typeof falha === 'string' ? falha : ''
  const doObjeto =
    falha && typeof falha === 'object'
      ? String((falha as { code?: unknown }).code ?? (falha as { message?: unknown }).message ?? '')
      : ''

  for (const codigo of Object.keys(RECUSAS_CONHECIDAS)) {
    if (texto.includes(codigo) || doObjeto.includes(codigo)) return codigo
  }
  return null
}

/**
 * Extrai algo legível do que o widget chama de erro.
 *
 * Não é `Error` garantido: pode ser objeto do SDK, resposta da API embrulhada,
 * ou string. `String(objeto)` daria "[object Object]", que é pior que nada —
 * então o objeto vira JSON antes, e só aí desiste.
 */
function detalharFalha(falha: unknown): string {
  if (falha instanceof Error) return falha.message
  if (typeof falha === 'string') return falha
  if (falha && typeof falha === 'object') {
    const dele = falha as { message?: unknown; error?: unknown }
    if (typeof dele.message === 'string') return dele.message
    if (typeof dele.error === 'string') return dele.error
    try {
      return JSON.stringify(falha)
    } catch {
      // Objeto com referência circular: sobra o tipo, que ainda diz algo.
    }
  }
  return 'sem detalhe (veja o console)'
}

interface ConnectBankButtonProps {
  /** Chamada depois de a autorização ser gravada, para a tela reagir. */
  onConnected?: (itemId: string) => void
}

/**
 * Abre o consentimento de Open Finance e guarda a autorização que volta dele.
 *
 * O token é pedido **no clique**, e não quando a tela monta. O exemplo da
 * documentação busca em `useEffect`, o que gasta um Connect Token toda vez que
 * alguém passa pela página sem clicar em nada — e ele tem vida curta. Pedir no
 * clique também dá o lugar certo para o estado de carregamento: o botão, que é
 * o que a pessoa acabou de acionar.
 *
 * O que sobra da conexão inteira é o `itemId`. Ele é gravado antes de qualquer
 * importação existir, porque perdê-lo significa refazer todo o consentimento
 * no banco — e o widget não devolve duas vezes.
 */
export function ConnectBankButton({ onConnected }: ConnectBankButtonProps) {
  const registrar = useFinanceStore((state) => state.registerBankConnection)

  const [token, setToken] = useState<string | null>(null)
  const [pedindo, setPedindo] = useState(false)
  const [erro, setErro] = useState<string | null>(null)

  async function abrir() {
    setErro(null)
    setPedindo(true)
    try {
      setToken(await criarConnectToken())
    } catch (falha) {
      setErro(falha instanceof Error ? falha.message : 'Não foi possível iniciar a conexão.')
    } finally {
      setPedindo(false)
    }
  }

  function fechar() {
    // O token é de uso único e de vida curta: descartá-lo ao fechar garante
    // que a próxima tentativa peça um novo em vez de reabrir com um vencido.
    setToken(null)
  }

  return (
    <div className="flex flex-col items-start gap-2">
      <Button icon="landmark" onClick={abrir} disabled={pedindo}>
        {pedindo ? 'Abrindo…' : 'Conectar banco'}
      </Button>

      {erro ? (
        <p role="status" className="text-xs text-expense">
          {erro}
        </p>
      ) : null}

      {token ? (
        <Suspense fallback={null}>
          <PluggyConnect
            connectToken={token}
            /*
             * O sandbox fica ligado só fora de produção. Em produção ele
             * ofereceria bancos falsos na lista junto dos de verdade, e a
             * pessoa conectaria um deles sem entender por que os lançamentos
             * não batem com o extrato.
             */
            includeSandbox={import.meta.env.DEV}
            onSuccess={(itemData) => {
              const itemId = itemData?.item?.id
              if (!itemId) {
                setErro('O banco autorizou, mas não devolveu o identificador da conexão.')
                fechar()
                return
              }

              /*
               * Grava nos dois lugares, e os dois são necessários. O documento
               * do usuário é a lista que a tela mostra; a tabela é o que o
               * webhook consegue encontrar — ele chega sem sessão e sem saber
               * de quem é o item, e não teria como procurar dentro de um jsonb
               * por usuário.
               *
               * A gravação local vem primeiro e é síncrona: se a tabela
               * falhar, a conexão não se perde, e a consequência é só o aviso
               * automático não chegar até a próxima reconexão.
               */
              registrar('pluggy', itemId)
              fechar()
              registrarConexao(itemId).catch((falha) => {
                console.error('registrarConexao:', falha)
                setErro(
                  'O banco foi conectado, mas o aviso automático de novidades não pôde ser ativado.',
                )
              })
              onConnected?.(itemId)
            }}
            onError={(falha) => {
              /*
               * Em produção a mensagem do agregador não sobe para a tela: é
               * técnica, em inglês, e quem está conectando o banco não tem o
               * que fazer com ela — precisa saber que nada foi conectado e que
               * pode tentar de novo.
               *
               * Em desenvolvimento ela sobe, porque aí quem lê é quem está
               * integrando, e a mensagem genérica obriga a abrir o console para
               * descobrir qualquer coisa. Foi exatamente o que aconteceu na
               * primeira conexão de teste.
               */
              console.error('pluggy connect:', falha)

              const codigo = codigoDaFalha(falha)
              setErro(
                codigo
                  ? RECUSAS_CONHECIDAS[codigo]
                  : import.meta.env.DEV
                    ? `A conexão não foi concluída: ${detalharFalha(falha)}`
                    : 'A conexão com o banco não foi concluída. Você pode tentar de novo.',
              )
              fechar()
            }}
            onClose={fechar}
          />
        </Suspense>
      ) : null}
    </div>
  )
}
