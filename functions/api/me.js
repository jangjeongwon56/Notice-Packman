// GET /api/me  지금 관리자로 로그인된 상태인지 알려 줍니다
import { json, kvMissing } from '../../lib/util.js';
import { configProblem, isAdmin } from '../../lib/auth.js';

export async function onRequestGet({ request, env }) {
  const missing = kvMissing(env);
  const problem = missing ? '저장소(KV)가 연결되지 않았습니다. 연결 이름이 NOTICE_KV인지 확인해 주세요.' : configProblem(env);
  return json({ admin: problem ? false : await isAdmin(request, env), problem });
}
