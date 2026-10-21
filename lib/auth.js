// 관리자 로그인: 비밀번호 확인, 로그인 표(쿠키) 만들기와 검사

import { json } from './util.js';

const enc = new TextEncoder();
export const COOKIE = 'sib_admin';
export const SESSION_SECONDS = 12 * 60 * 60;

async function hmacHex(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('');
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// 설정이 빠졌으면 이유를 글로 돌려줍니다. 정상이면 빈 문자열입니다.
export function configProblem(env) {
  if (!env.ADMIN_PASSWORD || String(env.ADMIN_PASSWORD).length < 8) {
    return '서버에 관리자 비밀번호(ADMIN_PASSWORD, 8자 이상)가 설정되어 있지 않습니다.';
  }
  if (!env.SESSION_SECRET || String(env.SESSION_SECRET).length < 16) {
    return '서버에 로그인 보안 문구(SESSION_SECRET, 16자 이상)가 설정되어 있지 않습니다.';
  }
  return '';
}

// 두 비밀번호를 같은 길이로 바꿔 비교해서 비교 시간으로 힌트가 새지 않게 합니다.
export async function passwordMatches(env, given) {
  const a = await hmacHex(env.SESSION_SECRET, 'pw:' + String(given));
  const b = await hmacHex(env.SESSION_SECRET, 'pw:' + String(env.ADMIN_PASSWORD));
  return safeEqual(a, b);
}

export async function makeToken(env) {
  const exp = Math.floor(Date.now() / 1000) + SESSION_SECONDS;
  const sig = await hmacHex(env.SESSION_SECRET, 'session:' + exp);
  return exp + '.' + sig;
}

export async function verifyToken(env, token) {
  if (typeof token !== 'string') return false;
  const m = /^(\d{1,12})\.([a-f0-9]{64})$/.exec(token);
  if (!m) return false;
  if (Number(m[1]) < Math.floor(Date.now() / 1000)) return false;
  const expect = await hmacHex(env.SESSION_SECRET, 'session:' + m[1]);
  return safeEqual(expect, m[2]);
}

export function readCookie(request, name) {
  const header = request.headers.get('Cookie') || '';
  for (const part of header.split(';')) {
    const i = part.indexOf('=');
    if (i > 0 && part.slice(0, i).trim() === name) return part.slice(i + 1).trim();
  }
  return '';
}

export function sessionCookie(token, maxAge) {
  return COOKIE + '=' + token + '; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=' + maxAge;
}

export async function isAdmin(request, env) {
  if (configProblem(env)) return false;
  return verifyToken(env, readCookie(request, COOKIE));
}

// 글을 바꾸는 요청 앞에서 부릅니다. 통과하면 null, 막으면 응답을 돌려줍니다.
export async function requireAdmin(request, env) {
  const problem = configProblem(env);
  if (problem) return json({ error: problem }, 500);
  if (request.headers.get('X-Requested-With') !== 'sib') return json({ error: '잘못된 요청입니다.' }, 400);
  if (!(await verifyToken(env, readCookie(request, COOKIE)))) {
    return json({ error: '로그인이 필요합니다.' }, 401);
  }
  return null;
}
