export class PublicError extends Error {
  constructor(status, code, message) { super(message); this.status = status; this.code = code; }
}

export function json(body, status = 200, extra = {}) {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'Netlify-CDN-Cache-Control': 'no-store',
    'Pragma': 'no-cache',
    'Vary': 'Cookie',
    'X-Content-Type-Options': 'nosniff',
    ...extra,
  } });
}

export function failure(error) {
  // Never forward upstream messages, request bodies, credentials or financial records to logs/clients.
  return error instanceof PublicError
    ? json({ error: error.message, code: error.code }, error.status)
    : json({ error: 'Não foi possível concluir a consulta. Tente novamente.', code: 'INTERNAL_ERROR' }, 500);
}

export function sameOrigin(request) {
  if (request.headers.get('origin') !== new URL(request.url).origin) {
    throw new PublicError(403, 'ORIGIN', 'Solicitação não permitida. Abra o painel pelo endereço do site.');
  }
}
