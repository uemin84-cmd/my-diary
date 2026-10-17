// 가계부 공용 로직 — budget.html(가계부)과 index.html(일기)에서 함께 사용
const Budget = (() => {
  const CATEGORIES = {
    '지출': ['식비', '카페·간식', '교통', '쇼핑', '생활', '주거·통신', '의료·건강', '문화·여가', '교육', '경조사', '기타'],
    '수입': ['급여', '부수입', '용돈', '금융수입', '기타']
  };
  // 메모에 들어간 단어로 카테고리를 추측 (앞에 있는 카테고리가 우선)
  const KEYWORDS = {
    '카페·간식': ['커피', '카페', '스벅', '스타벅스', '라떼', '아아', '빵', '디저트', '케이크', '간식', '편의점', '아이스크림', '음료'],
    '식비': ['점심', '저녁', '아침', '밥', '식사', '김밥', '라면', '배달', '배민', '요기요', '쿠팡이츠', '치킨', '피자', '떡볶이', '고기', '식당', '장보기', '마트', '반찬', '술', '회식'],
    '교통': ['택시', '버스', '지하철', '교통', '기차', 'ktx', 'srt', '주유', '기름', '주차', '톨비', '카카오t'],
    '주거·통신': ['월세', '관리비', '전기', '가스', '수도', '통신', '핸드폰', '휴대폰', '인터넷', '보험'],
    '의료·건강': ['병원', '약국', '약', '치과', '한의원', '헬스', 'pt', '필라테스', '요가', '영양제'],
    '문화·여가': ['영화', '넷플릭스', '유튜브', '구독', '공연', '전시', '여행', '숙소', '호텔', '게임', '노래방'],
    '교육': ['책', '강의', '클래스', '수업', '학원', '교재', '인강'],
    '경조사': ['축의', '조의', '부조', '선물', '생일'],
    '쇼핑': ['옷', '신발', '가방', '쿠팡', '무신사', '올리브영', '화장품', '쇼핑', '다이소'],
    '생활': ['생활', '세제', '휴지', '청소', '세탁', '미용실', '네일']
  };
  const INCOME_KEYWORDS = {
    '급여': ['월급', '급여', '연봉', '상여', '보너스'],
    '부수입': ['부수입', '강의료', '원고료', '외주', '판매', '중고'],
    '용돈': ['용돈'],
    '금융수입': ['이자', '배당', '환급', '캐시백']
  };
  const METHOD_WORDS = { '현금': '현금', '카드': '카드', '체크': '카드', '이체': '계좌이체', '계좌이체': '계좌이체', '페이': '간편결제', '카카오페이': '간편결제', '네이버페이': '간편결제', '토스': '간편결제', '삼성페이': '간편결제' };
  const MOODS = { '뿌듯': '🤩', '행복': '😊', '감사': '🥰', '감동': '🥹', '신남': '😆', '설렘': '🤗', '분노': '😡', '공포': '😨', '짜증': '😤', '놀람': '😲', '불안': '😰', '우울': '😔', '피로': '😩', '지루': '😑', '고민': '🤔' };

  const pad = n => String(n).padStart(2, '0');
  const localDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const won = n => Math.round(Number(n)).toLocaleString('ko-KR') + '원';
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  // "12500", "12,500원", "1만2천", "4.5천", "3만", "10k" → 숫자
  function parseAmount(token) {
    const t = token.replace(/,/g, '').replace(/원$/, '').toLowerCase();
    if (/^\d+(\.\d+)?k$/.test(t)) return Math.round(parseFloat(t) * 1000);
    const m = t.match(/^(?:(\d+(?:\.\d+)?)만)?(?:(\d+(?:\.\d+)?)천)?(\d+)?$/);
    if (!m || !(m[1] || m[2] || m[3])) return 0;
    return Math.round((parseFloat(m[1]) || 0) * 10000 + (parseFloat(m[2]) || 0) * 1000 + (parseInt(m[3]) || 0));
  }

  function guessCategory(type, memo) {
    const text = memo.toLowerCase();
    const table = type === '수입' ? INCOME_KEYWORDS : KEYWORDS;
    for (const [cat, words] of Object.entries(table)) {
      if (words.some(w => text.includes(w))) return cat;
    }
    return '기타';
  }

  // 한 줄 입력 해석: "점심 김밥 12500", "택시 1만2천 어제", "+월급 300만"
  function parse(text) {
    let s = text.trim();
    if (!s) return null;
    let type = '지출';
    if (s.startsWith('+')) { type = '수입'; s = s.slice(1).trim(); }

    const date = new Date();
    let amount = 0, method = '';
    const rest = [];
    for (const tok of s.split(/\s+/)) {
      if (tok === '어제') { date.setDate(date.getDate() - 1); continue; }
      if (tok === '그제' || tok === '그저께') { date.setDate(date.getDate() - 2); continue; }
      if (METHOD_WORDS[tok]) { method = METHOD_WORDS[tok]; continue; }
      const a = parseAmount(tok);
      if (a && !amount) { amount = a; continue; }
      rest.push(tok);
    }
    const memo = rest.join(' ');
    if (type === '지출' && guessCategory('수입', memo) !== '기타') type = '수입';
    return {
      type, amount, memo,
      category: guessCategory(type, memo),
      method: type === '지출' ? (method || '카드') : '',
      date: localDate(date)
    };
  }

  // ---------- 저장소 ----------
  const load = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const store = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  let entries = load('budget_entries', []);
  let pendingDeletes = load('budget_pending_deletes', []);
  const persist = () => { store('budget_entries', entries); store('budget_pending_deletes', pendingDeletes); };
  const listeners = [];
  const changed = () => listeners.forEach(fn => fn());

  const settings = {
    get url() { return (localStorage.getItem('budget_gas_url') || '').trim(); },
    set url(v) { localStorage.setItem('budget_gas_url', v.trim()); },
    get token() { return localStorage.getItem('budget_token') || ''; },
    set token(v) { localStorage.setItem('budget_token', v); },
    get monthlyBudget() { return Number(localStorage.getItem('budget_monthly')) || 0; },
    set monthlyBudget(v) { localStorage.setItem('budget_monthly', String(v || 0)); }
  };

  // Content-Type을 text/plain으로 보내야 Apps Script에서 CORS 사전요청 없이 동작합니다.
  async function postToSheet(payload) {
    const res = await fetch(settings.url, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ token: settings.token, ...payload })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error);
    return data;
  }
  const withoutSynced = ({ synced, ...d }) => d;

  // 반환값: 'sheet'(시트 저장), 'pending'(전송 대기), 'local'(시트 미연동)
  async function add(fields) {
    const entry = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
      date: fields.date || localDate(),
      type: fields.type, category: fields.category, amount: fields.amount,
      method: fields.method || '', memo: fields.memo || '',
      synced: false
    };
    entries.push(entry);
    persist();
    changed();
    if (!settings.url) return 'local';
    try {
      await postToSheet({ action: 'add', entry: withoutSynced(entry) });
      entry.synced = true;
      persist();
      changed();
      return 'sheet';
    } catch (e) {
      console.warn('시트 전송 실패', e);
      return 'pending';
    }
  }

  async function remove(id) {
    const entry = entries.find(e => e.id === id);
    if (!entry) return;
    entries = entries.filter(e => e.id !== id);
    if (entry.synced) pendingDeletes.push(id);
    persist();
    changed();
    if (entry.synced && settings.url) {
      try {
        await postToSheet({ action: 'delete', id });
        pendingDeletes = pendingDeletes.filter(x => x !== id);
        persist();
        changed();
      } catch (e) { console.warn('시트 삭제 실패', e); }
    }
  }

  // 대기 중인 추가/삭제를 보내고, 시트 내용을 불러와 기준으로 삼음
  async function sync() {
    if (!settings.url) throw new Error('먼저 웹 앱 URL을 입력해 주세요');
    for (const id of [...pendingDeletes]) {
      await postToSheet({ action: 'delete', id });
      pendingDeletes = pendingDeletes.filter(x => x !== id);
      persist();
    }
    for (const e of entries.filter(e => !e.synced)) {
      await postToSheet({ action: 'add', entry: withoutSynced(e) });
      e.synced = true;
      persist();
    }
    const url = new URL(settings.url);
    if (settings.token) url.searchParams.set('token', settings.token);
    const data = await (await fetch(url)).json();
    if (!data.ok) throw new Error(data.error);
    const unsynced = entries.filter(e => !e.synced);
    entries = [...data.rows.map(r => ({ ...r, synced: true })), ...unsynced];
    persist();
    changed();
  }

  const waitingCount = () => entries.filter(e => !e.synced).length + pendingDeletes.length;
  const sum = list => list.reduce((s, e) => s + e.amount, 0);
  const expenses = list => list.filter(e => e.type === '지출');
  const byDate = date => entries.filter(e => e.date === date);
  const byMonth = ym => entries.filter(e => e.date.startsWith(ym));

  // 이번 달 예산 기준으로 오늘 쓸 수 있는 돈
  function budgetStatus(today = new Date()) {
    const budget = settings.monthlyBudget;
    const todayStr = localDate(today);
    const monthExp = expenses(byMonth(todayStr.slice(0, 7)));
    const spentBefore = sum(monthExp.filter(e => e.date < todayStr));
    const spentToday = sum(monthExp.filter(e => e.date === todayStr));
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysLeft = daysInMonth - today.getDate() + 1;
    const daily = (budget - spentBefore) / daysLeft;
    return {
      budget, spentToday, daysLeft,
      spentMonth: spentBefore + spentToday,
      monthLeft: budget - spentBefore - spentToday,
      todayLeft: daily - spentToday,
      daily
    };
  }

  // 일기 기분별 하루 평균 지출 (일기를 쓴 날만 비교)
  function moodAnalysis() {
    const diary = load('diary_entries', []).filter(d => d.mood && d.date);
    const days = diary.map(d => {
      const exp = expenses(byDate(d.date));
      return { mood: d.mood, total: sum(exp), exp };
    });
    const overall = days.length ? sum(days.map(d => ({ amount: d.total }))) / days.length : 0;
    const groups = {};
    days.forEach(d => (groups[d.mood] ||= []).push(d));
    const moods = Object.entries(groups).map(([mood, list]) => {
      const avg = sum(list.map(d => ({ amount: d.total }))) / list.length;
      const cats = {};
      list.forEach(d => d.exp.forEach(e => cats[e.category] = (cats[e.category] || 0) + e.amount));
      const topCategory = Object.entries(cats).sort((a, b) => b[1] - a[1])[0]?.[0] || '';
      return { mood, emoji: MOODS[mood] || '', days: list.length, avg, ratio: overall ? avg / overall : 0, topCategory };
    }).sort((a, b) => b.avg - a.avg);
    return { dayCount: days.length, overall, moods };
  }

  // 일기의 '재테크' 칸(Make/Notion 전송용)에 넣을 오늘 지출 요약
  function daySummary(date = localDate()) {
    const list = byDate(date);
    if (!list.length) return '';
    const lines = list.map(e => `${e.type === '수입' ? '+' : '-'}${won(e.amount)} ${e.category}${e.memo ? ` (${e.memo})` : ''}`);
    const exp = sum(expenses(list));
    return lines.join('\n') + (exp ? `\n지출 합계 ${won(exp)}` : '');
  }

  return {
    CATEGORIES, MOODS, settings, localDate, won, esc, parse,
    get entries() { return entries; },
    add, remove, sync, waitingCount, sum, expenses, byDate, byMonth,
    budgetStatus, moodAnalysis, daySummary,
    onChange: fn => listeners.push(fn)
  };
})();
