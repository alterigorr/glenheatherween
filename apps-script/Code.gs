/**
 * Glenheatherween: Apps Script backend for glenheatherween.com
 *
 * Paste this whole file into the Sheet's Apps Script editor (Extensions > Apps Script),
 * then Deploy > Manage deployments > edit the existing deployment > Version: New version.
 * Editing the existing deployment keeps the same /exec URL the site already uses.
 *
 * Data lives in the 'rsvps' tab, created automatically on first use:
 *   A Updated | B House # | C Street | D Name | E Candy | F Decorated | G Special
 *   H Note | I Kids | J Lat | K Lng
 *
 * Privacy: GET only ever returns houses that are stops on the map (address, optional
 * display name, what they offer, note, coordinates) plus two totals. Kid counts per
 * house are never sent to the browser.
 *
 * Admin (glenheatherween.com/admin): event date, times and raffle details are saved in
 * Script Properties under SETTINGS. Saving needs the PIN stored in Script Properties under
 * ADMIN_PIN (Project Settings > Script Properties). The PIN is never in this file, which is public.
 * After a save, the backend asks GitHub to rebuild flyer.pdf right away, using a fine-grained
 * token (this repo only, Actions: read and write) stored in Script Properties as GITHUB_TOKEN.
 */

var TAB = 'rsvps';
var HEADERS = ['Updated', 'House #', 'Street', 'Name', 'Candy', 'Decorated', 'Special', 'Note', 'Kids', 'Lat', 'Lng'];
var COL = { updated: 0, num: 1, street: 2, name: 3, candy: 4, decorated: 5, special: 6, note: 7, kids: 8, lat: 9, lng: 10 };

// Keep in sync with CONFIG.streets in index.html.
var STREETS = [
  'Birch Street', 'Bonnie Brae Avenue', 'Bryn Mawr Avenue', 'Glen Heather Way', 'Inverness Avenue',
  'Ivanhoe Way', 'Kiltie Way', 'Kirkland Avenue', 'Loch Lomond Way'
];

// Oakey Blvd to Glen Heather Way, Bryn Mawr to the freeway, with a little slack.
var AREA = { south: 36.1462, west: -115.1750, north: 36.1530, east: -115.1645 };

var CACHE_KEY = 'public-v1';
var CACHE_SECONDS = 600; // every RSVP or settings save clears it, so a long life only saves work

function doGet(e) {
  var cache = CacheService.getScriptCache();

  // ?rid=<receipt>: the page asking what happened to a save whose reply it couldn't read.
  var rid = e && e.parameter && e.parameter.rid;
  if (rid) {
    var receipt = validRid_(rid) ? cache.get('rid:' + rid) : null;
    return json_(receipt ? JSON.parse(receipt) : { ok: false, pending: true });
  }

  var hit = cache.get(CACHE_KEY);
  if (hit) return json_(JSON.parse(hit));

  var body = publicData_();
  cache.put(CACHE_KEY, JSON.stringify(body), CACHE_SECONDS);
  return json_(body);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  var rid = null;
  var result;
  try {
    lock.waitLock(15000);
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    rid = validRid_(payload.rid) ? payload.rid : null;
    if (payload.type === 'rsvp') result = handleRsvp_(payload.data || {});
    else if (payload.type === 'admin-check') result = checkPin_(payload.pin) || { ok: true, settings: getSettings_() };
    else if (payload.type === 'settings') result = checkPin_(payload.pin) || saveSettings_(payload.data || {});
    else result = { ok: false, error: 'Unknown request.' };
  } catch (err) {
    console.error(err);
    result = { ok: false, error: 'Something went wrong. Please try again.' };
  } finally {
    lock.releaseLock();
  }
  result.done = true;
  // Keep the outcome for 6 hours so the page can look it up by receipt if the reply gets lost.
  if (rid) CacheService.getScriptCache().put('rid:' + rid, JSON.stringify(result), 21600);
  return json_(result);
}

function handleRsvp_(data) {
  var entry = clean_(data);
  if (entry.error) return { ok: false, error: entry.error };
  var result = saveRsvp_(entry);
  CacheService.getScriptCache().remove(CACHE_KEY);
  return result;
}

function validRid_(rid) {
  return typeof rid === 'string' && /^[A-Za-z0-9-]{16,64}$/.test(rid);
}

/* ---------------------------------------------------------------- reads */

function publicData_() {
  var rows = rows_();
  var houses = [];
  var kids = 0;

  rows.forEach(function (r) {
    kids += Number(r[COL.kids]) || 0;
    var stop = r[COL.candy] === true || r[COL.decorated] === true || r[COL.special] === true;
    if (!stop) return;
    houses.push({
      num: String(r[COL.num]),
      street: String(r[COL.street]),
      name: String(r[COL.name] || ''),
      candy: r[COL.candy] === true,
      decorated: r[COL.decorated] === true,
      special: r[COL.special] === true,
      note: String(r[COL.note] || ''),
      lat: r[COL.lat] === '' ? null : Number(r[COL.lat]),
      lng: r[COL.lng] === '' ? null : Number(r[COL.lng])
    });
  });

  return { ok: true, houses: houses, totals: { houses: houses.length, kids: kids }, settings: getSettings_() };
}

/* --------------------------------------------------------------- writes */

function saveRsvp_(entry) {
  var sheet = sheet_();
  var data = sheet.getDataRange().getValues();
  var rowIndex = -1;
  for (var i = 1; i < data.length; i++) {
    if (String(data[i][COL.num]) === entry.num && String(data[i][COL.street]) === entry.street) {
      rowIndex = i;
      break;
    }
  }
  var prev = rowIndex > 0 ? data[rowIndex] : null;

  var isStop = entry.candy || entry.decorated || entry.special;
  if (!isStop && !entry.kids) {
    if (!prev) return { ok: false, error: 'Please check at least one box: candy, decorated, special stop, or kids trick-or-treating.' };
    sheet.deleteRow(rowIndex + 1);
    return { ok: true, removed: true };
  }
  // The page can't show a house's saved kid count, so it asks to keep it unless the neighbor changed it.
  var kids = entry.kids;
  if (entry.keepKids && prev && isStop) kids = Number(prev[COL.kids]) || 0;

  // Look the address up once; reuse the stored coordinates on later updates.
  var lat = prev ? prev[COL.lat] : '';
  var lng = prev ? prev[COL.lng] : '';
  if (isStop && (lat === '' || lng === '')) {
    var pt = geocode_(entry.num + ' ' + entry.street);
    if (pt) { lat = pt.lat; lng = pt.lng; }
  }

  var row = [
    new Date(), entry.num, entry.street, safe_(entry.name),
    entry.candy, entry.decorated, entry.special, safe_(entry.note),
    kids, lat, lng
  ];

  if (prev) sheet.getRange(rowIndex + 1, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);

  return { ok: true, updated: !!prev, mapped: lat !== '', kids: kids };
}

function geocode_(address) {
  try {
    var res = Maps.newGeocoder()
      .setBounds(AREA.south, AREA.west, AREA.north, AREA.east)
      .geocode(address + ', Las Vegas, NV 89102');
    var hit = res && res.results && res.results[0];
    if (!hit) return null;
    var loc = hit.geometry.location;
    // Reject anything that landed outside the neighborhood (e.g. a same-named street elsewhere).
    if (loc.lat < AREA.south || loc.lat > AREA.north || loc.lng < AREA.west || loc.lng > AREA.east) {
      console.warn('Geocode outside area for ' + address + ': ' + loc.lat + ',' + loc.lng);
      return null;
    }
    return { lat: loc.lat, lng: loc.lng };
  } catch (err) {
    console.warn('Geocode failed for ' + address + ': ' + err);
    return null;
  }
}

/* ---------------------------------------------------------------- admin */

// Returns an error answer if the PIN is wrong (or locked out), or null when it's right.
// Five wrong tries lock the admin for 5 minutes.
function checkPin_(pin) {
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get('pin-fails') || 0);
  if (fails >= 5) return { ok: false, locked: true, error: 'Too many wrong PINs. Try again in 5 minutes.' };
  var real = PropertiesService.getScriptProperties().getProperty('ADMIN_PIN');
  if (!real) return { ok: false, error: 'The admin PIN hasn\'t been set up yet (Script Properties > ADMIN_PIN).' };
  if (String(pin == null ? '' : pin) !== String(real)) {
    cache.put('pin-fails', String(fails + 1), 300);
    return { ok: false, badPin: true, error: "That PIN isn't right." };
  }
  cache.remove('pin-fails');
  return null;
}

function getSettings_() {
  var raw = PropertiesService.getScriptProperties().getProperty('SETTINGS');
  if (!raw) return null;
  try { return JSON.parse(raw); } catch (err) { return null; }
}

function saveSettings_(d) {
  var date = String(d.eventDate || '');
  var parts = date.split('-').map(Number);
  var check = new Date(parts[0], parts[1] - 1, parts[2]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || check.getMonth() !== parts[1] - 1 || check.getDate() !== parts[2]) {
    return { ok: false, error: 'Please choose a valid date.' };
  }
  var hours = (Array.isArray(d.hours) ? d.hours : []).slice(0, 3)
    .map(function (r) { return { when: text_(r && r.when, 30), what: text_(r && r.what, 60) }; })
    .filter(function (r) { return r.when || r.what; });
  if (!hours.length) return { ok: false, error: 'Please enter at least one time.' };

  var r = d.raffle || {};
  var settings = {
    eventDate: date,
    hours: hours,
    raffle: {
      enabled: r.enabled === true,
      intro: text_(r.intro, 200),
      location: text_(r.location, 80),
      price: text_(r.price, 80),
      pay: text_(r.pay, 60),
      drawing: text_(r.drawing, 80)
    },
    updated: new Date().toISOString()
  };
  PropertiesService.getScriptProperties().setProperty('SETTINGS', JSON.stringify(settings));
  CacheService.getScriptCache().remove(CACHE_KEY);
  return { ok: true, settings: settings, flyerRebuilding: triggerFlyerRebuild_() };
}

// Start the "Rebuild flyer" GitHub workflow now instead of waiting for its 15-minute schedule.
// Returns false (and the schedule catches up later) if the token is missing or GitHub says no.
function triggerFlyerRebuild_() {
  var token = PropertiesService.getScriptProperties().getProperty('GITHUB_TOKEN');
  if (!token) return false;
  try {
    var res = UrlFetchApp.fetch(
      'https://api.github.com/repos/alterigorr/glenheatherween/actions/workflows/flyer.yml/dispatches', {
        method: 'post',
        contentType: 'application/json',
        headers: { Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' },
        payload: JSON.stringify({ ref: 'main' }),
        muteHttpExceptions: true
      });
    if (res.getResponseCode() === 204) return true;
    console.warn('Flyer rebuild request failed: ' + res.getResponseCode() + ' ' + res.getContentText().slice(0, 300));
  } catch (err) {
    console.warn('Flyer rebuild request failed: ' + err);
  }
  return false;
}

/* ------------------------------------------------------------- helpers */

function clean_(d) {
  var num = String(d.num == null ? '' : d.num).replace(/\D/g, '');
  if (!/^\d{1,5}$/.test(num) || Number(num) === 0) return { error: 'Please enter a valid house number.' };
  var street = String(d.street || '');
  if (STREETS.indexOf(street) === -1) return { error: 'Please choose a Glen Heather street.' };

  var kids = Math.floor(Number(d.kids) || 0);
  if (kids < 0) kids = 0;
  if (kids > 20) kids = 20;

  return {
    num: num,
    street: street,
    candy: d.candy === true,
    decorated: d.decorated === true,
    special: d.special === true,
    note: d.special === true ? text_(d.note, 140) : '',
    name: text_(d.name, 40),
    kids: kids,
    keepKids: d.keepKids === true
  };
}

// Trim, collapse whitespace, drop control characters, cap length.
function text_(v, max) {
  return String(v == null ? '' : v)
    .replace(/[\u0000-\u001F\u007F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
}

// Stop anything that looks like a spreadsheet formula from running when organizers open the Sheet.
function safe_(v) {
  return /^[=+\-@]/.test(v) ? "'" + v : v;
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(TAB);
  if (!sheet) {
    sheet = ss.insertSheet(TAB);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight('bold');
  }
  return sheet;
}

function rows_() {
  var values = sheet_().getDataRange().getValues();
  return values.slice(1).filter(function (r) { return r[COL.num] !== '' && r[COL.street] !== ''; });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/**
 * Google can take up to ~20 s to wake this script after a quiet spell. keepWarm runs every
 * 5 minutes to keep it awake and the public house list ready in the cache.
 * Run installKeepWarm once from the editor (select it, click Run, approve) to schedule it.
 */
function keepWarm() {
  CacheService.getScriptCache().put(CACHE_KEY, JSON.stringify(publicData_()), CACHE_SECONDS);
}

function installKeepWarm() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'keepWarm') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('keepWarm').timeBased().everyMinutes(5).create();
  keepWarm();
  console.log('keepWarm scheduled every 5 minutes');
}

/**
 * Run once from the editor (select testGeocode, click Run) to approve the Maps permission
 * and check that an address lands in the neighborhood. Output shows under Execution log.
 */
function testGeocode() {
  console.log(JSON.stringify(geocode_('2112 Kirkland Avenue')));
}

/**
 * Run once from the editor (select testFlyerRebuild, click Run) to approve the "connect to an
 * external service" permission and check the GitHub token. Logs true when GitHub accepted it.
 */
function testFlyerRebuild() {
  console.log('Flyer rebuild started: ' + triggerFlyerRebuild_());
}
