// 공통 도구: 응답 만들기, 저장된 글 읽기, 입력값 검사

export const CATS = ['new', 'imp', 'fix', 'note'];
export const MAX_POSTS = 500;
export const MAX_IMAGES_PER_POST = 3;
export const MAX_IMAGE_BYTES = 800 * 1024;
export const MAX_STATE_CHARS = 3000000;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
      ...headers,
    },
  });
}

export function kvMissing(env) {
  if (env && env.NOTICE_KV) return null;
  return json(
    { error: '서버 설정이 끝나지 않았습니다. 저장소(KV) 연결 이름이 NOTICE_KV인지 확인해 주세요.' },
    500
  );
}

export function defaultState() {
  return {
    rev: 0,
    site: {
      name: 'SIB ERP 업데이트 소식',
      tagline: '새 기능, 개선 사항, 오류 수정 내용을 이곳에서 안내합니다.',
      contact: '문의처: 대표 장세승 010-6257-6965',
    },
    posts: [],
  };
}

export async function loadState(env) {
  const raw = await env.NOTICE_KV.get('state');
  if (!raw) return defaultState();
  try {
    const s = JSON.parse(raw);
    if (s && Array.isArray(s.posts) && s.site) {
      return { rev: Number(s.rev) || 0, site: s.site, posts: s.posts };
    }
  } catch (e) {
    // 저장된 값이 깨졌으면 기본값으로 시작합니다.
  }
  return defaultState();
}

export function randomHex(bytes) {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

class Invalid extends Error {}

function text(v, max, label, required) {
  const t = typeof v === 'string' ? v.replace(/\r\n/g, '\n').trim() : '';
  if (required && !t) throw new Invalid(label + '을(를) 입력해 주세요.');
  if (t.length > max) throw new Invalid(label + '은(는) ' + max + '자까지 쓸 수 있습니다.');
  return t;
}

function validDate(d) {
  if (typeof d !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(d)) return false;
  const t = new Date(d + 'T00:00:00Z');
  return !isNaN(t.getTime()) && t.toISOString().slice(0, 10) === d;
}

// 화면에서 받은 데이터를 검사하고 필요한 항목만 골라 돌려줍니다.
export function validateState(input) {
  try {
    if (!input || typeof input !== 'object') throw new Invalid('잘못된 데이터입니다.');
    const s = input.site && typeof input.site === 'object' ? input.site : {};
    const site = {
      name: text(s.name, 60, '페이지 이름', true),
      tagline: text(s.tagline, 140, '한 줄 소개', false),
      contact: text(s.contact, 140, '문의처', false),
    };
    if (!Array.isArray(input.posts)) throw new Invalid('잘못된 데이터입니다.');
    if (input.posts.length > MAX_POSTS) throw new Invalid('글은 ' + MAX_POSTS + '개까지 둘 수 있습니다. 오래된 글을 지워 주세요.');
    const seen = new Set();
    const posts = input.posts.map((p) => {
      if (!p || typeof p !== 'object') throw new Invalid('잘못된 글 데이터입니다.');
      if (typeof p.id !== 'string' || !/^[a-z0-9]{4,24}$/i.test(p.id)) throw new Invalid('글 번호가 올바르지 않습니다.');
      if (seen.has(p.id)) throw new Invalid('글 번호가 겹칩니다.');
      seen.add(p.id);
      if (!validDate(p.date)) throw new Invalid('날짜가 올바르지 않습니다.');
      if (!CATS.includes(p.cat)) throw new Invalid('분류가 올바르지 않습니다.');
      const images = Array.isArray(p.images) ? p.images : [];
      if (images.length > MAX_IMAGES_PER_POST) throw new Invalid('사진은 글 하나에 ' + MAX_IMAGES_PER_POST + '장까지 붙일 수 있습니다.');
      images.forEach((id) => {
        if (typeof id !== 'string' || !/^[a-f0-9]{16}$/.test(id)) throw new Invalid('사진 번호가 올바르지 않습니다.');
      });
      return {
        id: p.id,
        created: Number.isFinite(p.created) ? Math.floor(p.created) : Date.now(),
        date: p.date,
        cat: p.cat,
        title: text(p.title, 120, '제목', true),
        body: text(p.body, 5000, '내용', false),
        images: Array.from(new Set(images)),
      };
    });
    return { ok: true, site, posts };
  } catch (e) {
    if (e instanceof Invalid) return { ok: false, error: e.message };
    throw e;
  }
}
