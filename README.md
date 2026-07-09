# Controle Financeiro

Aplicação web para gestão de finanças pessoais: cadastro de receitas e despesas, definição de metas e acompanhamento visual por meio de gráficos interativos, com persistência de dados no navegador.

![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-06B6D4?style=for-the-badge&logo=tailwindcss&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)
![Chart.js](https://img.shields.io/badge/Chart.js-FF6384?style=for-the-badge&logo=chartdotjs&logoColor=white)

[![Demonstração online](https://img.shields.io/badge/demonstra%C3%A7%C3%A3o-online-2EA44F?style=for-the-badge)](https://otavio-2507.github.io/Controle_Financeiro/)

[![Prévia da aplicação](docs/preview.webp)](https://otavio-2507.github.io/Controle_Financeiro/)

## Visão geral

O Controle Financeiro centraliza a rotina de organização financeira pessoal em uma única tela: o usuário registra transações, categoriza cada movimentação e acompanha a evolução de receitas, despesas e metas em gráficos atualizados em tempo real. Todos os dados ficam armazenados localmente no navegador, sem necessidade de servidor ou cadastro.

## Funcionalidades

- Cadastro de transações de receita e despesa com descrição, valor, data e categoria
- Definição e acompanhamento de metas financeiras
- Gráficos interativos comparando receitas e despesas por período e categoria
- Resumo consolidado de saldo, entradas e saídas
- Persistência de dados via LocalStorage, mantendo o histórico entre sessões
- Interface responsiva, adaptada a desktop e dispositivos móveis

## Tecnologias

| Tecnologia | Aplicação no projeto |
| --- | --- |
| HTML5 | Estrutura semântica da aplicação |
| Tailwind CSS (CDN) | Estilização utilitária e layout responsivo |
| JavaScript (ES6+) | Lógica de transações, metas, cálculos e renderização |
| Chart.js | Gráficos interativos de receitas e despesas |
| Lucide Icons | Iconografia da interface |
| LocalStorage | Persistência local dos dados do usuário |

## Como executar

```bash
git clone https://github.com/OTAVIO-2507/Controle_Financeiro.git
cd Controle_Financeiro
```

Abra o arquivo `index.html` no navegador. Não há etapa de build: todas as dependências são carregadas via CDN.

## Estrutura do projeto

```
Controle_Financeiro/
├── index.html          Página única da aplicação
├── src/
│   ├── app.js          Lógica de transações, metas e gráficos
│   └── style.css       Estilos complementares ao Tailwind
└── docs/
    └── preview.webp    Imagem de prévia do README
```

## Autor

**Otávio Oliveira** — Desenvolvedor Full Stack

[GitHub](https://github.com/OTAVIO-2507) · [Portfólio](https://otavio-2507.github.io/Portifolio-v2/) · [E-mail](mailto:56otavio@gmail.com)
