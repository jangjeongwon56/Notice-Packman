// POST /api/logout  로그인 표를 지웁니다
import { json } from '../../lib/util.js';
import { sessionCookie } from '../../lib/auth.js';

export async function onRequestPost({ request }) {
  if (request.headers.get('X-Requested-With') !== 'sib') return json({ error: '잘못된 요청입니다.' }, 400);
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
}
