import type { TextosDoTour, TourStep } from './tourSteps'

/**
 * O roteiro do tour de administração.
 *
 * Mesma forma do roteiro do usuário (`tourSteps.ts`) e mesma ordem de leitura:
 * segue a barra lateral de cima para baixo, e termina nos controles do topo.
 * Quem percorre já passou o olho por todos os destinos, e nenhum vira surpresa
 * depois.
 *
 * O conteúdo, porém, é outro produto. O tour do usuário ensina a lançar um
 * gasto; este ensina a cuidar de contas alheias, e o que ele mais precisa
 * deixar claro é o limite: um administrador governa acesso, não dinheiro. Por
 * isso a fronteira aparece já na primeira parada, e não como observação no
 * fim.
 */
export const ADMIN_TOUR_TEXTOS: TextosDoTour = {
  // Sem cartão: aqui o nome vive na saudação e no menu de conta.
  dicaDoNome: 'Aparece na saudação do painel e no seu menu de conta.',
  fecho: 'Nenhuma conta existe até você criar a primeira. Comece por Usuários, e o resto do painel passa a ter o que mostrar.',
  botaoFinal: 'Ir para o painel',
}

export const ADMIN_TOUR_STEPS: readonly TourStep[] = [
  {
    targets: ['admin-nav-painel'],
    icon: 'layout-dashboard',
    title: 'O retrato da plataforma',
    body: 'Quantas contas existem, quantas andaram sendo usadas e quais nunca chegaram a entrar. Tudo sobre acesso: nenhum lançamento, saldo ou meta de ninguém passa por aqui.',
  },
  {
    targets: ['admin-nav-usuarios'],
    icon: 'users',
    title: 'Onde as contas nascem e morrem',
    body: 'Criar, convidar por link, redefinir senha, desativar e excluir. Clique numa linha da tabela para abrir a ficha, que é onde todas as ações moram.',
  },
  {
    targets: ['admin-nav-relatorios'],
    icon: 'chart-column',
    title: 'Como a plataforma chegou até aqui',
    body: 'Ritmo de entrada mês a mês, total acumulado, composição das contas e o histórico de administração em calendário. Daqui também sai o CSV das contas.',
  },
  {
    targets: ['admin-nav-auditoria'],
    icon: 'list-filter',
    title: 'Tudo que você fizer fica registrado',
    body: 'Cada ação de administração entra aqui com autor, alvo e hora, e não há como editar nem apagar. Poder sem rastro transforma um erro honesto numa discussão sem resposta.',
  },
  {
    targets: ['admin-nav-ajustes'],
    icon: 'settings',
    title: 'Suas preferências, deste dispositivo',
    body: 'Tema, perfil, senha e a verificação em duas etapas. Aparência e nome ficam neste navegador, porque uma sessão de administração não abre documento de conta nenhuma.',
  },
  {
    targets: ['admin-profile'],
    icon: 'user',
    title: 'E aqui você sai',
    body: 'O menu do seu avatar guarda a edição de perfil e a saída. Uma conta de administração nunca abre o app financeiro, nem o seu próprio: para isso existe uma segunda conta.',
  },
]
