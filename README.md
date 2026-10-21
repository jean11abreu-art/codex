# Premium Flex — Painel Financeiro

Dashboard em português com contas a pagar/receber, consultas por vencimento, boletos, custos mensais, indicadores diários e projeção. Site: https://legendary-manatee-800de4.netlify.app/.

A demonstração é pública e usa dados fictícios. **Acessar dados reais** abre a sessão protegida. Falhas na API mostram erro e nunca são substituídas por dados fictícios. O esquema fornecido está em `docs/maxiprod/schema.graphql`; as cinco operações fixas são validadas contra ele nos testes.

## Ativar no Netlify

Use o projeto existente, vinculado a `jean11abreu-art/codex`, branch `main`. O `netlify.toml` configura Node.js 24, `npm run build`, publicação em `premium-flex-site` e funções em `netlify/functions`.

1. Em **Configuração do projeto → Variáveis do ambiente**, mantenha `MAXIPROD_API_KEY` como segredo no contexto **Produção**, disponível para **Funções**. Seu valor é o token do Maxiprod.
2. Crie **DASHBOARD_PASSWORD**, também como segredo de Produção/Funções. Use uma senha exclusiva gerada por um gerenciador, com pelo menos **20 caracteres** e no máximo 256. Essa senha é diferente da chave da API. Não compartilhe nenhum dos valores no chat ou no GitHub.
3. Em **Implantações**, faça uma nova implantação da branch `main` após alterar as variáveis.
4. No site, clique em **Acessar dados reais**, entre com a senha e selecione a empresa, se houver mais de uma.
5. Confira um período conhecido com os relatórios do Maxiprod, inclusive títulos parcialmente liquidados, antes de usar os totais para decisões.

O diagnóstico autenticado em produção confirmou que a consulta mínima de empresas funciona com **`Authorization: <token>`**, sem prefixo, e falha com `Bearer`. Esse formato (`Raw`) é o padrão do servidor; não é necessário criar `MAXIPROD_AUTH_SCHEME` no Netlify. A variável opcional ainda permite uma configuração explícita quando necessária. A documentação Swagger da API REST descreve Bearer, mas o diagnóstico confirmou outro formato para este acesso GraphQL. As consultas financeiras completas e as permissões de plano de contas, títulos e lançamentos contábeis ainda precisam ser validadas no painel.

Cadastrar variáveis ou publicar o código não comprova conexão com o Maxiprod. Nenhuma chave real é necessária para os testes automatizados. O ambiente de desenvolvimento não tem acesso às variáveis privadas do Netlify.

O servidor remove espaços nas extremidades e um prefixo `Bearer` eventualmente colado junto ao token, aplicando depois o formato de autenticação selecionado. Valores com aspas, quebras de linha ou `MAXIPROD_API_KEY=` são recusados com orientação para corrigir o campo de Produção. Se um token no formato JWT informar validade expirada, a consulta é interrompida sem expor suas informações; isso não substitui a validação da assinatura pelo Maxiprod.

Erros da consulta identificam a etapa com uma referência como `MP-COMPANIES-EXECUTION`. Autenticação, permissão e validação/complexidade são diferenciadas quando há evidência na resposta. A mensagem genérica `Unexpected Execution Error` do Maxiprod não prova falta de permissão: nesse caso o painel informa que a causa não foi fornecida. Textos brutos, caminhos, dados e extensões arbitrárias da resposta externa não são repassados ao navegador nem aos logs.

Na tela de erro, **Verificar conexão** executa um diagnóstico autenticado por `/api/connection-check` (POST, mesma origem). Testa a consulta básica, a consulta mínima de empresas e, se necessário, os formatos Bearer e Raw usando a mesma chave e o mesmo servidor HTTPS. Os testes são de leitura e não alteram variáveis ou permissões. Quando a consulta mínima funciona, verifica filtro, ordenação, paginação/contagem e tamanho de página separadamente. O relatório contém apenas rótulos locais e resultados, sem registros, nomes, IDs, token, dados do JWT ou respostas brutas. Cada execução faz no máximo seis consultas e tem prazo compartilhado de 20 segundos. Se ambos os formatos forem recusados sem explicação, o diagnóstico é inconclusivo: não comprova token inválido ou permissão negada. É preciso conferir a aplicação da variável após nova implantação e validar o acesso no explorador oficial ou com o suporte do Maxiprod.

## Configurações financeiras compartilhadas

No painel conectado, clique em **Configurações**, na engrenagem de **Custos do mês** ou em **Configurar saldo**. A tela permite selecionar contas e informar o saldo real sem editar variáveis no Netlify. Os campos não são preenchidos com valores fictícios.

As configurações são guardadas por empresa no armazenamento privado **Netlify Blobs**, em um store nomeado que persiste entre deploys. O contexto de acesso é fornecido automaticamente pelo Netlify às funções v2; não é necessário cadastrar outro token. Somente o servidor usa o SDK `@netlify/blobs`.

`GET /api/settings` e `PUT /api/settings` exigem sessão. A gravação também exige a mesma origem, valida o tamanho/campos do JSON, confirma a empresa disponível para o token e verifica os IDs no plano de contas. Valores são salvos em centavos, sem token nem senha. Leituras usam consistência forte; gravações condicionais usam a versão/ETag para impedir sobrescrita quando duas pessoas editam simultaneamente. Um conflito exige recarregar o formulário. Não há gravações no Maxiprod.

Se o armazenamento estiver indisponível, a consulta de títulos continua funcionando. Saldo, projeção e categorias ficam sem configuração disponível e um aviso explica a falha; não são substituídos por saldos fictícios, valores antigos de outra origem ou zeros. A tela de configurações também pode ser aberta a partir de um erro de consulta, permitindo corrigir a referência de saldo.

### Custos mensais

Use a busca por nome/código e marque as contas de destino de **Frete**, **Salários** e **Bancos/Financiamentos**. Uma conta pertence a uma categoria por vez; selecionar em outra remove a atribuição anterior. Revise e clique em **Salvar configurações**. O servidor aceita até 100 contas por categoria e recusa contas que não estejam disponíveis.

Seleções antigas deste navegador, quando existirem, são importadas somente para revisão no formulário. Elas só passam a valer como configuração compartilhada após salvar. Valores financeiros reais não são armazenados no localStorage.

Categorias sem seleção mostram **Selecionar contas**, e não custo zero. Os custos somam o valor líquido lançado por vencimento do mês atual, incluindo pagos e em aberto. Outras contas ficam fora das três categorias; o total é identificado como total das categorias configuradas.

### Saldo inicial e projeção

Ative **Usar saldo inicial real**, escolha a data de referência e informe o saldo consolidado **de todas as contas analíticas com finalidade CAIXA_BANCO antes de qualquer movimento daquela data**. Para iniciar hoje, use o saldo de encerramento de ontem. O formulário aceita reais no padrão brasileiro (`1.234,56`), zero e valores negativos; a data não pode ser futura. O limite é R$ 1 bilhão, positivo ou negativo. Salve para recalcular os indicadores com os movimentos do Maxiprod.

O esquema não contém um saldo bancário atual pronto para consulta. Sem referência, os cards mostram **A configurar**. O saldo fictício e as preferências da demonstração nunca entram nos cálculos reais.

O saldo soma débitos e subtrai créditos das contas de caixa/bancos entre a abertura e hoje, excluindo lançamentos de encerramento. Transferências entre contas incluídas se anulam na consolidação. Isso representa saldo com base contábil e exige conciliação com os extratos; não é uma consulta direta ao banco.

A projeção soma ao saldo atual os valores ainda em aberto a receber e subtrai os valores ainda em aberto a pagar, com vencimento até o fim do mês, incluindo atrasados. Ela não garante a liquidação futura.

Por compatibilidade, a antiga variável `MAXIPROD_OPENING_BALANCES` pode fornecer a referência antes do primeiro salvamento no painel. O valor salvo na tela tem precedência; desativar o saldo e salvar mantém os cards sem referência, mesmo que a variável antiga exista. Alterar as configurações pela tela não exige nova implantação.

## Regras e cobertura

- Dia e mês de referência dos dados reais seguem `America/Sao_Paulo`; os filtros controlam o gráfico, cards de títulos, tabela e CSV. Os indicadores diários e custos mensais permanecem no dia/mês atual.
- Contas consultadas: estados `EMITIDO` e `PAGO`/`RECEBIDO`, tipos `TITULO`, `DESPESA`/`RECEITA` e `ADIANTAMENTO`. Excluem-se pedidos, cotações/propostas, retenções separadas e registros cancelados, em digitação, agrupados, parcelados ou compensados. As parcelas finais emitidas entram; seus títulos de origem parcelados ficam fora. Valide essa cobertura com os relatórios usados pela empresa, especialmente adiantamentos e retenções.
- Títulos têm uma linha cada. O valor líquido lançado, o valor líquido já pago/recebido e o saldo restante são preservados separadamente. Pagamentos parciais mostram **Parcial**; os cards em aberto e a projeção usam somente o restante. O CSV conectado inclui as três colunas monetárias.
- Recebimentos/pagamentos do dia usam os movimentos das contas de caixa/bancos vinculados a títulos a receber/pagar. Incluem liquidações parciais naquela data e estornos com sinal inverso. Transferências e movimentos sem vínculo ficam fora desses dois indicadores; esses indicadores não representam todos os movimentos bancários.
- Boletos são identificados por `BOLETO_COM_REGISTRO`/`BOLETO_SEM_REGISTRO` na forma de cobrança. O painel não emite nem baixa boletos.
- Consultas usam `skip`/`take` com ordem estável por ID e verificam páginas/contagens. Limite de 10 mil registros por coleção, 366 dias por filtro e prazo de 24 segundos compartilhado. Em caso de truncamento, paginação inconsistente ou erro GraphQL, não se exibem totais parciais. A API não oferece snapshot transacional nesta implementação: alterações que não mudem as contagens podem exigir nova consulta e conciliação.
- Valores são convertidos de Decimal para centavos inteiros com validação de limites. Nenhuma mutação é enviada ao Maxiprod.

## Acesso e segredos

`/api/session` cria um cookie assinado, `HttpOnly`, `Secure`, `SameSite=Strict`, com validade de oito horas. POST/DELETE exigem a mesma origem. `/api/finance` verifica a sessão antes de qualquer consulta. Respostas privadas usam `no-store`; não há cache de registros financeiros nem proxy GraphQL arbitrário. Erros públicos e logs não contêm o token nem respostas financeiras brutas.

O código configura limites de requisições por IP/domínio no Netlify e mantém um bloqueio adicional por instância após cinco tentativas de login em um minuto. O bloqueio em memória é auxiliar. Use uma senha longa e aleatória; proteção por contas individuais, MFA e auditoria exige um provedor de identidade próprio. Este é um acesso compartilhado para a equipe, sem perfis de usuário. Trocar a senha ou o token invalida as sessões existentes; sair apaga o cookie deste navegador.

Nunca use variáveis `VITE_*` para segredos. Não coloque credenciais no código, nos arquivos HTML, no localStorage ou em arquivos versionados. Não há usuário, senha ou token reais no repositório.

## Desenvolvimento e testes

```sh
cd /workspace/codex
npm ci --cache /tmp/codex-npm-cache --no-audit --no-fund
npm test
npm run build
npm run test:e2e
NEXO_STANDALONE_TEST=1 npm run test:e2e -- dashboard.spec.ts connection.spec.ts
npm run dev -- --port 5173
```

Requer Node.js 22.12 ou superior; validado com Node.js 24.19. Os testes Playwright usam `/usr/bin/chromium` ou `CHROMIUM_PATH`. Use o checkout existente, sem worktree adicional. A prévia Vite exibe a demonstração; as funções rodam no Netlify. Os testes de navegador interceptam a API com respostas fictícias, e os testes do servidor usam fetch simulado. Isso não substitui a validação autenticada em produção.

## Publicação e arquivos portáteis

O build gera a aplicação em `dist/`, além dos HTMLs autocontidos `index.html`, `painel.html` e `premium-flex-site/index.html`. O HTML inicial renderizado durante o build contém somente a demonstração. A conexão protegida requer a hospedagem HTTPS com as funções publicadas; não funciona abrindo o HTML como arquivo local.

`painel-estatico.html` é uma prévia sem interação. Edite `app.html` e `src/`, e execute o build; não edite manualmente os HTMLs gerados. O cache de SSR é separado do servidor Vite.

O pacote `premium-flex-publicacao.zip` contém a demonstração portátil e instruções. **Netlify Drop publica somente os arquivos estáticos**: para a API, publique o repositório completo pelo vínculo Git existente. O build local não faz deploy por conta própria. O GitHub está ligado ao site público existente; um push na `main` solicita nova publicação ao Netlify.
