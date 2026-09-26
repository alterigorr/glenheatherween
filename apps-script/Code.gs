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
var CACHE_SECONDS = 30;

function doGet() {
  var cache = CacheService.getScriptCache();
  var hit = cache.get(CACHE_KEY);
  if (hit) return json_(JSON.parse(hit));

  var body = publicData_();
  cache.put(CACHE_KEY, JSON.stringify(body), CACHE_SECONDS);
  return json_(body);
}

function doPost(e) {
  var lock = LockService.getScriptLock();
  try {
    lock.waitLock(15000);
    var payload = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (payload.type !== 'rsvp') return json_({ ok: false, error: 'Unknown request.' });

    var entry = clean_(payload.data || {});
    if (entry.error) return json_({ ok: false, error: entry.error });

    var result = saveRsvp_(entry);
    CacheService.getScriptCache().remove(CACHE_KEY);
    return json_(result);
  } catch (err) {
    console.error(err);
    return json_({ ok: false, error: 'Something went wrong. Please try again.' });
  } finally {
    lock.releaseLock();
  }
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

  return { ok: true, houses: houses, totals: { houses: houses.length, kids: kids } };
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
    if (prev) sheet.deleteRow(rowIndex + 1);
    return { ok: true, removed: !!prev };
  }

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
    entry.kids, lat, lng
  ];

  if (prev) sheet.getRange(rowIndex + 1, 1, 1, row.length).setValues([row]);
  else sheet.appendRow(row);

  return { ok: true, updated: !!prev, mapped: lat !== '' };
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
    kids: kids
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
 * Run once from the editor (select testGeocode, click Run) to approve the Maps permission
 * and check that an address lands in the neighborhood. Output shows under Execution log.
 */
function testGeocode() {
  console.log(JSON.stringify(geocode_('2112 Kirkland Avenue')));
}
