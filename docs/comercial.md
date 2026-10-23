# Premiumflex — Inteligência comercial

Novo painel em `/comercial/`, baseado na referência visual fornecida. A página inicial de montagem continua na raiz, e o financeiro em `/financeiro`.

## Executar e verificar

No checkout existente `/workspace/codex`, execute `npm ci --cache /tmp/codex-npm-cache --no-audit --no-fund` e `npm run dev -- --port 5173`. Não é necessário outro worktree.

Valide com `npm run build`, `npm test` e `npm run test:e2e -- commercial.spec.ts hoses.spec.ts`. O build gera `premium-flex-site/comercial/index.html` e `dist/comercial.html`, com HTML, CSS e JavaScript incorporados. O arquivo gerado funciona como demonstração ao ser servido como HTML. A integração requer as funções Netlify, HTTPS e mesma origem.

A demonstração tem oito clientes fictícios, filtros, busca, cadastro de comentários, exportação CSV, curva ABC e roteiros ordenáveis. Os comentários e roteiros da demonstração são salvos no localStorage. A classificação usa regras locais, sem modelo de IA.

## API Maxiprod

`Conectar Maxiprod` usa a autenticação existente em `/api/session`, com cookie HttpOnly/Secure e senha `DASHBOARD_PASSWORD`. A chave `MAXIPROD_API_KEY` fica somente no servidor. O diagnóstico público de configuração do site existente informa que a autenticação já está configurada, mas isso não confirma permissões comerciais nem consultas bem-sucedidas.

`GET /api/commercial?start=AAAA-MM-DD&end=AAAA-MM-DD&company=ID` exige sessão. Consulta apenas operações GraphQL fixas em `https://api.maxiprod.com.br/graphql/`. Não aceita URL, consulta, token ou mutação do navegador. Não registra dados ou respostas externas nos logs. Respostas privadas usam `no-store`.

A seleção de empresa é validada na lista de minhas empresas disponibilizada pela API. Propostas e pedidos filtram por empresa e emissão no período de até 366 dias. Todas as coleções usam paginação ordenada por ID, limite de 10 mil registros, contagens consistentes e um prazo compartilhado de 24 segundos. Falhas e truncamentos impedem a exibição de totais parciais. A API não garante snapshot transacional: alterações que mantenham a contagem podem exigir nova consulta e conciliação.

- Orçamentos em aberto: propostas com estado `EMITIDA`, somando `valorTotal`.
- Faturado: soma de `valorFaturado` dos pedidos `APROVADO`, `FATURADO` e `FATURADO_ENTREGA_FUTURA` emitidos no período, incluindo faturamento parcial. A contagem é de pedidos com valor faturado, não de notas fiscais. Não representa faturamento filtrado pela data de emissão da NF.
- Clientes ativos e inativos: situação cadastral `ativo` do cliente, não atividade de compra.
- Comentários: descrições das tarefas/anotações vinculadas à empresa cliente, pela data de criação no período. Não são inferidos de observações de pedidos.
- Última interação: maior data entre ligação, visita e anotações disponíveis. Sem evidência, mostra Não informada.
- Cadastros e CRM podem ser compartilhados entre as empresas permitidas pela chave; o painel informa essa limitação.
- Curva ABC: faturamento dos pedidos consultados, em ordem decrescente; inclui na classe A o cliente que faz o acumulado atingir 80%, e na classe B o que faz atingir 95%.
- Temperatura: cliente cadastralmente ativo, interação em até 14 dias e proposta aberta → quente; sem interação, inativo ou mais de 60 dias → frio; demais → morno.

No modo conectado, o cliente e os valores reais ficam somente em memória. Não são gravados no localStorage, nem misturados com a demonstração. Comentários são somente leitura; roteiros duram a sessão. Falhas de atualização são exibidas e não acionam retorno automático à demonstração.

O novo endpoint foi validado contra o esquema GraphQL fornecido e por testes com respostas simuladas. A validação autenticada real depende da publicação das funções e do acesso do usuário pela senha existente. Não pedir a chave no chat. Esta implementação não foi publicada automaticamente.
