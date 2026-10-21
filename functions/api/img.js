// POST /api/img  관리자가 사진 한 장을 올립니다 (JPG만, 화면에서 미리 줄여서 보냄)
import { json, kvMissing, randomHex, MAX_IMAGE_BYTES } from '../../lib/util.js';
import { requireAdmin } from '../../lib/auth.js';

export async function onRequestPost({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const missing = kvMissing(env);
  if (missing) return missing;

  const type = (request.headers.get('Content-Type') || '').split(';')[0].trim().toLowerCase();
  if (type !== 'image/jpeg') return json({ error: 'JPG 형식 사진만 올릴 수 있습니다.' }, 415);

  const buf = await request.arrayBuffer();
  if (buf.byteLength < 100 || buf.byteLength > MAX_IMAGE_BYTES) {
    return json({ error: '사진 용량이 너무 큽니다. 더 작은 사진을 올려 주세요.' }, 413);
  }
  const head = new Uint8Array(buf, 0, 3);
  if (!(head[0] === 0xff && head[1] === 0xd8 && head[2] === 0xff)) {
    return json({ error: '사진 파일이 올바르지 않습니다.' }, 400);
  }

  const id = randomHex(8);
  await env.NOTICE_KV.put('img:' + id, buf, { metadata: { t: Date.now() } });
  return json({ ok: true, id });
}
