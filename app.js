/* RES Stock Value Breakdown
 * Upload a StockZure export -> categorise -> dead/slow ageing from history -> Exco Excel workbook.
 * Runs fully in the browser. History and category choices are saved in this browser (localStorage).
 * This tool was developed with the assistance of an AI agent under the direction of qualified RES personnel.
 */
(function () {
  'use strict';

  // ------------------------------------------------------------------ constants
  var STORE_KEY = 'resStockBreakdown.v1';
  var EXCLUDED = 'Excluded (Equipment)';
  var REVIEW = 'Needs Review';

  // name = category name, tab = Excel tab name (max 31 chars, no / \ ? * [ ] :)
  var CATEGORIES = [
    { name: 'PV Modules', tab: 'PV Modules' },
    { name: 'Inverters & Power Conversion', tab: 'Inverters & Power Conv' },
    { name: 'Batteries & Storage', tab: 'Batteries & Storage' },
    { name: 'Mounting & Structure', tab: 'Mounting & Structure' },
    { name: 'Power Cable (AC-DC)', tab: 'Power Cable AC-DC' },
    { name: 'Comms & Data Cable', tab: 'Comms & Data Cable' },
    { name: 'Cable Containment', tab: 'Cable Containment' },
    { name: 'Terminations & Accessories', tab: 'Terminations & Acc' },
    { name: 'Protection & Switchgear', tab: 'Protection & Switchgear' },
    { name: 'Metering, Monitoring & Comms', tab: 'Metering & Monitoring' },
    { name: 'Earthing & Lightning Protection', tab: 'Earthing & LP' },
    { name: 'Lighting & Small Power', tab: 'Lighting & Small Power' },
    { name: 'Fixings & Consumables', tab: 'Fixings & Consumables' },
    { name: 'Signage & Safety', tab: 'Signage & Safety' },
    { name: 'O&M Spares', tab: 'O&M PTA Stock' }
  ];
  var CAT_NAMES = CATEGORIES.map(function (c) { return c.name; });

  // First matching rule wins. Tested against the lower-case description.
  var RULES = [
    ['Signage & Safety', /\bsigns?\b|warning|barrier tape|padlock|lock ?out|first aid|safety/],
    ['Mounting & Structure', /a-frame|mounting set|schletter|2chletter|walk ?way|ampliform|k2 systems|seam ?clamp|clamp elev|hanger bolt|purlin|joiner set|end clamp|mini clamp|mid clamp|craft ?lock|klip ?lok|lintel|top hat|roof hook|roof clamp|pv rail|mounting rail/],
    ['Fixings & Consumables', /^anchor|duracell|energizer/],
    ['Cable Containment', /raymond|cable securing/],
    ['Terminations & Accessories', /\bmc ?4\b/],
    ['Protection & Switchgear', /surge|arrest(o|e)r|overvoltage|^pilot|pilot li|indicator light|push ?button/],
    ['Metering, Monitoring & Comms', /camera|\bnvr\b|hikvision|\bunv\b|cctv|surveillance|hard drive|cerbo|\bgx\b|ccgx|\bvrm\b|battery monitor|smart ?logger|data ?logger|blue logger|communication box|module-mx|meteocontrol|\binterface\b|power link|main link|weather station|irradiance|power meter|energy meter/],
    ['Comms & Data Cable', /ve\.?can|can-bus|ve\.?direct|rj45|\bcat ?[56]e?\b/],
    ['PV Modules', /pv panel|pv module|solar panel|canadian solar|ja solar|jinko|longi|trina/],
    ['Batteries & Storage', /batter|sigenstor|pylontech|\bbms\b|us[23]000/],
    ['Comms & Data Cable', /rs ?485.*(cable|comms)|\bcat ?[56]e?\b|ethernet|fib(er|re)|patch (cord|lead|cable|panel)|rj45|coax|\butp\b|\bftp\b/],
    ['Inverters & Power Conversion', /inverter|^inv\b|multiplus|quattro|mppt|charger|sungrow|sun ?2000|victron|atess|sigen|power supply|\bups\b|step ?down/],
    ['Power Cable (AC-DC)', /^cable\b(?!.*(tray|ladder|tie|clip|saddle|joiner|splic|marker|gland|lug|securing))|pv cable|trailing cable|^cab\b/],
    ['Lighting & Small Power', /multiplug|plug top|plug adaptor|wall socket|socket|schuko|extension lead|\blamps?\b|\bled\b|bulkhead|\blights?\b|tube|motion sensor|\bpir\b|\be27\b|flood/],
    ['Earthing & Lightning Protection', /earth(?!.*leakage)|finial|lightning|aluminium round|down ?conductor/],
    ['Protection & Switchgear', /breaker|fuse|isolat|surge|\bspd\b|overvoltage|changeover|contactor|relay|realy|enclos|\bdb\b|^db|busbar|basbar|bus bar|din rail|selector|^pilot|indicator|push ?button|timer|combiner|motor op|main switch|resistor|insulator|\bmcb\b|kiosk|distribution board|lever/],
    ['Cable Containment', /tray|trunking|conduit|condiont|channel|cabstrut|ladder|cblladder|hanger|beam clip|girder clip|corrugated|unistrut|threaded (bar|rod)|drainex|pipe|saddle|angle (flat )?fitting|tee flat|base plate|extension box|junction box|locking adapter|cantilever|raymond|cable securing|cover clip|wmcc|slide lid box|^box\b/],
    ['Terminations & Accessories', /\blugs?\b|^lug|gland|ferrule|heat ?shrink|shroud|terminal|mc ?4|connector|splic|sleeve|butt|tape|strapping|buckles|label|cable tie|marker|pinch weld|end ?stop/],
    ['Metering, Monitoring & Comms', /\bcts?\b|^ct|meter|janitza|rogowski|monitor|modem|router|antenna|wi-?fi|weather|sensor|\bhub\b|accuenergy|elster|smart|interface|\bcoms?\b|comms|computer|poe|tp.?link|gsm|\b[34]g\b|grandstream|echelon|landis|radiation/],
    ['Fixings & Consumables', /anchor|^m\d+\b|\bnuts?\b|bolt|screw|washer|rivet|\bclip\b|grub|spray|silicone|filler|foam|glue|adhesive|resin|cable clip/]
  ];

  var DEFAULT_SETTINGS = {
    company: 'RHINO ENERGY SOLUTIONS',
    address: 'Warehouse 0026B The Tannery Industrial Park 306 Derdepoort Road  Silverton Pretoria 0184',
    highValue: 5000,
    slowMonths: 6,
    deadMonths: 12
  };

  // Brand colours (ARGB for Excel)
  var X = {
    yellow: 'FFFDDD00', dark: 'FF3F3F40', grey: 'FF9EA0A3', air: 'FFD6D6D6',
    clay: 'FFCC645C', blue: 'FF78A1BB', white: 'FFFFFFFF', zebra: 'FFF5F5F5',
    deadFill: 'FFF6DEDB', slowFill: 'FFFFF4B3', actionFill: 'FFFFFBE0'
  };
  var RAND = '"R"#,##0.00';

  // ------------------------------------------------------------------ state
  var state = {
    settings: Object.assign({}, DEFAULT_SETTINGS),
    overrides: {},  // barcode key -> category name
    history: [],    // [{date, source, lines, value, items:{key: qty}}]
    storageOK: true
  };
  var current = null; // {fileName, date, items:[...]}

  // ------------------------------------------------------------------ storage
  function loadStore() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        state.settings = Object.assign({}, DEFAULT_SETTINGS, s.settings || {});
        state.overrides = s.overrides || {};
        state.history = Array.isArray(s.history) ? s.history : [];
      }
    } catch (e) {
      state.storageOK = false;
    }
  }
  function saveStore() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({
        settings: state.settings, overrides: state.overrides, history: state.history
      }));
      return true;
    } catch (e) {
      state.storageOK = false;
      show($('storageWarn'));
      return false;
    }
  }

  // ------------------------------------------------------------------ helpers
  function $(id) { return document.getElementById(id); }
  function show(el) { el.classList.remove('hidden'); }
  function hide(el) { el.classList.add('hidden'); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function key(barcode) { return String(barcode == null ? '' : barcode).trim().toLowerCase(); }
  function round2(n) { return Math.round(n * 100) / 100; }
  function round3(n) { return Math.round(n * 1000) / 1000; }
  function fmtR(n) {
    var neg = n < 0; n = Math.abs(n || 0);
    var parts = n.toFixed(2).split('.');
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, '\u00a0');
    return (neg ? '-R' : 'R') + parts[0] + ',' + parts[1];
  }
  function fmtQty(n) { return (Math.round(n * 1000) / 1000).toLocaleString('en-ZA'); }
  function pct(a, b) { return b ? (a / b * 100).toFixed(1) + '%' : '0.0%'; }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function parseISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function fmtDate(s) {
    if (!s) return '';
    var d = parseISO(s);
    return d.getDate() + ' ' + ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()] + ' ' + d.getFullYear();
  }
  function monthLabel(s) {
    var d = parseISO(s);
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'][d.getMonth()] + '-' + String(d.getFullYear()).slice(2);
  }
  function excelDate(s) { var p = s.split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  function monthsBetween(a, b) { return (parseISO(b) - parseISO(a)) / (1000 * 60 * 60 * 24 * 30.4375); }
  function dateFromName(name) {
    var m = /(20\d{2})[-_.](\d{2})[-_.](\d{2})/.exec(name || '');
    return m ? m[1] + '-' + m[2] + '-' + m[3] : null;
  }
  function num(v) {
    if (v == null || v === '') return 0;
    if (typeof v === 'number') return isFinite(v) ? v : 0;
    var s = String(v).replace(/[R\s\u00a0]/g, '');
    if (s.indexOf(',') > -1 && s.indexOf('.') === -1) s = s.replace(',', '.');
    else s = s.replace(/,/g, '');
    var n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }
  function cellVal(cell) {
    var v = cell ? cell.value : null;
    if (v == null) return null;
    if (typeof v === 'object') {
      if (v instanceof Date) return v;
      if (v.richText) return v.richText.map(function (t) { return t.text; }).join('');
      if (Object.prototype.hasOwnProperty.call(v, 'result')) return v.result;
      if (Object.prototype.hasOwnProperty.call(v, 'text')) return v.text;
      if (v.error) return null;
      return null;
    }
    return v;
  }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function notice(el, cls, html) { el.innerHTML = '<div class="notice ' + cls + '">' + html + '</div>'; }

  // ------------------------------------------------------------------ categorise
  function isEquipment(desc, notes, shelf) {
    var d = desc.toLowerCase(), n = notes.toLowerCase(), s = shelf.toLowerCase();
    if (/^equipment\b/.test(d) || /^equipment\b/.test(n)) return true;
    if (/tester|tool panel|multimeter|insulation tester|\bmegger\b/.test(d)) return true;
    if (s.indexOf('equipment') > -1 && !/tape|sign/.test(d)) return true;
    return false;
  }
  function isOandM(desc, notes, shelf) {
    var re = /o\s?&\s?m\b|o\s?and\s?m\b/i;
    return re.test(shelf) || re.test(notes) || re.test(desc);
  }
  function autoCategory(it) {
    if (isEquipment(it.desc, it.notes, it.shelf)) return EXCLUDED;
    if (isOandM(it.desc, it.notes, it.shelf)) return 'O&M Spares';
    var d = it.desc.toLowerCase();
    for (var i = 0; i < RULES.length; i++) if (RULES[i][1].test(d)) return RULES[i][0];
    return REVIEW;
  }
  function categorise(items) {
    items.forEach(function (it) {
      it.autoCat = autoCategory(it);
      var o = state.overrides[it.k];
      it.cat = (o && (CAT_NAMES.indexOf(o) > -1 || o === EXCLUDED)) ? o : it.autoCat;
      it.manual = !!o;
    });
  }

  // ------------------------------------------------------------------ read Excel
  function findHeader(ws) {
    var max = Math.min(ws.rowCount, 40);
    for (var r = 1; r <= max; r++) {
      var row = ws.getRow(r), map = {};
      row.eachCell({ includeEmpty: false }, function (cell, col) {
        var t = str(cellVal(cell)).toLowerCase();
        if (!t) return;
        if (t === 'barcode' || t === 'bar code' || t === 'item code') map.barcode = col;
        else if (t.indexOf('description') > -1) map.desc = col;
        else if (t.indexOf('qty in stock') > -1 || (t.indexOf('qty') > -1 && t.indexOf('stock') > -1) || t === 'quantity') map.qty = col;
        else if (t === 'notes' || t === 'note') map.notes = col;
        else if (t.indexOf('price') > -1) map.price = col;
        else if (t.indexOf('total') > -1) map.total = col;
        else if (t.indexOf('shelf') > -1) map.shelf = col;
      });
      if (map.barcode && map.desc && map.qty) return { row: r, map: map };
    }
    return null;
  }
  function readWorkbook(buffer) {
    var wb = new ExcelJS.Workbook();
    return wb.xlsx.load(buffer).then(function () {
      var sheets = wb.worksheets.slice();
      // prefer a "Data" or "Current Stock" sheet, but never a CPT one
      sheets.sort(function (a, b) {
        function score(ws) {
          var n = ws.name.toLowerCase();
          if (n.indexOf('cpt') > -1) return 9;
          if (n === 'data' || n.indexOf('pta current') > -1) return 0;
          if (n.indexOf('current') > -1) return 1;
          return 5;
        }
        return score(a) - score(b);
      });
      for (var i = 0; i < sheets.length; i++) {
        var ws = sheets[i], h = findHeader(ws);
        if (!h) continue;
        var items = [];
        for (var r = h.row + 1; r <= ws.rowCount; r++) {
          var row = ws.getRow(r);
          var g = function (c) { return c ? cellVal(row.getCell(c)) : null; };
          var barcode = str(g(h.map.barcode)), desc = str(g(h.map.desc));
          if (!barcode && !desc) continue;
          var qty = num(g(h.map.qty)), price = num(g(h.map.price));
          items.push({
            row: r, barcode: barcode, k: key(barcode), desc: desc,
            shelf: str(g(h.map.shelf)), notes: str(g(h.map.notes)),
            qty: round3(qty), price: round2(price), total: round2(qty * price)
          });
        }
        if (items.length) return { sheet: ws.name, items: items, hasPrice: !!h.map.price };
      }
      throw new Error('Could not find the stock table. The sheet needs headings for Barcode, Description and Qty In Stock.');
    });
  }

  // ------------------------------------------------------------------ history & ageing
  function snapshotFrom(items, date, source) {
    var map = {}, lines = 0, value = 0;
    items.forEach(function (it) {
      if (!it.k) return;
      map[it.k] = round3((map[it.k] || 0) + it.qty);
      if (it.cat !== EXCLUDED) value += it.total;
    });
    Object.keys(map).forEach(function (k) { if (map[k] <= 0) delete map[k]; else lines++; });
    return { date: date, source: source, lines: lines, value: round2(value), items: map };
  }
  function putSnapshot(snap) {
    state.history = state.history.filter(function (s) { return s.date !== snap.date; });
    state.history.push(snap);
    state.history.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    saveStore();
  }
  function priorSnapshots(date) {
    return state.history.filter(function (s) { return s.date < date; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; }); // newest first
  }
  function computeAgeing(items, date) {
    var prior = priorSnapshots(date);
    // total qty per barcode in the current file (duplicate barcodes added together)
    var qtyByKey = {};
    items.forEach(function (it) { if (it.k) qtyByKey[it.k] = round3((qtyByKey[it.k] || 0) + it.qty); });
    var S = state.settings;
    items.forEach(function (it) {
      it.since = null; it.months = null; it.status = 'Active';
      if (it.qty <= 0) { it.status = ''; return; }
      if (!prior.length || !it.k) { it.status = 'No history'; return; }
      var q = qtyByKey[it.k];
      for (var i = 0; i < prior.length; i++) {
        if (round3(prior[i].items[it.k] || 0) === q) it.since = prior[i].date; else break;
      }
      if (it.since) {
        it.months = monthsBetween(it.since, date);
        if (it.months >= S.deadMonths) it.status = 'Dead';
        else if (it.months >= S.slowMonths) it.status = 'Slow';
      }
    });
    return prior;
  }

  // ------------------------------------------------------------------ analysis
  function analyse() {
    var items = current.items, S = state.settings;
    categorise(items);
    var prior = computeAgeing(items, current.date);
    var inStock = items.filter(function (it) { return it.qty > 0 && it.cat !== EXCLUDED; });
    var a = {
      prior: prior,
      inStock: inStock,
      total: 0,
      byCat: {},
      excluded: items.filter(function (it) { return it.cat === EXCLUDED; }),
      review: inStock.filter(function (it) { return it.cat === REVIEW; }),
      high: inStock.filter(function (it) { return it.price >= S.highValue; }),
      dead: inStock.filter(function (it) { return it.status === 'Dead'; }),
      slow: inStock.filter(function (it) { return it.status === 'Slow'; }),
      zeroPrice: inStock.filter(function (it) { return it.price === 0; }),
      dupes: [],
      noBarcode: items.filter(function (it) { return !it.k; })
    };
    CAT_NAMES.concat([REVIEW]).forEach(function (c) { a.byCat[c] = { lines: 0, value: 0, slow: 0, dead: 0, items: [] }; });
    inStock.forEach(function (it) {
      var b = a.byCat[it.cat];
      b.lines++; b.value += it.total; b.items.push(it);
      if (it.status === 'Dead') b.dead += it.total;
      if (it.status === 'Slow') b.slow += it.total;
      a.total += it.total;
    });
    var seen = {};
    items.forEach(function (it) { if (it.k) (seen[it.k] = seen[it.k] || []).push(it); });
    Object.keys(seen).forEach(function (k) {
      var g = seen[k];
      if (g.length > 1 && g.some(function (x) { return x.qty > 0; })) a.dupes = a.dupes.concat(g);
    });
    a.sum = function (arr) { return arr.reduce(function (s, it) { return s + it.total; }, 0); };
    return a;
  }

  // ------------------------------------------------------------------ render
  var A = null;
  function renderAll() {
    A = analyse();
    renderStats(); renderReview(); renderCats(); renderDead(); renderHistory();
  }
  function stat(v, l, cls) { return '<div class="stat ' + (cls || '') + '"><div class="v">' + v + '</div><div class="l">' + l + '</div></div>'; }
  function renderStats() {
    var exVal = A.sum(A.excluded.filter(function (i) { return i.qty > 0; }));
    $('stats').innerHTML =
      stat(fmtR(A.total), 'Total current stock value', 'yellow') +
      stat(A.inStock.length, 'Lines with stock') +
      stat(fmtR(A.sum(A.dead) + A.sum(A.slow)), 'Dead + slow stock value', 'clay') +
      stat(fmtR(A.sum(A.high)), 'High value items (' + A.high.length + ')') +
      stat(fmtR(exVal), 'Equipment left out (' + A.excluded.filter(function (i) { return i.qty > 0; }).length + ')', 'grey');
    var rn = $('reviewNotice');
    if (A.review.length) notice(rn, 'warn', '<strong>' + A.review.length + ' item(s) need a category</strong> (' + fmtR(A.sum(A.review)) + '). Pick one in step 3. If you leave them, they go on a "Needs Review" tab.');
    else notice(rn, 'ok', 'All items with stock have a category.');
  }
  function catOptions(sel) {
    var opts = CAT_NAMES.concat([EXCLUDED]);
    var h = sel === REVIEW ? '<option value="" selected>\u2014 choose category \u2014</option>' : '';
    opts.forEach(function (c) { h += '<option' + (c === sel ? ' selected' : '') + '>' + esc(c) + '</option>'; });
    return h;
  }
  function renderReviewFilter() {
    var f = $('reviewFilter'), cur = f.value || REVIEW;
    var h = '<option value="' + REVIEW + '">Needs Review</option><option value="__all">All items with stock</option><option value="__manual">My category choices</option><option value="' + EXCLUDED + '">Excluded (Equipment)</option>';
    CAT_NAMES.forEach(function (c) { h += '<option value="' + esc(c) + '">' + esc(c) + '</option>'; });
    f.innerHTML = h; f.value = cur;
  }
  function renderReview() {
    var f = $('reviewFilter').value || REVIEW, q = $('reviewSearch').value.trim().toLowerCase();
    var list = current.items.filter(function (it) {
      if (f === EXCLUDED) { if (it.cat !== EXCLUDED) return false; }
      else if (it.qty <= 0) return false;
      else if (f === '__all') { /* all */ }
      else if (f === '__manual') { if (!it.manual) return false; }
      else if (it.cat !== f) return false;
      if (q && (it.barcode + ' ' + it.desc).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var h = '<thead><tr><th>Barcode</th><th>Description</th><th class="num">Qty</th><th class="num">Value</th><th>Category</th></tr></thead><tbody>';
    list.slice(0, 400).forEach(function (it) {
      h += '<tr data-row="' + it.row + '"' + (it.manual ? ' class="changed"' : '') + '><td>' + esc(it.barcode) + '</td><td>' + esc(it.desc) + '</td><td class="num">' + fmtQty(it.qty) + '</td><td class="num">' + fmtR(it.total) +
        '</td><td><select class="cat" data-k="' + esc(it.k) + '">' + catOptions(it.cat) + '</select></td></tr>';
    });
    if (!list.length) h += '<tr><td colspan="5" class="muted">Nothing to show.</td></tr>';
    $('reviewTable').innerHTML = h + '</tbody>';
    $('reviewCount').textContent = list.length > 400 ? 'Showing first 400 of ' + list.length + ' \u2014 use search to narrow down.' : list.length + ' item(s).';
  }
  function renderCats() {
    var h = '<thead><tr><th>Category</th><th class="num">Lines</th><th class="num">Value</th><th class="num">%</th><th class="num">Slow</th><th class="num">Dead</th></tr></thead><tbody>';
    var rows = CAT_NAMES.concat([REVIEW]).map(function (c) { return [c, A.byCat[c]]; })
      .filter(function (r) { return r[1].lines > 0; })
      .sort(function (a, b) { return b[1].value - a[1].value; });
    rows.forEach(function (r) {
      h += '<tr><td>' + esc(r[0]) + '</td><td class="num">' + r[1].lines + '</td><td class="num">' + fmtR(r[1].value) + '</td><td class="num">' + pct(r[1].value, A.total) +
        '</td><td class="num">' + fmtR(r[1].slow) + '</td><td class="num">' + fmtR(r[1].dead) + '</td></tr>';
    });
    h += '<tr class="total"><td>Total</td><td class="num">' + A.inStock.length + '</td><td class="num">' + fmtR(A.total) + '</td><td class="num">100%</td><td class="num">' + fmtR(A.sum(A.slow)) + '</td><td class="num">' + fmtR(A.sum(A.dead)) + '</td></tr>';
    $('catTable').innerHTML = h + '</tbody>';
  }
  function renderDead() {
    var S = state.settings;
    if (!A.prior.length) {
      $('ageInfo').innerHTML = 'No earlier history before ' + fmtDate(current.date) + ', so stock age can\'t be worked out yet.';
    } else {
      $('ageInfo').innerHTML = 'Compared with ' + A.prior.length + ' earlier stock list(s), back to ' + fmtDate(A.prior[A.prior.length - 1].date) +
        '. <strong>Slow</strong> = exact same quantity for ' + S.slowMonths + '+ months. <strong>Dead</strong> = same quantity for ' + S.deadMonths + '+ months.';
    }
    var active = A.inStock.filter(function (i) { return i.status === 'Active' || i.status === 'No history'; });
    $('ageStats').innerHTML = stat(fmtR(A.sum(A.dead)), 'Dead: ' + A.dead.length + ' lines', 'clay') +
      stat(fmtR(A.sum(A.slow)), 'Slow: ' + A.slow.length + ' lines', 'yellow') +
      stat(fmtR(A.sum(active)), 'Moving / newer: ' + active.length + ' lines');
    var list = deadSlowSorted();
    var h = '<thead><tr><th>Status</th><th>Description</th><th>Category</th><th class="num">Qty</th><th class="num">Value</th><th>Unchanged since</th><th>Notes</th></tr></thead><tbody>';
    list.forEach(function (it) {
      h += '<tr><td><span class="pill ' + it.status + '">' + it.status + '</span></td><td>' + esc(it.desc) + '</td><td>' + esc(it.cat) + '</td><td class="num">' + fmtQty(it.qty) + '</td><td class="num">' + fmtR(it.total) +
        '</td><td>' + fmtDate(it.since) + ' (' + Math.floor(it.months) + ' mo)</td><td>' + esc(it.notes) + '</td></tr>';
    });
    if (!list.length) h += '<tr><td colspan="7" class="muted">No dead or slow stock found.</td></tr>';
    $('deadTable').innerHTML = h + '</tbody>';
  }
  function deadSlowSorted() {
    return A.dead.concat(A.slow).sort(function (a, b) {
      if (a.status !== b.status) return a.status === 'Dead' ? -1 : 1;
      return b.total - a.total;
    });
  }
  function renderHistory() {
    var h = '<thead><tr><th>Stock date</th><th>Source</th><th class="num">Lines with stock</th><th class="num">Value</th><th></th></tr></thead><tbody>';
    state.history.slice().reverse().forEach(function (s) {
      h += '<tr><td>' + fmtDate(s.date) + '</td><td>' + esc(s.source) + '</td><td class="num">' + s.lines + '</td><td class="num">' + fmtR(s.value) +
        '</td><td><button class="btn small danger" data-del="' + s.date + '">Remove</button></td></tr>';
    });
    if (!state.history.length) h += '<tr><td colspan="5" class="muted">No history yet. First time on this device? Tap <strong>Restore backup</strong> and choose the starting-point history file (Jan + Jun 2025).</td></tr>';
    $('histTable').innerHTML = h + '</tbody>';
  }
  function renderSettings() {
    var S = state.settings;
    $('setHigh').value = S.highValue; $('setSlow').value = S.slowMonths; $('setDead').value = S.deadMonths; $('setAddress').value = S.address;
  }

  // ------------------------------------------------------------------ Excel output
  function headerBlock(ws, title, total, nCols, dateISO) {
    var S = state.settings;
    ws.getCell(1, 2).value = S.company;
    ws.getCell(1, 2).font = { bold: true, size: 16, color: { argb: X.dark } };
    ws.getCell(2, nCols - 1).value = 'TOTAL VALUE';
    ws.getCell(2, nCols - 1).alignment = { horizontal: 'right' };
    ws.getCell(2, nCols - 1).font = { bold: true, size: 11 };
    var tc = ws.getCell(2, nCols);
    tc.value = total; tc.numFmt = RAND;
    tc.font = { bold: true, size: 12, color: { argb: X.dark } };
    tc.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X.yellow } };
    tc.alignment = { horizontal: 'right' };
    ws.getCell(3, 2).value = title;
    ws.getCell(3, 2).font = { bold: true, size: 13 };
    ws.getCell(4, 2).value = S.address;
    ws.getCell(4, 2).font = { size: 11 };
    ws.getCell(5, 2).value = monthLabel(dateISO) + '   (stock date ' + fmtDate(dateISO) + ')';
    ws.getCell(5, 2).font = { bold: true, size: 13 };
    ws.getRow(1).height = 22;
  }
  function tableHeader(ws, rowNo, headers, startCol) {
    var row = ws.getRow(rowNo), s0 = startCol || 1;
    headers.forEach(function (h, i) {
      var c = row.getCell(i + s0);
      c.value = h;
      c.font = { bold: true, color: { argb: X.white } };
      c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X.dark } };
      c.alignment = { vertical: 'middle', wrapText: true };
      c.border = { bottom: { style: 'thin', color: { argb: X.yellow } } };
    });
    row.height = 20;
  }
  function zebra(row, nCols, i) {
    if (i % 2) for (var c = 1; c <= nCols; c++) row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X.zebra } };
  }
  function totalRow(ws, rowNo, nCols, label, sumCols, firstData, lastData) {
    var row = ws.getRow(rowNo);
    row.getCell(2).value = label;
    sumCols.forEach(function (sc) {
      var col = sc.col, L = ws.getColumn(col).letter;
      row.getCell(col).value = { formula: 'SUBTOTAL(9,' + L + firstData + ':' + L + lastData + ')', result: sc.result };
      row.getCell(col).numFmt = RAND;
    });
    for (var c = 1; c <= nCols; c++) {
      var cell = row.getCell(c);
      cell.font = { bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X.air } };
      cell.border = { top: { style: 'thin', color: { argb: X.dark } } };
    }
  }
  var STOCK_HEADERS = ['Barcode', 'Description', 'Qty In Stock', 'Notes', 'Purch. Price', 'Total Replacement Value', 'Category'];
  function stockSheet(wb, name, title, list, tabColor, withCategory) {
    var headers = withCategory ? STOCK_HEADERS : STOCK_HEADERS.slice(0, 6);
    var n = headers.length;
    var ws = wb.addWorksheet(name, { properties: { tabColor: { argb: tabColor || X.blue } }, views: [{ state: 'frozen', ySplit: 7 }] });
    var widths = [24, 58, 13, 30, 15, 22, 28];
    for (var i = 0; i < n; i++) ws.getColumn(i + 1).width = widths[i];
    var total = list.reduce(function (s, it) { return s + it.total; }, 0);
    headerBlock(ws, title, round2(total), n, current.date);
    tableHeader(ws, 7, headers);
    list.forEach(function (it, idx) {
      var vals = [it.barcode, it.desc, it.qty, it.notes, it.price, it.total];
      if (withCategory) vals.push(it.cat);
      var row = ws.getRow(8 + idx);
      vals.forEach(function (v, c) { row.getCell(c + 1).value = v; });
      row.getCell(5).numFmt = RAND; row.getCell(6).numFmt = RAND;
      zebra(row, n, idx);
    });
    var last = 7 + list.length;
    if (list.length) {
      ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: last, column: n } };
      totalRow(ws, last + 2, n, 'TOTAL', [{ col: 6, result: round2(total) }], 8, last);
      ws.getCell(2, n).value = { formula: ws.getColumn(6).letter + (last + 2), result: round2(total) };
    }
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };
    return ws;
  }
  function byDesc(a, b) { return a.desc.localeCompare(b.desc); }

  function buildWorkbook() {
    var S = state.settings, wb = new ExcelJS.Workbook();
    wb.creator = 'RES Stock Breakdown app'; wb.created = new Date();
    var nonExcluded = current.items.filter(function (it) { return it.cat !== EXCLUDED; });

    // ---------- SUMMARY
    var ws = wb.addWorksheet('SUMMARY', { properties: { tabColor: { argb: X.yellow } } });
    [4, 40, 14, 22, 12, 20, 20].forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
    headerBlock(ws, 'CURRENT STOCK HOLDING \u2014 VALUE BREAKDOWN', round2(A.total), 7, current.date);
    var r = 7;
    tableHeader(ws, r, ['Category', 'Lines in stock', 'Stock value', '% of total', 'of which Slow', 'of which Dead'], 2);
    var rows = CAT_NAMES.concat([REVIEW]).map(function (c) { return [c, A.byCat[c]]; })
      .filter(function (x) { return x[1].lines > 0; })
      .sort(function (a, b) { return b[1].value - a[1].value; });
    var first = r + 1;
    rows.forEach(function (x, i) {
      var row = ws.getRow(first + i);
      row.getCell(2).value = x[0];
      row.getCell(3).value = x[1].lines;
      row.getCell(4).value = round2(x[1].value); row.getCell(4).numFmt = RAND;
      row.getCell(5).value = A.total ? x[1].value / A.total : 0; row.getCell(5).numFmt = '0.0%';
      row.getCell(6).value = round2(x[1].slow); row.getCell(6).numFmt = RAND;
      row.getCell(7).value = round2(x[1].dead); row.getCell(7).numFmt = RAND;
      for (var c = 2; c <= 7; c++) if (i % 2) row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X.zebra } };
    });
    var lastCat = first + rows.length - 1;
    var tr = ws.getRow(lastCat + 1);
    tr.getCell(2).value = 'TOTAL CURRENT STOCK VALUE';
    tr.getCell(3).value = { formula: 'SUM(C' + first + ':C' + lastCat + ')', result: A.inStock.length };
    tr.getCell(4).value = { formula: 'SUM(D' + first + ':D' + lastCat + ')', result: round2(A.total) }; tr.getCell(4).numFmt = RAND;
    tr.getCell(5).value = 1; tr.getCell(5).numFmt = '0.0%';
    tr.getCell(6).value = { formula: 'SUM(F' + first + ':F' + lastCat + ')', result: round2(A.sum(A.slow)) }; tr.getCell(6).numFmt = RAND;
    tr.getCell(7).value = { formula: 'SUM(G' + first + ':G' + lastCat + ')', result: round2(A.sum(A.dead)) }; tr.getCell(7).numFmt = RAND;
    for (var c2 = 2; c2 <= 7; c2++) {
      tr.getCell(c2).font = { bold: true };
      tr.getCell(c2).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X.yellow } };
      tr.getCell(c2).border = { top: { style: 'thin', color: { argb: X.dark } } };
    }
    ws.getCell(2, 7).value = { formula: 'D' + (lastCat + 1), result: round2(A.total) };

    // stock age block
    r = lastCat + 3;
    tableHeader(ws, r, ['Stock age (from history)', 'Lines', 'Value', '% of total'], 2);
    var active = A.inStock.filter(function (i) { return i.status === 'Active' || i.status === 'No history'; });
    [['Dead \u2014 same qty ' + S.deadMonths + '+ months', A.dead, X.deadFill],
     ['Slow \u2014 same qty ' + S.slowMonths + '\u2013' + S.deadMonths + ' months', A.slow, X.slowFill],
     ['Moving / newer stock', active, null]].forEach(function (x, i) {
      var row = ws.getRow(r + 1 + i), v = A.sum(x[1]);
      row.getCell(2).value = x[0]; row.getCell(3).value = x[1].length;
      row.getCell(4).value = round2(v); row.getCell(4).numFmt = RAND;
      row.getCell(5).value = A.total ? v / A.total : 0; row.getCell(5).numFmt = '0.0%';
      if (x[2]) for (var c = 2; c <= 5; c++) row.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: x[2] } };
    });
    r = r + 5;
    var exIn = A.excluded.filter(function (i) { return i.qty > 0; });
    var info = [
      ['High value items (unit price from ' + fmtR(S.highValue) + ')', A.high.length, A.sum(A.high), 'See tab "PTA HIGH Value"'],
      ['Equipment / tools left out of stock value', exIn.length, A.sum(exIn), 'Not included in the total above'],
      ['Items still needing a category', A.review.length, A.sum(A.review), A.review.length ? 'See tab "Needs Review"' : '\u2014'],
      ['Items with stock but R0 price', A.zeroPrice.length, 0, A.zeroPrice.length ? 'See tab "Data Checks"' : '\u2014']
    ];
    tableHeader(ws, r, ['Other information', 'Lines', 'Value', 'Comment'], 2);
    ws.mergeCells(r, 5, r, 7);
    info.forEach(function (x, i) {
      var row = ws.getRow(r + 1 + i);
      row.getCell(2).value = x[0]; row.getCell(3).value = x[1];
      row.getCell(4).value = round2(x[2]); row.getCell(4).numFmt = RAND;
      row.getCell(5).value = x[3];
      ws.mergeCells(r + 1 + i, 5, r + 1 + i, 7);
    });
    r = r + info.length + 2;
    var hist = A.prior.length ? 'Stock age compares this list with ' + A.prior.length + ' earlier StockZure list(s) going back to ' + fmtDate(A.prior[A.prior.length - 1].date) + '. An item is Slow/Dead when its quantity has stayed exactly the same over that period.' :
      'No earlier stock lists in history yet, so stock age could not be worked out.';
    var notes = [
      hist,
      'Stock values = Qty In Stock \u00d7 Purch. Price from StockZure. Write-downs or disposals of dead stock must be approved by Finance (CA(SA)) before processing.',
      'Report generated ' + fmtDate(todayISO()) + ' from file "' + current.fileName + '".',
      'This document was developed with the assistance of an AI agent under the direction of qualified RES personnel.'
    ];
    notes.forEach(function (t, i) {
      var c = ws.getCell(r + i, 2); c.value = t;
      c.font = { italic: true, size: 9, color: { argb: 'FF555555' } };
      ws.mergeCells(r + i, 2, r + i, 7);
      c.alignment = { wrapText: true, vertical: 'top' };
      ws.getRow(r + i).height = 26;
    });
    ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };

    // ---------- PTA Current Stock (all lines, as in StockZure, equipment left out)
    stockSheet(wb, 'PTA Current Stock', 'CURRENT STOCK HOLDING', nonExcluded, X.blue, true);

    // ---------- one tab per category
    CATEGORIES.forEach(function (c) {
      var b = A.byCat[c.name];
      if (!b.lines) return;
      stockSheet(wb, c.tab, c.name.toUpperCase(), b.items.slice().sort(byDesc), X.grey, false);
    });
    if (A.byCat[REVIEW].lines) stockSheet(wb, 'Needs Review', 'NEEDS REVIEW \u2014 NO CATEGORY YET', A.byCat[REVIEW].items.slice().sort(byDesc), X.clay, false);

    // ---------- PTA HIGH Value
    stockSheet(wb, 'PTA HIGH Value', 'HIGH VALUE ITEMS \u2014 UNIT PRICE FROM ' + fmtR(S.highValue).replace(/\u00a0/g, ' '),
      A.high.slice().sort(function (a, b) { return b.price - a.price; }), X.yellow, true);

    // ---------- Dead & Slow Stock
    var dsHeaders = ['Barcode', 'Description', 'Category', 'Qty In Stock', 'Purch. Price', 'Total Replacement Value', 'Notes', 'Qty unchanged since', 'Months', 'Status', 'Site return?', 'Action', 'Comments'];
    var nD = dsHeaders.length;
    var wd = wb.addWorksheet('Dead & Slow Stock', { properties: { tabColor: { argb: X.clay } }, views: [{ state: 'frozen', ySplit: 7 }] });
    [22, 50, 26, 12, 14, 20, 26, 16, 9, 9, 11, 20, 34].forEach(function (w, i) { wd.getColumn(i + 1).width = w; });
    var ds = deadSlowSorted(), dsTotal = A.sum(ds);
    headerBlock(wd, 'DEAD & SLOW STOCK \u2014 FOR DISPOSAL DECISION', round2(dsTotal), nD, current.date);
    tableHeader(wd, 7, dsHeaders);
    wd.getRow(7).getCell(12).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X.yellow } };
    wd.getRow(7).getCell(12).font = { bold: true, color: { argb: X.dark } };
    ds.forEach(function (it, i) {
      var row = wd.getRow(8 + i);
      var vals = [it.barcode, it.desc, it.cat, it.qty, it.price, it.total, it.notes, it.since ? excelDate(it.since) : '', Math.floor(it.months), it.status,
        /return/i.test(it.notes) ? 'Yes' : '', '', ''];
      vals.forEach(function (v, c) { row.getCell(c + 1).value = v; });
      row.getCell(5).numFmt = RAND; row.getCell(6).numFmt = RAND; row.getCell(8).numFmt = 'dd mmm yyyy';
      var fill = it.status === 'Dead' ? X.deadFill : X.slowFill;
      row.getCell(10).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: fill } };
      row.getCell(12).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: X.actionFill } };
      row.getCell(12).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Use on project,Return to supplier,Sell,Transfer to CPT,Write off,Keep"'] };
      row.getCell(12).border = { left: { style: 'thin', color: { argb: X.grey } }, right: { style: 'thin', color: { argb: X.grey } }, bottom: { style: 'hair', color: { argb: X.grey } } };
    });
    var lastD = 7 + ds.length;
    if (ds.length) {
      wd.autoFilter = { from: { row: 7, column: 1 }, to: { row: lastD, column: nD } };
      totalRow(wd, lastD + 2, nD, 'TOTAL', [{ col: 6, result: round2(dsTotal) }], 8, lastD);
      wd.getCell(2, nD).value = { formula: 'F' + (lastD + 2), result: round2(dsTotal) };
    } else {
      wd.getCell(8, 2).value = 'No dead or slow stock found for this stock date.';
    }
    wd.getCell(6, 2).value = 'Dead = same qty ' + S.deadMonths + '+ months \u00b7 Slow = same qty ' + S.slowMonths + '+ months \u00b7 Choose an Action per line (dropdown).';
    wd.getCell(6, 2).font = { italic: true, size: 9, color: { argb: 'FF555555' } };
    wd.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };

    // ---------- Data Checks
    var wc = wb.addWorksheet('Data Checks', { properties: { tabColor: { argb: X.dark } }, views: [{ state: 'frozen', ySplit: 7 }] });
    [34, 24, 52, 12, 16, 40].forEach(function (w, i) { wc.getColumn(i + 1).width = w; });
    var checks = [];
    A.zeroPrice.forEach(function (it) { checks.push(['Stock but R0 price \u2014 fix price in StockZure', it.barcode, it.desc, it.qty, it.total, it.notes]); });
    A.dupes.forEach(function (it) { checks.push(['Barcode used on more than one line \u2014 merge in StockZure', it.barcode, it.desc, it.qty, it.total, it.shelf]); });
    A.noBarcode.forEach(function (it) { checks.push(['No barcode', it.barcode, it.desc, it.qty, it.total, '']); });
    A.excluded.forEach(function (it) { checks.push(['Equipment / tool \u2014 left out of stock value', it.barcode, it.desc, it.qty, it.total, it.notes]); });
    headerBlock(wc, 'DATA CHECKS \u2014 ITEMS TO TIDY UP IN STOCKZURE', checks.length, 6, current.date);
    wc.getCell(2, 5).value = 'ITEMS TO CHECK'; wc.getCell(2, 6).numFmt = '0';
    tableHeader(wc, 7, ['Check', 'Barcode', 'Description', 'Qty In Stock', 'Value', 'Notes / Shelf']);
    checks.forEach(function (x, i) {
      var row = wc.getRow(8 + i);
      x.forEach(function (v, c) { row.getCell(c + 1).value = v; });
      row.getCell(5).numFmt = RAND;
      zebra(row, 6, i);
    });
    if (!checks.length) wc.getCell(8, 1).value = 'No data problems found.';
    else wc.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7 + checks.length, column: 6 } };

    return wb;
  }

  // ------------------------------------------------------------------ actions
  function handleFile(file) {
    if (!file) return;
    if (!/\.xlsx$/i.test(file.name)) { notice($('parseMsg'), 'err', 'Please choose an .xlsx Excel file.'); return; }
    notice($('parseMsg'), 'warn', 'Reading ' + esc(file.name) + '\u2026');
    file.arrayBuffer().then(readWorkbook).then(function (res) {
      var d = dateFromName(file.name) || todayISO();
      $('reportDate').value = d;
      current = { fileName: file.name, date: d, items: res.items, sheet: res.sheet };
      $('fileInfo').innerHTML = '<strong>' + esc(file.name) + '</strong><br>Sheet "' + esc(res.sheet) + '" \u00b7 ' + res.items.length + ' lines' +
        (dateFromName(file.name) ? '' : '<br>Date not found in file name \u2014 check the stock date.');
      $('parseMsg').innerHTML = '';
      $('genMsg').innerHTML = '';
      renderReviewFilter();
      renderAll();
      show($('results'));
    }).catch(function (e) {
      notice($('parseMsg'), 'err', 'Could not read this file: ' + esc(e.message || e));
    });
  }

  function generate() {
    if (!current) return;
    var btn = $('btnGenerate');
    btn.disabled = true; btn.textContent = 'Building\u2026';
    setTimeout(function () {
      try {
        renderAll();
        var wb = buildWorkbook();
        wb.xlsx.writeBuffer().then(function (buf) {
          var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
          var name = 'RES PTA Stock Breakdown ' + current.date + '.xlsx';
          var a = document.createElement('a');
          a.href = URL.createObjectURL(blob); a.download = name;
          document.body.appendChild(a); a.click();
          setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
          putSnapshot(snapshotFrom(current.items, current.date, 'Weekly report: ' + current.fileName));
          renderHistory();
          notice($('genMsg'), 'ok', 'Downloaded <strong>' + esc(name) + '</strong>. This week (' + fmtDate(current.date) + ') is saved to history.' +
            (state.storageOK ? '' : ' <br><strong>Warning:</strong> history could not be saved in this browser.'));
        }).catch(function (e) {
          notice($('genMsg'), 'err', 'Could not build the Excel file: ' + esc(e.message || e));
        }).then(function () { btn.disabled = false; btn.textContent = 'Download Exco Excel'; });
      } catch (e) {
        notice($('genMsg'), 'err', 'Could not build the Excel file: ' + esc(e.message || e));
        btn.disabled = false; btn.textContent = 'Download Exco Excel';
      }
    }, 30);
  }

  function addOldExport(file) {
    var d = $('oldDate').value || dateFromName(file.name);
    if (!d) { notice($('oldMsg'), 'err', 'Choose the date of that export first.'); $('oldInput').value = ''; return; }
    notice($('oldMsg'), 'warn', 'Reading\u2026');
    file.arrayBuffer().then(readWorkbook).then(function (res) {
      categorise(res.items);
      var exists = state.history.some(function (s) { return s.date === d; });
      if (exists && !window.confirm('There is already a stock list for ' + fmtDate(d) + ' in history. Replace it?')) { $('oldMsg').innerHTML = ''; return; }
      putSnapshot(snapshotFrom(res.items, d, 'Older export: ' + file.name));
      notice($('oldMsg'), 'ok', 'Added ' + fmtDate(d) + ' to history.');
      renderHistory();
      if (current) renderAll();
    }).catch(function (e) {
      notice($('oldMsg'), 'err', 'Could not read this file: ' + esc(e.message || e));
    }).then(function () { $('oldInput').value = ''; });
  }

  function downloadBackup() {
    var data = { app: 'res-stock-breakdown', version: 1, exported: new Date().toISOString(), settings: state.settings, overrides: state.overrides, history: state.history };
    var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'RES stock breakdown backup ' + todayISO() + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function restoreBackup(file) {
    file.text().then(function (t) {
      var d = JSON.parse(t);
      if (d.app !== 'res-stock-breakdown' || !Array.isArray(d.history)) throw new Error('This is not a Stock Breakdown backup file.');
      if (!window.confirm('Replace the history and category choices in this browser with the backup from ' + (d.exported || '').slice(0, 10) + '?')) return;
      state.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
      state.overrides = d.overrides || {};
      state.history = d.history;
      saveStore(); renderSettings(); renderHistory();
      if (current) { renderReviewFilter(); renderAll(); }
      window.alert('Backup restored: ' + state.history.length + ' stock list(s).');
    }).catch(function (e) { window.alert('Could not restore: ' + (e.message || e)); })
      .then(function () { $('restoreInput').value = ''; });
  }

  // ------------------------------------------------------------------ wire up
  function init() {
    loadStore();
    if (!state.storageOK) show($('storageWarn'));
    renderSettings(); renderHistory();
    $('reportDate').value = todayISO();

    var drop = $('drop');
    $('fileInput').addEventListener('change', function (e) { handleFile(e.target.files[0]); e.target.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });

    $('reportDate').addEventListener('change', function () {
      if (current && this.value) { current.date = this.value; renderAll(); }
    });
    $('reviewFilter').addEventListener('change', renderReview);
    $('reviewSearch').addEventListener('input', renderReview);
    $('reviewTable').addEventListener('change', function (e) {
      var sel = e.target;
      if (!sel.classList.contains('cat') || !sel.value) return;
      var k = sel.getAttribute('data-k');
      if (!k) { window.alert('This line has no barcode, so the choice can\'t be remembered. Add a barcode in StockZure.'); return; }
      var it = current.items.filter(function (x) { return x.k === k; })[0];
      if (it && sel.value === autoCategory(it)) delete state.overrides[k];
      else state.overrides[k] = sel.value;
      saveStore();
      var scroll = $('reviewTable').parentNode.scrollTop;
      A = analyse(); renderStats(); renderCats(); renderDead(); renderReview();
      $('reviewTable').parentNode.scrollTop = scroll;
    });
    $('btnGenerate').addEventListener('click', generate);
    $('histTable').addEventListener('click', function (e) {
      var d = e.target.getAttribute && e.target.getAttribute('data-del');
      if (!d) return;
      if (!window.confirm('Remove the stock list for ' + fmtDate(d) + ' from history?')) return;
      state.history = state.history.filter(function (s) { return s.date !== d; });
      saveStore(); renderHistory(); if (current) renderAll();
    });
    $('btnBackup').addEventListener('click', downloadBackup);
    $('restoreInput').addEventListener('change', function (e) { if (e.target.files[0]) restoreBackup(e.target.files[0]); });
    $('oldInput').addEventListener('change', function (e) { if (e.target.files[0]) addOldExport(e.target.files[0]); });
    $('btnSaveSettings').addEventListener('click', function () {
      var S = state.settings;
      S.highValue = Math.max(0, num($('setHigh').value)) || DEFAULT_SETTINGS.highValue;
      S.slowMonths = Math.max(1, num($('setSlow').value)) || DEFAULT_SETTINGS.slowMonths;
      S.deadMonths = Math.max(S.slowMonths, num($('setDead').value)) || DEFAULT_SETTINGS.deadMonths;
      S.address = $('setAddress').value.trim() || DEFAULT_SETTINGS.address;
      saveStore(); renderSettings();
      notice($('setMsg'), 'ok', 'Settings saved.');
      if (current) renderAll();
    });
    $('btnResetCats').addEventListener('click', function () {
      if (!window.confirm('Clear all the categories you picked by hand? The automatic rules will be used again.')) return;
      state.overrides = {}; saveStore();
      notice($('setMsg'), 'ok', 'Category choices cleared.');
      if (current) renderAll();
    });
  }

  if (typeof ExcelJS === 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      notice($('parseMsg'), 'err', 'The Excel library (lib/exceljs.min.js) did not load. Check that the "lib" folder was uploaded to GitHub.');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
