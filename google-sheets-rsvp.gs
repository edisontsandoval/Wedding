/**
 * Mary Lisa & Edison: RSVP collector
 *
 * Saves every RSVP from the wedding website into this Google Sheet.
 *   - "Guest List" tab: one row per guest. If it has names in it, only those
 *     guests can RSVP, and only people marked "Yes" see the plus-one field.
 *     If you leave it empty, anyone with the link can RSVP.
 *   - "RSVPs" tab: one row per guest. If someone replies again, their row is
 *     updated instead of added twice.
 *
 * Personal links: after adding guests, use the "Wedding RSVPs" menu at the top
 * of the sheet and choose "Make personal links". Each guest gets a private code
 * and a link in the "Personal link" column, ready to copy into an email or DM.
 * A reply sent from a personal link can only be changed from that same link.
 *
 * Setup: run setup() once, then Deploy > New deployment > Web app
 * (Execute as: Me, Who has access: Anyone). Send Claude the web app URL.
 * After pasting a new version of this script, use Deploy > Manage deployments,
 * edit the existing deployment and pick "New version" so the URL stays the same.
 */

const SITE_URL = 'https://edisontsandoval.github.io/Wedding/';
const GUEST_TAB = 'Guest List';
const RSVP_TAB = 'RSVPs';
const GUEST_HEADERS = ['Guest name', 'Plus-one allowed (Yes/No)', 'Notes', 'Code', 'Personal link'];
const RSVP_HEADERS = ['Received', 'Name', 'Invitation', 'Email', 'Attending',
  'Plus-one name', 'Dietary needs', 'Song request', 'Note to us', 'Sent from'];
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; // no 0/O, 1/I/L
const CODE_LEN = 8;

/** Adds the "Wedding RSVPs" menu when the sheet opens. */
function onOpen() {
  SpreadsheetApp.getUi().createMenu('Wedding RSVPs')
    .addItem('Make personal links', 'makeLinks')
    .addItem('Set up tabs', 'setup')
    .addToUi();
}

/** Run once from the Apps Script editor to create both tabs. Safe to run again. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  makeTab_(ss, GUEST_TAB, GUEST_HEADERS);
  makeTab_(ss, RSVP_TAB, RSVP_HEADERS);
}

/** Creates the tab if needed and fills in any missing header cells. */
function makeTab_(ss, name, headers) {
  const sh = ss.getSheetByName(name) || ss.insertSheet(name);
  const have = sh.getLastRow() === 0 ? [] : sh.getRange(1, 1, 1, headers.length).getValues()[0];
  headers.forEach(function (h, i) {
    if (!have[i]) sh.getRange(1, i + 1).setValue(h).setFontWeight('bold');
  });
  sh.setFrozenRows(1);
  return sh;
}

/** Gives every guest without a code a new one, and (re)writes every personal link. */
function makeLinks() {
  const ss = SpreadsheetApp.getActive();
  const sh = makeTab_(ss, GUEST_TAB, GUEST_HEADERS);
  const last = sh.getLastRow();
  if (last < 2) { ss.toast('Add guest names to the Guest List tab first.'); return; }
  const rows = sh.getRange(2, 1, last - 1, 5).getValues();
  const used = {};
  rows.forEach(function (r) { if (r[3]) used[String(r[3]).trim().toUpperCase()] = true; });
  let made = 0;
  const out = rows.map(function (r) {
    if (!String(r[0]).trim()) return [r[3], r[4]];
    let code = String(r[3]).trim().toUpperCase();
    if (!code) {
      do { code = newCode_(); } while (used[code]);
      used[code] = true; made++;
    }
    return [code, SITE_URL + '?k=' + code + '#rsvp'];
  });
  sh.getRange(2, 4, out.length, 2).setValues(out);
  ss.toast(made ? made + ' new personal link' + (made === 1 ? '' : 's') + ' made.' : 'Every guest already has a link.');
}

function newCode_() {
  const bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,
    Utilities.getUuid() + Utilities.getUuid() + Date.now());
  let s = '';
  for (let i = 0; i < CODE_LEN; i++) s += CODE_CHARS[(bytes[i] + 256) % CODE_CHARS.length];
  return s;
}

/** Lower-case, strip accents and punctuation, collapse spaces. */
function norm_(s) {
  return String(s || '').toLowerCase().normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z\s'-]/g, '')
    .replace(/\s+/g, ' ').trim();
}

function normCode_(s) {
  return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Trim, cap the length, and stop text from being read as a formula. */
function clean_(s, max) {
  let v = String(s || '').slice(0, max).trim();
  if (/^[=+\-@]/.test(v)) v = "'" + v;
  return v;
}

function guestRows_() {
  const sh = SpreadsheetApp.getActive().getSheetByName(GUEST_TAB);
  if (!sh || sh.getLastRow() < 2) return [];
  return sh.getRange(2, 1, sh.getLastRow() - 1, 4).getValues();
}

function toGuest_(row) {
  return { listInUse: true, found: true, name: String(row[0]).trim(),
           plusOne: /^y/i.test(String(row[1]).trim()) };
}

function findGuest_(name) {
  const rows = guestRows_();
  if (!rows.some(function (r) { return String(r[0]).trim(); })) return { listInUse: false, found: false };
  const key = norm_(name);
  for (const r of rows) if (r[0] && norm_(r[0]) === key) return toGuest_(r);
  return { listInUse: true, found: false };
}

function findByCode_(code) {
  const k = normCode_(code);
  if (k.length < 6) return { found: false };
  for (const r of guestRows_()) if (r[0] && normCode_(r[3]) === k) return toGuest_(r);
  return { found: false };
}

function rsvpSheet_() {
  const ss = SpreadsheetApp.getActive();
  return makeTab_(ss, RSVP_TAB, RSVP_HEADERS);
}

/** Returns {sheet, index (0-based data row or -1), values} for this guest's reply. */
function findReply_(name) {
  const sh = rsvpSheet_();
  const last = sh.getLastRow();
  const key = norm_(name);
  if (last > 1) {
    const vals = sh.getRange(2, 1, last - 1, RSVP_HEADERS.length).getValues();
    for (let i = 0; i < vals.length; i++) {
      if (norm_(vals[i][2] || vals[i][1]) === key) return { sheet: sh, index: i, values: vals[i] };
    }
  }
  return { sheet: sh, index: -1, values: null };
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * GET ?action=lookup&k=CODE        → who this personal link belongs to, plus their last reply
 * GET ?action=lookup&name=First Last → is this name on the guest list?
 */
function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action !== 'lookup') return json_({ ok: true });

  if (p.k) {
    const g = findByCode_(p.k);
    if (!g.found) return json_({ ok: true, found: false, byLink: true });
    const r = findReply_(g.name).values;
    const reply = r ? { received: r[0] instanceof Date ? r[0].toISOString() : String(r[0]),
      email: r[3], attending: r[4] === 'Yes' ? 'yes' : r[4] === 'No' ? 'no' : '',
      plusone: r[5], dietary: r[6], song: r[7], message: r[8] } : null;
    return json_({ ok: true, listInUse: true, found: true, byLink: true,
                   name: g.name, plusOne: g.plusOne, reply: reply });
  }

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
    if (!/^(yes|no)$/.test(d.attending)) return json_({ ok: false, error: 'missing' });

    let g, name, via;
    if (d.k) {
      g = findByCode_(d.k);
      if (!g.found) return json_({ ok: false, error: 'bad_link' });
      name = g.name; via = 'Link';
    } else {
      name = clean_(d.name, 120);
      if (!name) return json_({ ok: false, error: 'missing' });
      g = findGuest_(name);
      if (g.listInUse && !g.found) return json_({ ok: false, error: 'not_found' });
      via = 'Name';
    }

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
      clean_(d.message, 1000),
      via
    ];

    const found = findReply_(g.found ? g.name : name);
    if (found.index >= 0) {
      // A reply sent from a personal link can only be changed from that link.
      if (via === 'Name' && found.values[9] === 'Link') return json_({ ok: false, error: 'use_link' });
      found.sheet.getRange(found.index + 2, 1, 1, row.length).setValues([row]);
      return json_({ ok: true, updated: true });
    }
    found.sheet.appendRow(row);
    return json_({ ok: true, updated: false });
  } catch (err) {
    return json_({ ok: false, error: 'server' });
  } finally {
    lock.releaseLock();
  }
}
