// GET /guide/file/<번호>.pdf  관리자가 올린 설명서 PDF를 보여 줍니다 (로그인 없이)
import { kvMissing } from '../../../lib/util.js';

export async function onRequestGet({ params, env }) {
  const missing = kvMissing(env);
  if (missing) return missing;
  const id = String(params.id || '').replace(/\.pdf$/, '');
  if (!/^[a-f0-9]{16}$/.test(id)) return new Response('Not found', { status: 404 });
  const buf = await env.NOTICE_KV.get('gfile:' + id, { type: 'arrayBuffer' });
  if (!buf) return new Response('Not found', { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return new Response(buf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'inline',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
    },
  });
}
