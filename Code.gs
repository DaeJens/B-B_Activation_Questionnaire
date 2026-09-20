/**
 * reHome, Improved quiz: prize backend.
 * Paste into Extensions > Apps Script in the Google Sheet, run setup() once,
 * then Deploy > New deployment > Web app (Execute as: Me, Access: Anyone).
 */
const TOKEN = 'change-me';
const INV = 'Inventory', LOG = 'Log', SET = 'Settings';

// Column layout of the Inventory tab
const COL = { ID: 1, PRIZE: 2, QUOTA: 3, AWARDED: 4, REMAINING: 5 };

/** Run once. Creates the three tabs with starter values. Edit the quotas afterwards. */
function setup() {
  const ss = SpreadsheetApp.getActive();
  const get = n => ss.getSheetByName(n) || ss.insertSheet(n);

  const inv = get(INV);
  if (inv.getLastRow() === 0) {
    inv.getRange(1, 1, 1, 5).setValues([['ID', 'Prize', 'Quota', 'Awarded', 'Remaining']]);
    inv.getRange(2, 1, 5, 3).setValues([
      ['ceiling',   'Painted ceiling: paintbrush',            25],
      ['moulding',  'Picture frame moulding: work gloves',    25],
      ['wallpaper', 'Painted wallpaper: mini paint kit + stencil', 25],
      ['artwork',   'Hang artwork: picture-hanging kit',      25],
      ['bonus',     'Bonus: $100 The Home Depot gift card',   10]
    ]);
    inv.getRange(2, 4, 5, 1).setValue(0);
    for (let r = 2; r <= 6; r++) inv.getRange(r, 5).setFormula('=C' + r + '-D' + r);
    inv.setFrozenRows(1);
    inv.getRange(1, 1, 1, 5).setFontWeight('bold');
  }

  const log = get(LOG);
  if (log.getLastRow() === 0) {
    log.getRange(1, 1, 1, 7).setValues([['Timestamp', 'Request ID', 'Device', 'Answers', 'Ranking', 'Prize', 'Bonus gift card']]);
    log.setFrozenRows(1);
    log.getRange(1, 1, 1, 7).setFontWeight('bold');
  }

  const set = get(SET);
  if (set.getLastRow() === 0) {
    set.getRange(1, 1, 1, 3).setValues([['Setting', 'Value', 'Notes']]);
    set.getRange(2, 1, 1, 3).setValues([[
      'Bonus chance', 0.1,
      'Chance (0 to 1) that a guest also wins the $100 card. Set to 0 to pause, 1 for every guest.'
    ]]);
    set.getRange(1, 1, 1, 3).setFontWeight('bold');
  }
}

function json_(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}

function inventory_() {
  const rows = SpreadsheetApp.getActive().getSheetByName(INV).getDataRange().getValues();
  return rows.slice(1).filter(r => r[0]).map(r => ({ id: r[0], prize: r[1], remaining: r[2] - r[3] }));
}

/** Open the web app URL in a browser to see live counts (and to keep the script warm). */
function doGet(e) {
  if (e && e.parameter && e.parameter.ping) return json_({ ok: true });
  return json_(inventory_());
}

function doPost(e) {
  let body;
  try { body = JSON.parse(e.postData.contents); } catch (err) { return json_({ error: 'bad request' }); }
  if (body.token !== TOKEN) return json_({ error: 'unauthorized' });
  if (!body.requestId || !Array.isArray(body.ranking)) return json_({ error: 'bad request' });

  const cache = CacheService.getScriptCache();
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // A retry of the same request returns the same result instead of awarding twice
    const seen = cache.get('req:' + body.requestId);
    if (seen) return json_(JSON.parse(seen));

    const ss = SpreadsheetApp.getActive();
    const sh = ss.getSheetByName(INV);
    const rows = sh.getDataRange().getValues();
    const left = i => rows[i][COL.QUOTA - 1] - rows[i][COL.AWARDED - 1];
    const find = id => rows.findIndex((r, i) => i > 0 && r[0] === id);

    // Walk the ranking, best match first, and take the first prize still in stock
    let prize = null;
    for (const id of body.ranking) {
      const i = find(id);
      if (i > 0 && left(i) > 0) {
        sh.getRange(i + 1, COL.AWARDED).setValue(rows[i][COL.AWARDED - 1] + 1);
        prize = id;
        break;
      }
    }

    // Bonus $100 gift card: random chance, only alongside a normal prize, only while stocked
    let bonus = false;
    if (prize) {
      const chance = Number(ss.getSheetByName(SET).getRange('B2').getValue()) || 0;
      const b = find('bonus');
      if (b > 0 && left(b) > 0 && Math.random() < chance) {
        sh.getRange(b + 1, COL.AWARDED).setValue(rows[b][COL.AWARDED - 1] + 1);
        bonus = true;
      }
    }

    ss.getSheetByName(LOG).appendRow([
      new Date(), body.requestId, body.device || '',
      (body.answers || []).join(''), body.ranking.join(' > '),
      prize || 'NONE (sold out)', bonus ? 'YES' : ''
    ]);
    SpreadsheetApp.flush();

    const result = { prize: prize, bonus: bonus };
    cache.put('req:' + body.requestId, JSON.stringify(result), 600);
    return json_(result);
  } finally {
    lock.releaseLock();
  }
}
