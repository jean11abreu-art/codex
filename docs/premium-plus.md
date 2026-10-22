# Premium Plus — Montagem de mangueiras

A página inicial abre as ordens de montagem. O painel financeiro anterior continua em `/financeiro`.

## Executar

Requer Node.js 22.12+ e Chromium para os testes de navegador.

```sh
cd /workspace/codex
npm ci --cache /tmp/codex-npm-cache --no-audit --no-fund
npm run dev -- --port 5173
```

Validação: `npm test`, `npm run build` e `npm run test:e2e -- hoses.spec.ts`.
Os demais testes de navegador foram escritos para o painel financeiro anterior.

## Usar

Preencha cliente e dados da montagem. A ordem começa com dez linhas e permite acrescentar mais. Salvar atribui um número sequencial; abrir uma ordem salva permite alterá-la mantendo seu número. O contador considera ordens salvas no navegador atual. Exporte as ordens em JSON para manter uma cópia externa.

Os dados ficam no armazenamento local deste navegador e desta origem, sem servidor de sincronização. Limpar os dados do navegador remove ordens, catálogos e logotipo. A exportação é uma cópia dos dados; esta versão não tem restauração por JSON.

Importe mangueiras e terminais em arquivos CSV UTF-8 separados, sem cabeçalho e com uma descrição completa por linha. Para várias colunas, combine código, norma e descrição em uma coluna antes de exportar. Os seletores oferecem pesquisas independentes e também permitem digitação livre. As planilhas recebidas em 22/10/2026 estão incorporadas em `src/catalogs/premium-plus.json`: 36 mangueiras, 386 terminais (código e descrição, excluindo cabeçalho) e 22 capas. Catálogos CSV locais substituem apenas a categoria importada. Catálogos vazios de versões anteriores recebem os dados padrão sem alterar ordens existentes. Os arquivos Excel são fontes de dados, não instruções executáveis.

O logotipo vetorial Premium Flex existente em `src/Brand.tsx` é usado por padrão no menu e na ordem impressa, conforme solicitado. O campo PNG/JPG (até 1 MB) permite substituir o logotipo da ordem neste navegador. A bandeira brasileira fica no canto superior direito.

Imprimir A4 abre a impressão do navegador. Dez linhas usam a máscara padrão; ordens maiores podem continuar em outras páginas. Revise a prévia e desative cabeçalhos/rodapés do navegador se necessário.

O build atualiza os HTMLs portáteis já existentes no projeto. Não publica o site automaticamente.

## Posição e relatório

Cada linha permite selecionar 0º, 90º, 180º ou 270º. Ordens antigas não recebem uma posição presumida. O relatório da ordem atual inclui alterações ainda não salvas e agrupa pelo CJ, capa, mangueira/norma, terminal A, terminal B, comprimento e posição, somando quantidades inteiras positivas. Espaços e diferenças entre maiúsculas/minúsculas não criam grupos separados.

O resumo de materiais soma duas capas e um terminal de cada lado por conjunto. Se A e B forem iguais, suas quantidades são somadas. Mangueiras são totalizadas em metros pelo comprimento em milímetros × quantidade, sem perdas. Linhas sem comprimento válido geram aviso de total incompleto. O relatório é impresso após a ordem, em uma nova página A4.
