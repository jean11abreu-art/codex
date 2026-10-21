# Premium Flex — Painel Financeiro

Painel financeiro em português, responsivo, com visão consolidada em uma única página. Construído com React, TypeScript e Vite.

**Esta versão utiliza exclusivamente dados fictícios. A API do Maxiprod ainda não está conectada.** Não há autenticação de usuários nesta versão de demonstração.

## Baixar e publicar pela Netlify

1. No GitHub, use **Code → Download ZIP** e extraia o arquivo no seu computador.
2. Dentro da pasta extraída, localize **premium-flex-site**. Ela contém o `index.html` pronto para hospedagem.
3. Entre na sua conta em [Netlify Drop](https://app.netlify.com/drop).
4. Arraste a pasta **premium-flex-site inteira** para a área de envio.
5. Aguarde a publicação e abra o endereço HTTPS terminado em `.netlify.app` gerado pela Netlify.

Também é possível baixar somente [o pacote de publicação](premium-flex-publicacao.zip) pelo GitHub. Ele contém a pasta pronta e as instruções.

Depois de alterar o aplicativo, `npm run build` atualiza a pasta `premium-flex-site`. O ZIP é uma cópia da versão preparada para esta entrega. Publicar esses arquivos no GitHub disponibiliza o download; a hospedagem pública do painel ocorre após o envio à Netlify.

## Desenvolvimento

Requer Node.js 22.12 ou superior (validado com Node.js 24.19).

```sh
cd /workspace/codex
npm ci --cache /tmp/codex-npm-cache --no-audit --no-fund
npm run dev -- --port 5173
```

Use o checkout existente. Cada tarefa na nuvem já tem um ambiente isolado; não crie um worktree adicional para iniciar este projeto.

## Funcionalidades

- Consulta diária, mensal, anual e por datas inicial e final.
- Saldo bancário atual, recebimentos e pagamentos liquidados no dia.
- Projeção de saldo no fim do mês, positiva ou negativa.
- Gráfico de entradas e saídas por vencimento e resultado acumulado do período.
- Custos mensais de frete, salários e bancos/financiamentos.
- Valores em aberto e totais lançados de contas a pagar e a receber.
- Boletos e cobranças lançados, com identificação de títulos em aberto.
- Movimentações com busca, filtros por situação, abas, paginação e CSV.
- Saldo inicial de demonstração configurável e salvo no navegador.

Os indicadores do dia, a projeção e os custos do mês se referem ao dia/mês atual. O filtro de datas controla o gráfico, os cards de contas/boletos, a tabela e a exportação. Os custos incluem os títulos pagos e em aberto do mês.

## Regras financeiras

Valores são calculados em centavos inteiros e apresentados em reais. O saldo bancário soma ao saldo inicial as entradas efetivamente liquidadas e subtrai as saídas liquidadas até hoje. A projeção soma ao saldo atual todos os recebimentos em aberto e subtrai todos os pagamentos em aberto com vencimento até o fim do mês, inclusive atrasados. A projeção não garante que os títulos sejam pagos ou recebidos.

Os dados de demonstração cobrem o ano atual. Períodos sem lançamentos mostram estado vazio. A data é determinada no fuso horário do navegador. A atualização recarrega apenas a indicação de horário da demonstração; não simula conexão externa.

## Integração Maxiprod

Pendente de documentação e credencial. O contrato de lançamento normalizado está em `src/data.ts` (`Entry`); os cálculos independentes da origem estão em `src/finance.mjs`.

Antes de integrar, confirmar na documentação os endpoints, autenticação, paginação, limites, formatos monetários, contas bancárias e distinção entre vencimento e liquidação. Também é necessário obter os saldos iniciais reais. Não há endpoints ou requisições inventadas nesta versão.

A credencial deverá ser configurada como segredo do ambiente e usada exclusivamente em um backend. Não cadastrar chaves em variáveis `VITE_*`, no código do navegador, no localStorage ou em arquivos versionados. A versão com dados reais precisará de autenticação e controle de acesso antes da exposição pública.

## Validação

```sh
npm test
npm run build
npm run test:e2e
npm run test:e2e:portable
```

Os testes de navegador usam Chromium do sistema em `/usr/bin/chromium`. Para outro executável, configure `CHROMIUM_PATH`. O Playwright inicia e encerra seu servidor de testes automaticamente quando necessário. Os testes exercitam períodos, validação de datas, estados vazios, busca, paginação, CSV, saldo inicial persistente, projeção negativa, navegação móvel abertura do HTML autocontido sem servidor e em iframe isolado e exibição estática sem JavaScript. A suíte `test:e2e:portable` repete as verificações funcionais da aplicação no HTML portátil, incluindo exportação e persistência.

## Produção e publicação

```sh
npm run build
npm run preview -- --port 4173
```

O build estático fica em `dist/`. O comando gera uma aplicação React em `dist/app.html` e uma prévia leve e autocontida em `index.html`, `painel.html` e `dist/index.html`. Para visualizadores que recusem scripts, `painel-estatico.html` oferece uma versão explicitamente estática, com controles desabilitados e aviso de modo visual. A prévia usa fontes do sistema e um runtime Preact compatível com o mesmo código de componentes, sem fontes em base64 nem dependências externas para renderizar. Seu conteúdo inicial é renderizado durante o build: mesmo sem executar JavaScript, o painel e a tabela aparecem. Nesse modo estático, os números correspondem à data do último build e os filtros precisam de JavaScript para funcionar. Com JavaScript, os dados de demonstração são recalculados no navegador. O gerador usa cache separado para não interferir no servidor de desenvolvimento. A entrada de desenvolvimento fica em `app.html`; edite esse arquivo e `src/`, depois execute `npm run build` para atualizar a prévia. Não edite manualmente os arquivos HTML gerados. A publicação requer um serviço de hospedagem de arquivos estáticos. O servidor de preview serve para verificar o build e não substitui uma hospedagem pública de produção.

Nenhum deploy foi feito. Não há ferramenta de publicação no ChatGPT Sites disponível nesta sessão. A criação do painel e o build não geram um endereço público automaticamente.
