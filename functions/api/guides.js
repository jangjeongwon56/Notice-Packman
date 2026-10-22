// GET /api/guides  기초설명서 목록 (로그인 없이)
// PUT /api/guides  관리자가 설명서 목록을 저장합니다 (로그인 필요)
import { json, kvMissing, loadGuides, validateGuides, MAX_GUIDES_CHARS } from '../../lib/util.js';
import { requireAdmin } from '../../lib/auth.js';

export async function onRequestGet({ env }) {
  const missing = kvMissing(env);
  if (missing) return missing;
  return json(await loadGuides(env), 200, { 'Cache-Control': 'public, max-age=30' });
}

export async function onRequestPut({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const missing = kvMissing(env);
  if (missing) return missing;

  const raw = await request.text();
  if (raw.length > MAX_GUIDES_CHARS) return json({ error: '저장할 내용이 너무 큽니다.' }, 413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch (e) {
    return json({ error: '잘못된 요청입니다.' }, 400);
  }
  const checked = validateGuides(body);
  if (!checked.ok) return json({ error: checked.error }, 400);

  const current = await loadGuides(env);
  if (Number(body.rev) !== current.rev) {
    return json({ error: '다른 곳에서 먼저 저장된 내용이 있습니다.', rev: current.rev }, 409);
  }

  const next = { rev: current.rev + 1, items: checked.items };
  await env.NOTICE_KV.put('guides', JSON.stringify(next));
  await removeUnusedFiles(env, next.items);
  return json(next);
}

// 어떤 설명서에도 쓰이지 않는 PDF를 지웁니다. 방금 올린 파일은 한 시간 동안 남겨 둡니다.
async function removeUnusedFiles(env, items) {
  try {
    const used = new Set();
    items.forEach((g) => {
      const m = /^\/guide\/file\/([a-f0-9]{16})\.pdf$/.exec(g.src);
      if (m) used.add(m[1]);
    });
    const cutoff = Date.now() - 60 * 60 * 1000;
    let cursor;
    do {
      const page = await env.NOTICE_KV.list({ prefix: 'gfile:', cursor });
      for (const k of page.keys) {
        const id = k.name.slice(6);
        const uploadedAt = (k.metadata && k.metadata.t) || 0;
        if (!used.has(id) && uploadedAt < cutoff) await env.NOTICE_KV.delete(k.name);
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  } catch (e) {
    // 정리에 실패해도 저장 결과에는 영향이 없습니다.
  }
}
