// GET /api/posts  거래처 화면이 글을 가져갑니다 (로그인 없이)
// PUT /api/posts  관리자가 글 전체를 저장합니다 (로그인 필요)
import { json, kvMissing, loadState, validateState, MAX_STATE_CHARS } from '../../lib/util.js';
import { requireAdmin } from '../../lib/auth.js';

export async function onRequestGet({ env }) {
  const missing = kvMissing(env);
  if (missing) return missing;
  const state = await loadState(env);
  return json(state, 200, { 'Cache-Control': 'public, max-age=30' });
}

export async function onRequestPut({ request, env }) {
  const denied = await requireAdmin(request, env);
  if (denied) return denied;
  const missing = kvMissing(env);
  if (missing) return missing;

  const raw = await request.text();
  if (raw.length > MAX_STATE_CHARS) return json({ error: '저장할 내용이 너무 큽니다.' }, 413);
  let body;
  try {
    body = JSON.parse(raw);
  } catch (e) {
    return json({ error: '잘못된 요청입니다.' }, 400);
  }

  const checked = validateState(body);
  if (!checked.ok) return json({ error: checked.error }, 400);

  // 다른 화면에서 먼저 저장했다면 덮어쓰지 않고 알려 줍니다.
  const current = await loadState(env);
  if (Number(body.rev) !== current.rev) {
    return json({ error: '다른 곳에서 먼저 저장된 내용이 있습니다.', rev: current.rev }, 409);
  }

  const next = { rev: current.rev + 1, site: checked.site, posts: checked.posts };
  await env.NOTICE_KV.put('state', JSON.stringify(next));
  await removeUnusedImages(env, next.posts);
  return json(next);
}

// 어떤 글에도 붙어 있지 않은 사진을 지웁니다. 방금 올린 사진은 한 시간 동안 남겨 둡니다.
async function removeUnusedImages(env, posts) {
  try {
    const used = new Set();
    posts.forEach((p) => p.images.forEach((id) => used.add(id)));
    const cutoff = Date.now() - 60 * 60 * 1000;
    let cursor;
    do {
      const page = await env.NOTICE_KV.list({ prefix: 'img:', cursor });
      for (const k of page.keys) {
        const id = k.name.slice(4);
        const uploadedAt = (k.metadata && k.metadata.t) || 0;
        if (!used.has(id) && uploadedAt < cutoff) await env.NOTICE_KV.delete(k.name);
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  } catch (e) {
    // 정리에 실패해도 저장 결과에는 영향이 없습니다.
  }
}
