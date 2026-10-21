// POST /api/login  관리자 비밀번호로 로그인
import { json, kvMissing } from '../../lib/util.js';
import { configProblem, passwordMatches, makeToken, sessionCookie, SESSION_SECONDS } from '../../lib/auth.js';

const MAX_FAILS = 10;
const BLOCK_SECONDS = 900;

export async function onRequestPost({ request, env }) {
  const problem = configProblem(env);
  if (problem) return json({ error: problem }, 500);
  const missing = kvMissing(env);
  if (missing) return missing;
  if (request.headers.get('X-Requested-With') !== 'sib') return json({ error: '잘못된 요청입니다.' }, 400);

  const failKey = 'fail:' + (request.headers.get('CF-Connecting-IP') || 'unknown');
  let failed = 0;
  try {
    failed = parseInt((await env.NOTICE_KV.get(failKey)) || '0', 10) || 0;
  } catch (e) {
    failed = 0;
  }
  if (failed >= MAX_FAILS) {
    return json({ error: '비밀번호를 너무 많이 틀렸습니다. 15분 뒤에 다시 시도해 주세요.' }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return json({ error: '잘못된 요청입니다.' }, 400);
  }

  const ok = body && typeof body.password === 'string' && (await passwordMatches(env, body.password));
  if (!ok) {
    try {
      await env.NOTICE_KV.put(failKey, String(failed + 1), { expirationTtl: BLOCK_SECONDS });
    } catch (e) {
      // 기록하지 못해도 로그인 거절은 그대로 합니다.
    }
    return json({ error: '비밀번호가 맞지 않습니다.' }, 401);
  }

  if (failed) {
    try {
      await env.NOTICE_KV.delete(failKey);
    } catch (e) {
      // 무시
    }
  }
  const token = await makeToken(env);
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(token, SESSION_SECONDS) });
}
