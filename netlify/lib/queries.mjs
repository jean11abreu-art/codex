const page = 'pageInfo { hasNextPage } totalCount';
const account = 'id codigoEstruturado descricao';
const title = `id minhaEmpresaId estado tipo valorLiquido vencimentoData liquidacaoData referenteA
  conta { ${account} } contaDeDestino { ${account} }
  formaDeCobranca { meioDePagamento }`;

export const queries = {
  companies: `query DashboardCompanies($skip: Int!, $take: Int!) {
    empresas(skip: $skip, take: $take, where: {minhaEmpresa: {eq: true}}, order: [{id: ASC}]) {
      ${page} items { id apelido }
    }
  }`,
  accounts: `query DashboardAccounts($skip: Int!, $take: Int!) {
    contasContabeis(skip: $skip, take: $take, where: {analiticaOuSintetica: {eq: ANALITICA}}, order: [{id: ASC}]) {
      ${page} items { ${account} finalidade }
    }
  }`,
  payable: `query DashboardPayable($skip: Int!, $take: Int!, $where: ContaPagarFilterInput!) {
    contaAPagar(skip: $skip, take: $take, where: $where, order: [{id: ASC}]) {
      ${page} items { ${title} valorPagoLiquido valorAPagar fornecedor { apelido }
        descricaoTituloContaPagar { descricaoTitulo } }
    }
  }`,
  receivable: `query DashboardReceivable($skip: Int!, $take: Int!, $where: ContaReceberFilterInput!) {
    contaAReceber(skip: $skip, take: $take, where: $where, order: [{id: ASC}]) {
      ${page} items { ${title} valorRecebidoLiquido valorAReceber cliente { apelido }
        descricaoTituloContaReceber { descricaoTitulo } }
    }
  }`,
  cash: `query DashboardCash($skip: Int!, $take: Int!, $where: LancamentoContabilFilterInput!) {
    lancamentosContabeis(skip: $skip, take: $take, where: $where, order: [{id: ASC}]) {
      ${page} items { id data valor debitoOuCredito contaAReceber { id } contaAPagar { id } }
    }
  }`,
};

export const roots = { companies: 'empresas', accounts: 'contasContabeis', payable: 'contaAPagar', receivable: 'contaAReceber', cash: 'lancamentosContabeis' };
