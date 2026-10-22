/**
 * Mary Lisa & Edison: RSVP collector
 *
 * Saves every RSVP from the wedding website into this Google Sheet.
 *   - "Guest List" tab: your invitations. If it has names in it, only those
 *     guests can RSVP, and only people marked "Yes" see the plus-one field.
 *     If you leave it empty, anyone with the link can RSVP.
 *   - "RSVPs" tab: one row per invitation. If someone replies again, their
 *     row is updated instead of added twice.
 *
 * Setup: run setup() once, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). Send Claude the web app URL.
 */

const GUEST_TAB = 'Guest List';
const RSVP_TAB = 'RSVPs';
const GUEST_HEADERS = ['Guest name', 'Plus-one allowed (Yes/No)', 'Notes'];
const RSVP_HEADERS = ['Received', 'Name', 'Invitation', 'Email', 'Attending',
  'Plus-one name', 'Dietary needs', 'Song request', 'Note to us'];

/** Run once from the Apps Script editor to create both tabs. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  makeTab_(ss, GUEST_TAB, GUEST_HEADERS);
  makeTab_(ss, RSVP_TAB, RSVP_HEADERS);
}

function makeTab_(ss, name, headers) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  if (sh.getLastRow() === 0) {
    sh.appendRow(headers);
    sh.setFrozenRows(1);
    sh.getRange(1, 1, 1, headers.length).setFontWeight('bold');
  }
  return sh;
}

/** Lower-case, strip accents and punctuation, collapse spaces. */
function norm_(s) {
  return String(s || '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s'-]/g, '')
    .replace(/\s+/g, ' ').trim();
}

/** Trim, cap the length, and stop text from being read as a formula. */
function clean_(s, max) {
  let v = String(s || '').slice(0, max).trim();
  if (/^[=+\-@]/.test(v)) v = "'" + v;
  return v;
}

function findGuest_(name) {
  const sh = SpreadsheetApp.getActive().getSheetByName(GUEST_TAB);
  if (!sh || sh.getLastRow() < 2) return { listInUse: false, found: false };
  const rows = sh.getRange(2, 1, sh.getLastRow() - 1, 2).getValues();
  const key = norm_(name);
  for (const [guest, plus] of rows) {
    if (guest && norm_(guest) === key) {
      return { listInUse: true, found: true, name: String(guest).trim(),
               plusOne: /^y/i.test(String(plus).trim()) };
    }
  }
  return { listInUse: true, found: false };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/** GET ?action=lookup&name=First Last  →  is this guest invited? */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action !== 'lookup') return json_({ ok: true });
  if (norm_(p.name).split(' ').length < 2) return json_({ ok: false, error: 'full_name' });
  const g = findGuest_(p.name);
  // Only says whether the name is on the list and if it includes a guest.
  return json_({ ok: true, listInUse: g.listInUse, found: g.found,
                 name: g.found ? g.name : null, plusOne: !!g.plusOne });
}

/** POST a reply from the website. */
function doPost(e) {
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (d.website) return json_({ ok: true }); // hidden field that only bots fill in

    const name = clean_(d.name, 120);
    if (!name || !/^(yes|no)$/.test(d.attending)) return json_({ ok: false, error: 'missing' });

    const g = findGuest_(name);
    if (g.listInUse && !g.found) return json_({ ok: false, error: 'not_found' });

    const yes = d.attending === 'yes';
    const plusAllowed = !g.listInUse || g.plusOne;
    const row = [
      new Date(),
      name,
      g.found ? g.name : '',
      clean_(d.email, 200),
      yes ? 'Yes' : 'No',
      yes && plusAllowed ? clean_(d.plusone, 120) : '',
      yes ? clean_(d.dietary, 1000) : '',
      yes ? clean_(d.song, 200) : '',
      clean_(d.message, 1000)
    ];

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(RSVP_TAB) || makeTab_(ss, RSVP_TAB, RSVP_HEADERS);
    const key = norm_(g.found ? g.name : name);
    const last = sh.getLastRow();
    if (last > 1) {
      const existing = sh.getRange(2, 2, last - 1, 2).getValues(); // Name, Invitation
      for (let i = 0; i < existing.length; i++) {
        if (norm_(existing[i][1] || existing[i][0]) === key) {
          sh.getRange(i + 2, 1, 1, row.length).setValues([row]);
          return json_({ ok: true, updated: true });
        }
      }
    }
    sh.appendRow(row);
    return json_({ ok: true, updated: false });
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}
