// POST /api/guide-file  관리자가 설명서 PDF 한 개를 올립니다
import { json, kvMissing, randomHex, MAX_GUIDE_BYTES } from '../../lib/util.js';
import { requireAdmin } from '../../lib/auth.js';

export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const missing = kvMissing(env);
  if (missing) return missing;

  const type = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (type !== 'application/pdf') return json({ error: 'PDF 파일만 올릴 수 있습니다.' }, 415);

  const buf = await request.arrayBuffer();
  if (buf.byteLength < 100) return json({ error: 'PDF 파일이 올바르지 않습니다.' }, 400);
  if (buf.byteLength > MAX_GUIDE_BYTES) {
    return json({ error: 'PDF 용량이 너무 큽니다. ' + Math.floor(MAX_GUIDE_BYTES / 1048576) + 'MB 이하로 줄여 주세요.' }, 413);
  }
  const head = new Uint8Array(buf, 0, 5);
  const isPdf = head[0] === 0x25 && head[1] === 0x50 && head[2] === 0x44 && head[3] === 0x46 && head[4] === 0x2d;
  if (!isPdf) return json({ error: 'PDF 파일이 올바르지 않습니다.' }, 400);

  const id = randomHex(8);
  await env.NOTICE_KV.put('gfile:' + id, buf, { metadata: { t: Date.now() } });
  return json({ ok: true, id, src: '/guide/file/' + id + '.pdf', size: buf.byteLength });
}
