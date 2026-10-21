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

A primeira consulta autenticada em produção ainda precisa confirmar o token, suas permissões e a convenção de autenticação. O servidor usa `Authorization: Bearer <token>` por padrão. O SDL não documenta esse cabeçalho. Se a documentação oficial exigir o token sem prefixo, configure `MAXIPROD_AUTH_SCHEME=Raw` no servidor; não troque o formato por tentativa sem consultar a documentação. Tokens sem permissão para empresas, plano de contas, títulos e lançamentos contábeis não concluem a consulta.

Cadastrar variáveis ou publicar o código não comprova conexão com o Maxiprod. Nenhuma chave real é necessária para os testes automatizados. O ambiente de desenvolvimento não tem acesso às variáveis privadas do Netlify.

## Custos mensais

No painel conectado, clique na engrenagem de **Custos do mês** ou em **Configurações**. Selecione as contas contábeis de destino que representam Frete, Salários e Financiamento. Use Ctrl/Command para múltiplas seleções. Uma conta pertence a uma categoria por vez; a escolha remove sobreposições. As preferências guardam somente IDs de contas neste navegador, separadas por empresa. Valores, senhas e títulos reais não são armazenados no localStorage.

Categorias sem seleção mostram **Selecionar contas**, e não um custo zero. Os custos somam o valor líquido lançado por vencimento do mês atual, incluindo pagos e em aberto. Outras contas ficam fora das três categorias; o total é identificado como total das categorias configuradas.

## Saldo inicial e projeção

O esquema não contém um saldo bancário atual pronto para consulta. Sem referência de abertura, os cards mostram **A configurar**. O saldo fictício e as preferências da demonstração nunca entram nos cálculos reais.

Depois de validar a empresa e as contas de caixa/bancos, cadastre no Netlify a variável de servidor `MAXIPROD_OPENING_BALANCES`, no contexto Produção/Funções, usando JSON:

```json
{"123":{"date":"2026-10-01","cents":1234500}}
```

`123` é o ID da empresa, não o ID de uma conta. O exemplo é fictício. `cents` é o saldo consolidado **de todas as contas analíticas com finalidade CAIXA_BANCO** antes de qualquer movimento de `date`. O exemplo representa R$ 12.345,00 antes dos movimentos de 01/10/2026. Use a data e o saldo reais apurados no ERP; não copie o exemplo. É possível cadastrar várias empresas no mesmo JSON. A data não pode ser futura. Faça nova implantação após mudar a variável.

O saldo soma débitos e subtrai créditos dessas contas entre a abertura e hoje, excluindo lançamentos contábeis de encerramento. Transferências entre contas incluídas se anulam na consolidação. Isso representa saldo com base contábil e exige conciliação com os extratos. Não é uma consulta direta ao banco.

A projeção soma ao saldo atual os valores ainda em aberto a receber e subtrai os valores ainda em aberto a pagar, com vencimento até o fim do mês, incluindo atrasados. A projeção não garante a liquidação futura.

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
