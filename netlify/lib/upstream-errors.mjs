import { PublicError } from './http.mjs';

const steps = {
  companies: 'cadastro de empresas', accounts: 'plano de contas',
  payable: 'contas a pagar', receivable: 'contas a receber', cash: 'movimentos de caixa/bancos',
};
const codesFor = errors => errors.map(error => typeof error?.extensions?.code === 'string' ? error.extensions.code : '');

export function graphqlFailure(name, errors) {
  const codes = codesFor(errors);
  let kind = 'EXECUTION';
  let message = 'O Maxiprod não informou a causa da falha. Confira se o token foi gerado em “Gerar token de acesso à API GraphQL”, se continua válido e se esse acesso funciona no explorador da API.';
  if (codes.some(code => ['AUTH_NOT_AUTHENTICATED', 'UNAUTHENTICATED', 'TOKEN_EXPIRED', 'INVALID_TOKEN'].includes(code))) {
    kind = 'AUTH'; message = 'O Maxiprod não autenticou o token. Confira o token GraphQL salvo no Netlify e sua validade.';
  } else if (codes.some(code => ['AUTH_NOT_AUTHORIZED', 'FORBIDDEN', 'AUTHORIZATION_FAILED'].includes(code))) {
    kind = 'PERMISSION'; message = 'O Maxiprod informou falta de permissão para esta consulta. Confira o perfil de acesso do usuário que gerou o token.';
  } else if (codes.some(code => ['COST_EXCEEDED', 'MAX_COMPLEXITY_EXCEEDED'].includes(code))
    || errors.some(error => /(?:cost|complexity).*(?:exceed|limit)|(?:exceed|limit).*(?:cost|complexity)/i.test(error?.message || ''))) {
    kind = 'LIMIT'; message = 'O Maxiprod recusou a consulta por limite de complexidade. A consulta precisa ser ajustada.';
  } else if (codes.some(code => ['GRAPHQL_VALIDATION_FAILED', 'GRAPHQL_PARSE_FAILED'].includes(code))
    || errors.some(error => /does not exist on (?:the )?type|unknown (?:argument|field|type)|cannot query field|is not defined by type|syntax error/i.test(error?.message || ''))) {
    kind = 'QUERY'; message = 'A consulta não corresponde ao esquema disponível no Maxiprod. A integração precisa ser ajustada.';
  }
  // Only local labels leave the server. Never forward upstream text, paths,
  // arbitrary extension values, exception details, or credential fragments.
  const operation = Object.hasOwn(steps, name) ? name : 'unknown';
  const reference = `MP-${operation.toUpperCase()}-${kind}`;
  return new PublicError(502, `UPSTREAM_${kind}`, `Falha na consulta de ${steps[name] || 'dados'}. ${message} Referência: ${reference}.`);
}

export function authorization(env, now = Date.now()) {
  let token = env.MAXIPROD_API_KEY?.trim();
  if (!token) throw new PublicError(503, 'KEY_MISSING', 'Configure MAXIPROD_API_KEY no Netlify.');
  const scheme = env.MAXIPROD_AUTH_SCHEME || 'Bearer';
  if (!['Bearer', 'Raw'].includes(scheme)) throw new PublicError(503, 'AUTH_CONFIG', 'MAXIPROD_AUTH_SCHEME deve ser Bearer ou Raw, conforme a documentação do Maxiprod.');
  if (scheme === 'Bearer') token = token.replace(/^Bearer\s+/i, '').trim();
  if (!token || /\s|["']|^MAXIPROD_API_KEY=/i.test(token)) {
    throw new PublicError(503, 'TOKEN_FORMAT', 'Revise o valor de Produção de MAXIPROD_API_KEY: cole somente o token, sem aspas, quebras de linha ou o nome da variável.');
  }
  if (/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    let payload;
    try { payload = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8')); } catch { /* Opaque tokens remain validated by Maxiprod. */ }
    // This is only an early rejection of an expired JWT, not signature validation
    // or authorization. Maxiprod remains responsible for verifying the token.
    if (typeof payload?.exp === 'number' && Number.isFinite(payload.exp) && payload.exp <= Math.floor(now / 1000)) {
      throw new PublicError(503, 'TOKEN_EXPIRED', 'O token salvo em MAXIPROD_API_KEY está vencido. Gere outro em “Gerar token de acesso à API GraphQL”, atualize o valor de Produção no Netlify e publique novamente.');
    }
  }
  return scheme === 'Raw' ? token : `Bearer ${token}`;
}
