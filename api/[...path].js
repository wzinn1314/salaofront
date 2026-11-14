// Same-origin bridge between the Vercel frontend and the separately hosted API.
export default async function handler(request, response) {
  response.setHeader('Cache-Control', 'no-store');
  const fail = (status, error) => response.status(status).json({ error });
  const backend = process.env.BACKEND_URL;
  if (!backend) return fail(503, 'Agenda indisponível: configure BACKEND_URL na Vercel.');
  let base;
  try {
    base = new URL(backend);
    if (base.protocol !== 'https:' || base.username || base.password) throw new Error();
  } catch {
    return fail(503, 'Endereço do backend inválido.');
  }
  const host = request.headers['x-forwarded-host'] || request.headers.host;
  if (!['GET', 'HEAD'].includes(request.method) && request.headers.origin !== 'https://' + host) {
    return fail(403, 'Origem não permitida.');
  }
  const incoming = new URL(request.url, 'https://' + host);
  if (!incoming.pathname.startsWith('/api/')) return fail(404, 'Não encontrado.');
  const target = new URL(base.origin);
  target.pathname = incoming.pathname;
  target.search = incoming.search;
  const headers = { Origin: base.origin };
  for (const name of ['content-type', 'cookie']) {
    if (request.headers[name]) headers[name] = request.headers[name];
  }
  try {
    const upstream = await fetch(target, {
      method: request.method,
      headers,
      ...(!['GET', 'HEAD'].includes(request.method) ? {
        body: typeof request.body === 'string' ? request.body : JSON.stringify(request.body ?? {})
      } : {}),
      redirect: 'manual',
      signal: AbortSignal.timeout(15000)
    });
    if (upstream.status >= 300 && upstream.status < 400) {
      return fail(502, 'O backend precisa disponibilizar a API sem redirecionar para login.');
    }
    response.setHeader('Content-Type', upstream.headers.get('content-type') || 'application/json');
    const cookies = upstream.headers.getSetCookie();
    if (cookies.length) response.setHeader('Set-Cookie', cookies);
    response.status(upstream.status).send(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    return fail(502, 'Não foi possível conectar à agenda. Tente novamente mais tarde.');
  }
}
