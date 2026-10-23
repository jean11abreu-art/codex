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

## Funil de vendas

A aba Funil de vendas fica imediatamente após Roteiros. Oferece filtros por ano, mês, dia específico e representante; ranking por faturamento com desempates; exportação CSV; gráfico diário alternando atividades/faturamento; e gráfico mensal de faturamento no ano consultado. O gráfico mensal mantém o ano e o representante como contexto, mesmo ao filtrar um dia ou mês. O gráfico diário e o ranking acompanham o período selecionado.

Metas iniciais da equipe: 30 ligações/dia e R$ 200.000,00/mês. A aba permite editar as metas, guardadas localmente por empresa. Ao filtrar um representante, a comparação aplica a mesma meta a ele. A referência diária é o dia selecionado; sem dia, usa hoje no mês atual ou o último dia do mês histórico. A meta mensal considera o acumulado do mês de referência, sem restringi-lo ao filtro de dia. O avanço percentual pode exceder 100%, enquanto a barra visual fica limitada a 100%.

O endpoint protegido `GET /api/commercial-funnel?company=ID&start=AAAA-MM-DD&end=AAAA-MM-DD` é independente do resumo anterior. Todas as coleções usam consultas fixas, paginação consistente e prazo compartilhado de 24 segundos. Limite de 10 mil registros por coleção; um erro ou truncamento interrompe os totais do funil, sem fallback para dados demonstrativos.

- Ligações: cada comentário não vazio corresponde a uma ligação, conforme regra solicitada pelo usuário. A data é a criação do comentário, em America/Sao_Paulo. Na demonstração, a fonte é o histórico dos clientes; não usa as ligações sintéticas do gerador. Na integração preparada para a próxima etapa, a fonte são registros `ANOTACAO` de `tarefasOuAnotacoes`. Leads únicos são contados separadamente. Não há seleção de assunto, nem dependência de MAXIPROD_CALL_SUBJECT_ID.
- Resultado de contato: classificação conservadora por regras de texto em `src/call-outcomes.mjs`. Sinais claros de atendimento/retorno indicam sucesso; falta de atendimento/retorno indica sem sucesso; evidência ausente ou conflitante fica a avaliar. Sucesso não significa venda fechada. A classificação é uma sugestão, sem modelo de IA. No histórico demonstrativo, uma revisão manual prevalece sobre a sugestão, persiste no navegador e recalcula o funil e ranking.
- Propostas enviadas: propostas `EMITIDA` e `CONCLUIDA` pela emissão. O esquema não comprova o envio por e-mail; essa limitação aparece na aba. Rascunhos e canceladas ficam fora.
- Pedidos aprovados: `aprovacaoData` dos pedidos atualmente `APROVADO`, `FATURADO` ou `FATURADO_ENTREGA_FUTURA`. Não usa emissão do pedido como aproximação da aprovação.
- Pedidos faturados: pedidos distintos associados aos itens das notas `EMITIDA` com operação fiscal `FATURAMENTO`, pela emissão da NF. Várias notas parciais não duplicam o pedido dentro do mesmo período. As contagens diárias podem somar mais que a contagem mensal por representarem pedidos únicos em períodos diferentes.
- Faturamento: `valorTotal` dessas notas, incluindo frete e impostos. Notas sem pedido vinculado entram no valor, mas não na contagem de pedidos. Não deduz devoluções; validar cobertura fiscal com a contabilidade antes de usar para decisões.
- Representantes: propostas, pedidos e notas usam o primeiro representante do documento. Ligações usam a empresa representante vinculada ao autor do comentário no CRM; usuários sem vínculo ficam separados. Cadastros de CRM podem ser compartilhados entre empresas permitidas pela chave.

As etapas mostram eventos ocorridos no período, sem afirmar conversão de uma mesma coorte. Leads e pedidos são deduplicados no total geral e em cada representante; registros compartilhados podem aparecer em mais de uma linha, por isso o total não é a soma simples de contagens distintas.

Testes adicionais: `tests/funnel.test.mjs` e `npm run test:e2e -- funnel.spec.ts`. A API real depende da publicação e da sessão autenticada existente. A demonstração do funil é gerada separadamente e identificada como fictícia.

## Pacote portátil e publicação solicitada

O usuário pediu publicação na hospedagem do ChatGPT e adiou a conexão real por API. O build prepara `dist/premiumflex-comercial/index.html`, com CSS e JavaScript incorporados, identificação de demonstração e `data-api="disabled"`. Nessa variante, a interface de conexão à API não é exibida e não há consultas automáticas. Ela mantém a navegação, comentários locais, avaliação do resultado, funil, metas, gráficos, roteiros e CSV. O pacote usa dados fictícios de clientes e vendas; comentários e revisões permanecem no navegador e não são compartilhados entre usuários.

O ambiente atual não oferece ferramenta ou skill para publicar um site na hospedagem do ChatGPT. Um link de compartilhamento da conversa não é hospedagem do aplicativo. Nenhuma publicação alternativa foi feita sem autorização para o destino. O código de integração existente está preservado para a próxima etapa; as consultas comerciais reais não foram executadas nesta etapa.

## Ativação da API no site

A página publicada em `/comercial/` habilita Conectar Maxiprod. O pacote portátil continua sem API. O diagnóstico público confirmou configuração das credenciais no Netlify; a leitura real requer a senha existente, informada pelo usuário diretamente no site. O navegador não recebe a chave. O acesso é somente leitura. Configuração presente não comprova validade da chave nem permissões comerciais.
