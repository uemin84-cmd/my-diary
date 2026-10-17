/**
 * 가계부 ↔ 구글 시트 연동용 Apps Script
 *
 * 사용법은 apps-script/README.md 참고.
 * 구글 시트 → 확장 프로그램 → Apps Script 에 이 파일 내용을 붙여넣고
 * "웹 앱"으로 배포한 뒤, 배포 URL을 가계부 앱 설정에 입력하세요.
 */

const SHEET_NAME = '가계부';
// 앱 설정의 "비밀 키"와 같은 값으로 바꾸세요. 비워두면 키 검사를 하지 않습니다.
const TOKEN = '';
const HEADERS = ['ID', '날짜', '구분', '카테고리', '금액', '결제수단', '메모', '입력시각'];

function getSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(SHEET_NAME);
  if (!sh) sh = ss.insertSheet(SHEET_NAME);
  if (sh.getLastRow() === 0) {
    sh.appendRow(HEADERS);
    sh.setFrozenRows(1);
    sh.getRange('B:B').setNumberFormat('yyyy-mm-dd');
    sh.getRange('E:E').setNumberFormat('#,##0');
    sh.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sh;
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function checkToken_(token) {
  if (TOKEN && token !== TOKEN) throw new Error('비밀 키가 일치하지 않아요');
}

// 시트에서 수식으로 해석되지 않도록 막기
function safeText_(v) {
  const s = String(v == null ? '' : v);
  return /^[=+\-@]/.test(s) ? "'" + s : s;
}

function findRow_(sh, id) {
  const last = sh.getLastRow();
  if (last < 2) return -1;
  const ids = sh.getRange(2, 1, last - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (String(ids[i][0]) === String(id)) return i + 2;
  }
  return -1;
}

// 조회: GET ?token=...&month=2026-10 (month 생략 시 전체)
function doGet(e) {
  try {
    const p = (e && e.parameter) || {};
    checkToken_(p.token);
    const sh = getSheet_();
    const tz = Session.getScriptTimeZone();
    let rows = sh.getDataRange().getValues().slice(1)
      .filter(r => r[0] !== '')
      .map(r => ({
        id: String(r[0]),
        date: r[1] instanceof Date ? Utilities.formatDate(r[1], tz, 'yyyy-MM-dd') : String(r[1]),
        type: String(r[2]),
        category: String(r[3]),
        amount: Number(r[4]) || 0,
        method: String(r[5]),
        memo: String(r[6])
      }));
    if (p.month) rows = rows.filter(r => r.date.indexOf(p.month) === 0);
    return json_({ ok: true, rows: rows });
  } catch (err) {
    return json_({ ok: false, error: err.message });
  }
}

// 추가/삭제: POST { token, action: 'add', entry } 또는 { token, action: 'delete', id }
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const body = JSON.parse(e.postData.contents);
    checkToken_(body.token);
    const sh = getSheet_();

    if (body.action === 'add') {
      const x = body.entry || {};
      if (!x.id || !x.date || !x.amount) throw new Error('필수 값이 빠졌어요');
      // 같은 ID가 이미 있으면 중복 저장하지 않음 (재전송 대비)
      if (findRow_(sh, x.id) === -1) {
        sh.appendRow([
          x.id, x.date, safeText_(x.type), safeText_(x.category), Number(x.amount),
          safeText_(x.method), safeText_(x.memo), new Date()
        ]);
      }
      return json_({ ok: true });
    }

    if (body.action === 'delete') {
      const row = findRow_(sh, body.id);
      if (row > 0) sh.deleteRow(row);
      return json_({ ok: true });
    }

    throw new Error('알 수 없는 요청이에요: ' + body.action);
  } catch (err) {
    return json_({ ok: false, error: err.message });
  } finally {
    lock.releaseLock();
  }
}
