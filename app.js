/* RES Stock Value Breakdown - v2
 * StockZure stock list (+ movement report) -> Exco breakdown workbook, audit pack and spot checks.
 * Runs fully in the browser. History and choices are saved in this browser (localStorage).
 * This tool was developed with the assistance of an AI agent under the direction of qualified RES personnel.
 */
(function () {
  'use strict';

  // ------------------------------------------------------------------ constants
  var STORE_KEY = 'resStockBreakdown.v1';
  var EXCLUDED = 'Excluded (Equipment)';
  var REVIEW = 'Needs Review';

  var CAT_NAMES = [
    'PV Modules', 'Inverters & Power Conversion', 'Batteries & Storage', 'Mounting & Structure',
    'Power Cable (AC-DC)', 'Comms & Data Cable', 'Cable Containment', 'Terminations & Accessories',
    'Protection & Switchgear', 'Metering, Monitoring & Comms', 'Earthing & Lightning Protection',
    'Lighting & Small Power', 'Fixings & Consumables', 'Signage & Safety'
  ];
  // Small Stock - Consumables = these categories. Everything else = General Stock.
  var SMALL_CATS = ['Terminations & Accessories', 'Fixings & Consumables', 'Signage & Safety', 'Lighting & Small Power'];

  // Sections of the Exco breakdown
  var SEC = {
    PTA_GEN: 'PTA General Stock', PTA_SMALL: 'PTA Small Stock', PTA_OM: 'PTA O&M Stock',
    CPT_GEN: 'CPT General Stock', CPT_SMALL: 'CPT Small Stock', CPT_OM: 'CPT O&M Stock',
    ATTIC: 'Attic Stock', REDUNDANT: 'Redundant Stock'
  };
  var SEC_ORDER = [SEC.PTA_GEN, SEC.PTA_SMALL, SEC.PTA_OM, SEC.CPT_GEN, SEC.CPT_SMALL, SEC.CPT_OM, SEC.ATTIC, SEC.REDUNDANT];

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
    ['Comms & Data Cable', /rs ?485.*(cable|comms)|ethernet|fib(er|re)|patch (cord|lead|cable|panel)|coax|\butp\b|\bftp\b/],
    ['Inverters & Power Conversion', /inverter|^inv\b|multiplus|quattro|mppt|charger|sungrow|sun ?2000|victron|atess|sigen|power supply|\bups\b|step ?down/],
    ['Power Cable (AC-DC)', /^cable\b(?!.*(tray|ladder|tie|clip|saddle|joiner|splic|marker|gland|lug|securing))|pv cable|trailing cable|^cab\b/],
    ['Lighting & Small Power', /multiplug|plug top|plug adaptor|wall socket|socket|schuko|extension lead|\blamps?\b|\bled\b|bulkhead|\blights?\b|tube|motion sensor|\bpir\b|\be27\b|flood/],
    ['Earthing & Lightning Protection', /earth(?!.*leakage)|finial|lightning|aluminium round|down ?conductor/],
    ['Protection & Switchgear', /breaker|fuse|isolat|\bspd\b|changeover|contactor|relay|realy|enclos|\bdb\b|^db|busbar|basbar|bus bar|din rail|selector|indicator|timer|combiner|motor op|main switch|resistor|insulator|\bmcb\b|kiosk|distribution board|lever/],
    ['Cable Containment', /tray|trunking|conduit|condiont|channel|cabstrut|ladder|cblladder|hanger|beam clip|girder clip|corrugated|unistrut|threaded (bar|rod)|drainex|pipe|saddle|angle (flat )?fitting|tee flat|base plate|extension box|junction box|locking adapter|cantilever|cover clip|wmcc|slide lid box|^box\b/],
    ['Terminations & Accessories', /\blugs?\b|^lug|gland|ferrule|heat ?shrink|shroud|terminal|connector|splic|sleeve|butt|tape|strapping|buckles|label|cable tie|marker|pinch weld|end ?stop/],
    ['Metering, Monitoring & Comms', /\bcts?\b|^ct|meter|janitza|rogowski|monitor|modem|router|antenna|wi-?fi|weather|sensor|\bhub\b|accuenergy|elster|smart|\bcoms?\b|comms|computer|poe|tp.?link|gsm|\b[34]g\b|grandstream|echelon|landis|radiation|dongle/],
    ['Fixings & Consumables', /anchor|^m\d+\b|\bnuts?\b|bolt|screw|washer|rivet|\bclip\b|grub|spray|silicone|filler|foam|glue|adhesive|resin|cable clip/]
  ];

  var VALUE_BANDS = [
    { name: 'Above R50 000', min: 50000, fill: 'FFF6DEDB' },
    { name: 'R30 000 - R50 000', min: 30000, fill: 'FFFBE3C8' },
    { name: 'R20 000 - R30 000', min: 20000, fill: 'FFFFF4B3' },
    { name: 'R10 000 - R20 000', min: 10000, fill: 'FFE6EEF3' },
    { name: 'Below R10 000', min: 0, fill: 'FFF5F5F5' }
  ];

  var DEFAULT_SETTINGS = {
    company: 'RHINO ENERGY SOLUTIONS',
    address: 'Warehouse 0026B The Tannery Industrial Park 306 Derdepoort Road  Silverton Pretoria 0184',
    cptAddress: 'Cape Town',
    highValue: 5000,
    slowMonths: 6,
    deadMonths: 12,
    auditFrom: '2026-03-01',
    auditTo: '2027-02-28'
  };

  var X = {
    yellow: 'FFFDDD00', dark: 'FF3F3F40', grey: 'FF9EA0A3', air: 'FFD6D6D6',
    clay: 'FFCC645C', blue: 'FF78A1BB', white: 'FFFFFFFF', zebra: 'FFF5F5F5',
    deadFill: 'FFF6DEDB', slowFill: 'FFFFF4B3', actionFill: 'FFFFFBE0', okFill: 'FFE5F1E7'
  };
  var RAND = '"R"#,##0.00';

  // ------------------------------------------------------------------ state
  var state = {
    settings: Object.assign({}, DEFAULT_SETTINGS),
    overrides: {},   // barcode key -> category
    marks: {},       // barcode key -> 'ATTIC' | 'REDUNDANT'
    history: [],     // [{date, source, lines, value, totals:{...}, items:{key: qty}}]
    movement: null,  // {from, to, file, uploaded, last:{key: 'YYYY-MM-DD'}}
    spotLog: [],     // [{when, location, n, pool, stockDate, items:[barcode...]}]
    storageOK: true
  };
  var current = null;    // {fileName, date, items:[...]}
  var movRows = null;    // full movement report rows (this session only)
  var A = null;          // analysis of current
  var spot = null;       // current spot check
  var logoB64 = null;    // logo for Excel

  // ------------------------------------------------------------------ storage
  function loadStore() {
    try {
      var raw = window.localStorage.getItem(STORE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        state.settings = Object.assign({}, DEFAULT_SETTINGS, s.settings || {});
        state.overrides = s.overrides || {};
        state.marks = s.marks || {};
        state.history = Array.isArray(s.history) ? s.history : [];
        state.movement = s.movement || null;
        state.spotLog = Array.isArray(s.spotLog) ? s.spotLog : [];
      }
    } catch (e) { state.storageOK = false; }
  }
  function saveStore() {
    try {
      window.localStorage.setItem(STORE_KEY, JSON.stringify({
        settings: state.settings, overrides: state.overrides, marks: state.marks,
        history: state.history, movement: state.movement, spotLog: state.spotLog
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
  function loaderShow(m) { if (window.RhinoLoader) window.RhinoLoader.show(m); }
  function loaderHide() { if (window.RhinoLoader) window.RhinoLoader.hide(); }
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
  function pad2(n) { return String(n).padStart(2, '0'); }
  function isoOf(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function todayISO() { return isoOf(new Date()); }
  function nowStamp() { var d = new Date(); return isoOf(d) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  function parseISO(s) { var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function excelDate(s) { var p = s.slice(0, 10).split('-'); return new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])); }
  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function fmtDate(s) { if (!s) return ''; var d = parseISO(s.slice(0, 10)); return d.getDate() + ' ' + MONTHS[d.getMonth()] + ' ' + d.getFullYear(); }
  function monthLabel(s) {
    var d = parseISO(s);
    return ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sept', 'Oct', 'Nov', 'Dec'][d.getMonth()] + '-' + String(d.getFullYear()).slice(2);
  }
  function monthsBetween(a, b) { return (parseISO(b.slice(0, 10)) - parseISO(a.slice(0, 10))) / (1000 * 60 * 60 * 24 * 30.4375); }
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
      return null;
    }
    return v;
  }
  function str(v) { return v == null ? '' : String(v).trim(); }
  function notice(el, cls, html) { el.innerHTML = '<div class="notice ' + cls + '">' + html + '</div>'; }
  function sumTotal(arr) { return arr.reduce(function (s, it) { return s + it.total; }, 0); }
  // Date value from Excel (Date object or text) -> 'YYYY-MM-DD HH:MM'
  function dateText(v) {
    if (v instanceof Date) {
      // ExcelJS returns dates as UTC values of the sheet's wall-clock time
      return v.getUTCFullYear() + '-' + pad2(v.getUTCMonth() + 1) + '-' + pad2(v.getUTCDate()) + ' ' + pad2(v.getUTCHours()) + ':' + pad2(v.getUTCMinutes());
    }
    var s = str(v);
    var m = /(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2}))?/.exec(s);
    if (m) return m[1] + '-' + m[2] + '-' + m[3] + ' ' + (m[4] || '00') + ':' + (m[5] || '00');
    m = /(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/.exec(s);
    if (m) return m[3] + '-' + pad2(m[2]) + '-' + pad2(m[1]) + ' ' + pad2(m[4] || 0) + ':' + (m[5] || '00');
    if (typeof v === 'number' && v > 20000) { // Excel serial date
      var d = new Date(Date.UTC(1899, 11, 30) + v * 86400000);
      return dateText(d);
    }
    return '';
  }

  // ------------------------------------------------------------------ categorise & locate
  function isEquipment(desc, notes, shelf) {
    var d = desc.toLowerCase(), n = notes.toLowerCase(), s = shelf.toLowerCase();
    if (/^equipment\b/.test(d) || /^equipment\b/.test(n)) return true;
    if (/tester|tool panel|multimeter|insulation tester|\bmegger\b/.test(d)) return true;
    if (s.indexOf('equipment') > -1 && !/tape|sign/.test(d)) return true;
    return false;
  }
  var RE_OM = /o\s?&\s?m\b|o\s?and\s?m\b/i;
  var RE_CPT = /\bcpt\b|cape\s?town/i;
  function locationOf(it) {
    // Shelf Barcode first, then Notes
    if (RE_CPT.test(it.shelf)) return 'CPT';
    if (it.shelf && !/^unspecified$/i.test(it.shelf) && /\bpta\b|pretoria/i.test(it.shelf)) return 'PTA';
    if (RE_CPT.test(it.notes)) return 'CPT';
    return 'PTA';
  }
  function isOM(it) { return RE_OM.test(it.shelf) || RE_OM.test(it.notes) || RE_OM.test(it.desc); }
  function autoCategory(it) {
    if (isEquipment(it.desc, it.notes, it.shelf)) return EXCLUDED;
    var d = it.desc.toLowerCase();
    for (var i = 0; i < RULES.length; i++) if (RULES[i][1].test(d)) return RULES[i][0];
    return REVIEW;
  }
  function sectionOf(it) {
    if (it.cat === EXCLUDED) return null;
    var mk = state.marks[it.k];
    if (mk === 'ATTIC') return SEC.ATTIC;
    if (mk === 'REDUNDANT') return SEC.REDUNDANT;
    var small = SMALL_CATS.indexOf(it.cat) > -1;
    if (it.loc === 'CPT') return it.om ? SEC.CPT_OM : (small ? SEC.CPT_SMALL : SEC.CPT_GEN);
    return it.om ? SEC.PTA_OM : (small ? SEC.PTA_SMALL : SEC.PTA_GEN);
  }
  function categorise(items) {
    items.forEach(function (it) {
      it.autoCat = autoCategory(it);
      var o = state.overrides[it.k];
      it.cat = (o && (CAT_NAMES.indexOf(o) > -1 || o === EXCLUDED)) ? o : it.autoCat;
      it.manual = !!o && it.cat === o;
      it.loc = locationOf(it);
      it.om = isOM(it);
      it.sec = sectionOf(it);
    });
  }
  function locLabel(it) {
    if (it.sec === SEC.ATTIC) return 'Attic';
    if (it.sec === SEC.REDUNDANT) return 'Redundant';
    return it.loc + (it.om ? ' O&M' : '');
  }

  // ------------------------------------------------------------------ read Excel
  var EXCEL_EXT = /\.(xlsx|xlsb)$/i;
  // .xlsb (Excel binary) is read with SheetJS and wrapped so it looks like an ExcelJS workbook.
  function xlsbWorkbook(buffer) {
    if (typeof XLSX === 'undefined') throw new Error('The .xlsb reader did not load. Check that xlsx.full.min.js is in the main folder of the GitHub repo, then refresh the page.');
    var book = XLSX.read(new Uint8Array(buffer), { type: 'array', cellDates: false, cellFormula: false, cellHTML: false, cellStyles: false });
    var worksheets = book.SheetNames.map(function (name) {
      var aoa = null;
      function data() {
        if (!aoa) aoa = XLSX.utils.sheet_to_json(book.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true });
        return aoa;
      }
      function rowObj(r) {
        var arr = data()[r - 1] || [];
        return {
          getCell: function (c) { var v = arr[c - 1]; return { value: v === undefined ? null : v }; },
          eachCell: function (opts, fn) {
            for (var c = 0; c < arr.length; c++) if (arr[c] != null && arr[c] !== '') fn({ value: arr[c] }, c + 1);
          }
        };
      }
      var ws = { name: name, getRow: rowObj };
      Object.defineProperty(ws, 'rowCount', { get: function () { return data().length; } });
      return ws;
    });
    return { worksheets: worksheets };
  }
  function loadWorkbook(buffer, fileName) {
    if (/\.xlsb$/i.test(fileName || '')) return Promise.resolve().then(function () { return xlsbWorkbook(buffer); });
    if (typeof ExcelJS === 'undefined') throw new Error('The Excel library did not load. Check that exceljs.min.js is in the main folder of the GitHub repo, then refresh the page.');
    var wb = new ExcelJS.Workbook();
    return wb.xlsx.load(buffer).then(function () { return wb; });
  }
  function headerMap(ws, test) {
    var max = Math.min(ws.rowCount, 40);
    for (var r = 1; r <= max; r++) {
      var map = {}, row = ws.getRow(r);
      row.eachCell({ includeEmpty: false }, function (cell, col) {
        var t = str(cellVal(cell)).toLowerCase().replace(/\s+/g, ' ');
        if (t) map[t] = col;
      });
      if (test(map)) return { row: r, map: map };
    }
    return null;
  }
  function pick(map, names) {
    for (var i = 0; i < names.length; i++) {
      var n = names[i];
      if (map[n]) return map[n];
    }
    var ks = Object.keys(map);
    for (i = 0; i < names.length; i++) {
      for (var j = 0; j < ks.length; j++) if (ks[j].indexOf(names[i]) > -1) return map[ks[j]];
    }
    return null;
  }
  function readStockList(buffer, fileName) {
    return loadWorkbook(buffer, fileName).then(function (wb) {
      var sheets = wb.worksheets.filter(Boolean).sort(function (a, b) {
        function score(ws) { var n = ws.name.toLowerCase(); return n === 'data' || n.indexOf('pta current') > -1 ? 0 : (n.indexOf('current') > -1 ? 1 : 5); }
        return score(a) - score(b);
      });
      for (var i = 0; i < sheets.length; i++) {
        var ws = sheets[i];
        var h = headerMap(ws, function (m) { return m.barcode && pick(m, ['description']) && pick(m, ['qty in stock']); });
        if (!h) continue;
        if (pick(h.map, ['status date'])) continue; // that's a movement report
        var c = {
          barcode: h.map.barcode, desc: pick(h.map, ['description']), qty: pick(h.map, ['qty in stock']),
          notes: pick(h.map, ['notes']), price: pick(h.map, ['purch. price', 'price']), shelf: pick(h.map, ['shelf barcode', 'shelf'])
        };
        var items = [];
        for (var r = h.row + 1; r <= ws.rowCount; r++) {
          var row = ws.getRow(r);
          var g = function (col) { return col ? cellVal(row.getCell(col)) : null; };
          var barcode = str(g(c.barcode)), desc = str(g(c.desc));
          if (!barcode && !desc) continue;
          var qty = num(g(c.qty)), price = num(g(c.price));
          items.push({
            row: r, barcode: barcode, k: key(barcode), desc: desc,
            shelf: str(g(c.shelf)), notes: str(g(c.notes)),
            qty: round3(qty), price: round2(price), total: round2(qty * price)
          });
        }
        if (items.length) return { sheet: ws.name, items: items };
      }
      throw new Error('Could not find the stock table. It needs headings for Barcode, Description and Qty In Stock. (Is this the movement report? Use the box on the right for that.)');
    });
  }
  function readMovement(buffer, fileName) {
    return loadWorkbook(buffer, fileName).then(function (wb) {
      var wss = wb.worksheets.filter(Boolean);
      for (var i = 0; i < wss.length; i++) {
        var ws = wss[i];
        var h = headerMap(ws, function (m) { return m.barcode && m.status && pick(m, ['status date']); });
        if (!h) continue;
        var M = h.map, c = {
          barcode: M.barcode, desc: pick(M, ['description']), shelf: pick(M, ['shelf barcode']), qty: M.qty || pick(M, ['qty']),
          status: M.status, date: pick(M, ['status date']), notes: pick(M, ['notes']), supplier: pick(M, ['supplier']),
          signby: pick(M, ['sign by']), returns: pick(M, ['returns from site']), customer: pick(M, ['customer']),
          job: pick(M, ['job no']), price: pick(M, ['purch. price', 'price']), user: pick(M, ['user']), adj: pick(M, ['qty adjusted']),
          serial: pick(M, ['serial'])
        };
        var rows = [];
        for (var r = h.row + 1; r <= ws.rowCount; r++) {
          var row = ws.getRow(r);
          var g = function (col) { return col ? cellVal(row.getCell(col)) : null; };
          var barcode = str(g(c.barcode)), status = str(g(c.status));
          if (!barcode && !status) continue;
          var qty = num(g(c.qty)), price = num(g(c.price));
          rows.push({
            barcode: barcode, k: key(barcode), desc: str(g(c.desc)), shelf: str(g(c.shelf)),
            qty: round3(qty), status: status.toUpperCase() === 'RESERVED' ? 'Reserved' : status.toUpperCase(),
            date: dateText(g(c.date)), notes: str(g(c.notes)), supplier: str(g(c.supplier)), signby: str(g(c.signby)),
            returns: str(g(c.returns)), customer: str(g(c.customer)), job: str(g(c.job)), serial: str(g(c.serial)),
            price: round2(price), value: round2(qty * price),
            user: str(g(c.user)).replace(/\s*\n\s*/g, ' / ').replace(/Device:/i, 'device: '), adj: str(g(c.adj))
          });
        }
        if (rows.length) return rows;
      }
      throw new Error('This does not look like a StockZure movement report (needs Barcode, Status and Status Date columns).');
    });
  }
  function movementPeriod(rows, fileName) {
    var m = /(20\d{2})(\d{2})(\d{2})\D+(20\d{2})(\d{2})(\d{2})/.exec(fileName || '');
    var dates = rows.map(function (r) { return r.date.slice(0, 10); }).filter(Boolean).sort();
    return {
      from: m ? m[1] + '-' + m[2] + '-' + m[3] : (dates[0] || ''),
      to: m ? m[4] + '-' + m[5] + '-' + m[6] : (dates[dates.length - 1] || '')
    };
  }
  // movement = anything except a COUNT
  function isMove(r) { return r.status && r.status !== 'COUNT'; }
  function parseAdjustments(rows) {
    var out = [];
    var re = /Qty adjusted from\s*([-\d.,]+)\s*to\s*([-\d.,]+)\s*On\s*([\d-]+\s*[\d:]*)\s*By user\s*:\s*([\s\S]*?)\s*Reason\s*:\s*([\s\S]*?)(?=Qty adjusted from|$)/gi;
    rows.forEach(function (r) {
      if (!r.adj) return;
      var m, found = false;
      re.lastIndex = 0;
      while ((m = re.exec(r.adj)) !== null) {
        found = true;
        var from = num(m[1]), to = num(m[2]);
        out.push({
          date: dateText(m[3]) || m[3], barcode: r.barcode, desc: r.desc, from: from, to: to, change: round3(to - from),
          value: round2((to - from) * r.price), user: m[4].replace(/\s*\n\s*/g, ' '), reason: m[5].trim(), price: r.price
        });
      }
      if (!found) out.push({ date: r.date, barcode: r.barcode, desc: r.desc, from: null, to: null, change: null, value: null, user: r.user, reason: r.adj, price: r.price });
    });
    // the same adjustment can appear on several movement lines of one item - keep it once
    var seen = {};
    return out.filter(function (a) {
      var id = a.barcode + '|' + a.date + '|' + a.from + '|' + a.to;
      if (seen[id]) return false; seen[id] = true; return true;
    }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }
  function isVagueReason(s) {
    var t = String(s || '').toLowerCase().replace(/[^a-z ]/g, '').trim();
    return !t || /^(stock )?(correction|adjust(ment)?|adjusted|fix|update|error|wrong|count)$/.test(t) || t.length < 6;
  }

  // ------------------------------------------------------------------ history & ageing
  function snapshotFrom(items, date, source, totals) {
    var map = {}, lines = 0, value = 0;
    items.forEach(function (it) {
      if (!it.k) return;
      map[it.k] = round3((map[it.k] || 0) + it.qty);
      if (it.cat !== EXCLUDED) value += it.total;
    });
    Object.keys(map).forEach(function (k) { if (map[k] <= 0) delete map[k]; else lines++; });
    return { date: date, source: source, lines: lines, value: round2(value), totals: totals || null, items: map };
  }
  function putSnapshot(snap) {
    state.history = state.history.filter(function (s) { return s.date !== snap.date; });
    state.history.push(snap);
    state.history.sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    saveStore();
  }
  function priorSnapshots(date) {
    return state.history.filter(function (s) { return s.date < date; })
      .sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }
  // Works out "last moved" per item: movement report first, weekly snapshots as back-up.
  function computeAgeing(items, date) {
    var prior = priorSnapshots(date), mv = state.movement, S = state.settings;
    var qtyByKey = {};
    items.forEach(function (it) { if (it.k) qtyByKey[it.k] = round3((qtyByKey[it.k] || 0) + it.qty); });
    items.forEach(function (it) {
      it.lastMoved = null; it.lastNote = ''; it.months = null; it.status = '';
      if (it.qty <= 0 || it.cat === EXCLUDED) return;
      // From the weekly stock lists: the oldest list with the same qty (unchanged since then)
      var since = null, changed = false;
      if (prior.length && it.k) {
        var q = qtyByKey[it.k];
        for (var i = 0; i < prior.length; i++) {
          if (round3(prior[i].items[it.k] || 0) === q) since = prior[i].date; else { changed = true; break; }
        }
      }
      var best = null, note = '';
      if (mv && mv.last && it.k && mv.last[it.k]) {
        best = mv.last[it.k]; note = 'movement report';
        if (changed && !since && prior[0].date > best) { best = prior[0].date; note = 'qty changed since ' + fmtDate(prior[0].date); }
      } else if (mv && mv.from) {
        // no movement in the report period; snapshots may show it has been still for even longer
        best = mv.from; note = 'no movement since ' + fmtDate(mv.from);
        if (since && since < mv.from) { best = since; note = 'no movement, same qty since ' + fmtDate(since); }
        if (changed && !since) { best = prior[0].date; note = 'qty changed since ' + fmtDate(prior[0].date); }
      } else if (prior.length) {
        if (since) { best = since; note = 'same qty since ' + fmtDate(since); }
        else { best = date; note = 'qty changed since last stock list'; }
      }
      if (!best) { it.status = 'Unknown'; return; }
      it.lastMoved = best; it.lastNote = note;
      it.months = Math.max(0, monthsBetween(best, date));
      var m = it.months + 0.05; // a full year of no movement counts as 12 months
      if (m >= S.deadMonths) it.status = 'Dead';
      else if (m >= S.slowMonths) it.status = 'Slow';
      else it.status = 'Active';
    });
    return prior;
  }

  // ------------------------------------------------------------------ analysis
  function bandOf(total) {
    for (var i = 0; i < VALUE_BANDS.length; i++) if (total >= VALUE_BANDS[i].min) return VALUE_BANDS[i];
    return VALUE_BANDS[VALUE_BANDS.length - 1];
  }
  function analyse() {
    var items = current.items, S = state.settings;
    categorise(items);
    var prior = computeAgeing(items, current.date);
    var inStock = items.filter(function (it) { return it.qty > 0 && it.cat !== EXCLUDED; });
    var a = { prior: prior, inStock: inStock, bySec: {}, byCat: {}, catLoc: {} };
    SEC_ORDER.forEach(function (s) { a.bySec[s] = { lines: 0, value: 0, items: [] }; });
    inStock.forEach(function (it) {
      var b = a.bySec[it.sec]; b.lines++; b.value += it.total; b.items.push(it);
      var c = a.byCat[it.cat] = a.byCat[it.cat] || { lines: 0, value: 0, PTA: 0, CPT: 0, OTHER: 0, dead: 0, slow: 0 };
      c.lines++; c.value += it.total;
      if (it.sec === SEC.ATTIC || it.sec === SEC.REDUNDANT) c.OTHER += it.total; else c[it.loc] += it.total;
      if (it.status === 'Dead') c.dead += it.total;
      if (it.status === 'Slow') c.slow += it.total;
    });
    var v = function (s) { return a.bySec[s].value; };
    a.t = {
      PTA_GEN: v(SEC.PTA_GEN), PTA_SMALL: v(SEC.PTA_SMALL), PTA_OM: v(SEC.PTA_OM),
      CPT_GEN: v(SEC.CPT_GEN), CPT_SMALL: v(SEC.CPT_SMALL), CPT_OM: v(SEC.CPT_OM),
      ATTIC: v(SEC.ATTIC), REDUNDANT: v(SEC.REDUNDANT)
    };
    a.t.PTA_NO_OM = a.t.PTA_GEN + a.t.PTA_SMALL;
    a.t.PTA = a.t.PTA_NO_OM + a.t.PTA_OM;              // "PTA Current Stock"
    a.t.CPT_NO_OM = a.t.CPT_GEN + a.t.CPT_SMALL;
    a.t.CPT = a.t.CPT_NO_OM + a.t.CPT_OM;              // "CPT Current Stock"
    a.t.TOTAL = a.t.PTA + a.t.CPT + a.t.ATTIC + a.t.REDUNDANT;
    Object.keys(a.t).forEach(function (k) { a.t[k] = round2(a.t[k]); });
    a.ptaLines = inStock.filter(function (it) { return it.sec === SEC.PTA_GEN || it.sec === SEC.PTA_SMALL || it.sec === SEC.PTA_OM; });
    a.cptLines = inStock.filter(function (it) { return it.sec === SEC.CPT_GEN || it.sec === SEC.CPT_SMALL || it.sec === SEC.CPT_OM; });
    a.high = a.ptaLines.filter(function (it) { return it.total >= S.highValue; }).sort(function (x, y) { return y.total - x.total; });
    a.highCpt = a.cptLines.filter(function (it) { return it.total >= S.highValue; });
    a.excluded = items.filter(function (it) { return it.cat === EXCLUDED; });
    a.review = inStock.filter(function (it) { return it.cat === REVIEW; });
    var notMarked = function (it) { return it.sec !== SEC.ATTIC && it.sec !== SEC.REDUNDANT; };
    a.dead = inStock.filter(function (it) { return it.status === 'Dead' && notMarked(it); });
    a.slow = inStock.filter(function (it) { return it.status === 'Slow' && notMarked(it); });
    a.zeroPrice = inStock.filter(function (it) { return it.price === 0; });
    a.noBarcode = items.filter(function (it) { return !it.k; });
    var seen = {}; a.dupes = [];
    items.forEach(function (it) { if (it.k) (seen[it.k] = seen[it.k] || []).push(it); });
    Object.keys(seen).forEach(function (k) { var g = seen[k]; if (g.length > 1 && g.some(function (x) { return x.qty > 0; })) a.dupes = a.dupes.concat(g); });
    // difference from last saved week (needs totals saved on that snapshot)
    a.prev = null;
    for (var i = 0; i < prior.length; i++) if (prior[i].totals) { a.prev = prior[i]; break; }
    return a;
  }
  function diffInfo(key) {
    if (!A.prev || A.prev.totals[key] == null) return null;
    var d = round2(A.t[key] - A.prev.totals[key]);
    return { diff: d, word: d > 0 ? 'Up' : (d < 0 ? 'Down' : 'No change'), date: A.prev.date };
  }

  // ------------------------------------------------------------------ render
  function renderAll() {
    A = analyse();
    renderStats(); renderReview(); renderSections(); renderCats(); renderDead(); renderHistory();
  }
  function stat(v, l, cls, extra) { return '<div class="stat ' + (cls || '') + '"><div class="v">' + v + '</div><div class="l">' + l + '</div>' + (extra || '') + '</div>'; }
  function diffHtml(key) {
    var d = diffInfo(key);
    if (!d) return '<div class="d muted">No previous week saved</div>';
    return '<div class="d ' + (d.diff >= 0 ? 'up' : 'down') + '">' + d.word + ' ' + fmtR(Math.abs(d.diff)) + ' vs ' + fmtDate(d.date) + '</div>';
  }
  function renderStats() {
    var t = A.t, exIn = A.excluded.filter(function (i) { return i.qty > 0; });
    $('stats').innerHTML =
      stat(fmtR(t.PTA), 'PTA Current Stock (incl. O&amp;M)', 'yellow', diffHtml('PTA')) +
      stat(fmtR(t.CPT), 'CPT Current Stock', 'yellow', diffHtml('CPT')) +
      stat(fmtR(t.ATTIC), 'Attic Stock', 'grey') +
      stat(fmtR(t.REDUNDANT), 'Redundant Stock', 'grey') +
      stat(fmtR(t.TOTAL), 'TOTAL', 'dark', diffHtml('TOTAL')) +
      stat(fmtR(sumTotal(A.high)), 'PTA HIGH Value (' + A.high.length + ' lines)') +
      stat(fmtR(sumTotal(A.dead) + sumTotal(A.slow)), 'Dead + slow stock', 'clay') +
      stat(fmtR(sumTotal(exIn)), 'Equipment left out (' + exIn.length + ')', 'grey');
    var rn = $('reviewNotice'), msgs = [];
    if (A.review.length) msgs.push('<strong>' + A.review.length + ' item(s) need a category</strong> (' + fmtR(sumTotal(A.review)) + '). Pick one in step 3.');
    if (!A.cptLines.length) msgs.push('No Cape Town stock in this stock list. CPT items are recognised by "CPT" or "Cape Town" in the Shelf Barcode or Notes.');
    if (!state.movement) msgs.push('No movement report loaded yet, so dead stock is based on saved weekly stock lists only.');
    rn.innerHTML = msgs.length ? '<div class="notice warn">' + msgs.join('<br>') + '</div>' : '<div class="notice ok">All items with stock have a category.</div>';
  }
  function catOptions(sel) {
    var h = sel === REVIEW ? '<option value="" selected>&#8212; choose category &#8212;</option>' : '';
    CAT_NAMES.concat([EXCLUDED]).forEach(function (c) { h += '<option' + (c === sel ? ' selected' : '') + '>' + esc(c) + '</option>'; });
    return h;
  }
  function markSelect(it) {
    var m = state.marks[it.k] || '';
    return '<select class="mark" data-k="' + esc(it.k) + '">' +
      '<option value=""' + (m ? '' : ' selected') + '>Normal</option>' +
      '<option value="ATTIC"' + (m === 'ATTIC' ? ' selected' : '') + '>Attic</option>' +
      '<option value="REDUNDANT"' + (m === 'REDUNDANT' ? ' selected' : '') + '>Redundant</option></select>';
  }
  function renderReviewFilter() {
    var f = $('reviewFilter'), cur = f.value || REVIEW;
    var h = '<option value="' + REVIEW + '">Needs Review</option><option value="__all">All items with stock</option>' +
      '<option value="__marked">Attic &amp; Redundant</option><option value="__manual">My category choices</option>' +
      '<option value="__PTA">Location: PTA</option><option value="__OM">Location: O&amp;M</option><option value="__CPT">Location: Cape Town</option>' +
      '<option value="' + EXCLUDED + '">Excluded (Equipment)</option>';
    CAT_NAMES.forEach(function (c) { h += '<option value="' + esc(c) + '">' + esc(c) + '</option>'; });
    f.innerHTML = h; f.value = cur;
  }
  function renderReview() {
    var f = $('reviewFilter').value || REVIEW, q = $('reviewSearch').value.trim().toLowerCase();
    var list = current.items.filter(function (it) {
      if (f === EXCLUDED) { if (it.cat !== EXCLUDED) return false; }
      else if (it.qty <= 0 || it.cat === EXCLUDED) return false;
      else if (f === '__all') { /* all */ }
      else if (f === '__marked') { if (!state.marks[it.k]) return false; }
      else if (f === '__manual') { if (!it.manual) return false; }
      else if (f === '__PTA') { if (it.loc !== 'PTA' || it.om) return false; }
      else if (f === '__OM') { if (!it.om) return false; }
      else if (f === '__CPT') { if (it.loc !== 'CPT') return false; }
      else if (it.cat !== f) return false;
      if (q && (it.barcode + ' ' + it.desc).toLowerCase().indexOf(q) === -1) return false;
      return true;
    });
    var h = '<thead><tr><th>Barcode</th><th>Description</th><th>Location</th><th class="num">Qty</th><th class="num">Value</th><th>Category</th><th>List</th></tr></thead><tbody>';
    list.slice(0, 400).forEach(function (it) {
      h += '<tr' + (it.manual || state.marks[it.k] ? ' class="changed"' : '') + '><td>' + esc(it.barcode) + '</td><td>' + esc(it.desc) + '</td><td><span class="pill loc">' + esc(locLabel(it)) + '</span></td><td class="num">' + fmtQty(it.qty) + '</td><td class="num">' + fmtR(it.total) +
        '</td><td><select class="cat" data-k="' + esc(it.k) + '">' + catOptions(it.cat) + '</select></td><td>' + (it.cat === EXCLUDED ? '' : markSelect(it)) + '</td></tr>';
    });
    if (!list.length) h += '<tr><td colspan="7" class="muted">Nothing to show.</td></tr>';
    $('reviewTable').innerHTML = h + '</tbody>';
    $('reviewCount').textContent = list.length > 400 ? 'Showing first 400 of ' + list.length + ' - use search to narrow down.' : list.length + ' item(s).';
  }
  function renderSections() {
    var t = A.t, b = A.bySec;
    function r(name, sec, cls) { return '<tr' + (cls ? ' class="' + cls + '"' : '') + '><td>' + name + '</td><td class="num">' + (sec ? b[sec].lines : '') + '</td><td class="num">' + fmtR(sec ? b[sec].value : 0) + '</td></tr>'; }
    function tr(name, val, cls) { return '<tr class="' + (cls || 'sub') + '"><td>' + name + '</td><td></td><td class="num">' + fmtR(val) + '</td></tr>'; }
    var h = '<thead><tr><th>Section</th><th class="num">Lines</th><th class="num">Value</th></tr></thead><tbody>' +
      r('PTA General Stock', SEC.PTA_GEN) + r('PTA Small Stock - Consumables', SEC.PTA_SMALL) + tr('Total PTA without O&amp;M', t.PTA_NO_OM) +
      r('PTA O&amp;M Stock', SEC.PTA_OM) + tr('PTA Current Stock', t.PTA) +
      r('CPT General Stock', SEC.CPT_GEN) + r('CPT Small Stock - Consumables', SEC.CPT_SMALL) + tr('Total CPT without O&amp;M', t.CPT_NO_OM) +
      r('CPT O&amp;M Stock', SEC.CPT_OM) + tr('CPT Current Stock', t.CPT) +
      r('Attic Stock', SEC.ATTIC) + r('Redundant Stock', SEC.REDUNDANT) +
      tr('TOTAL', t.TOTAL, 'total') + '</tbody>';
    $('secTable').innerHTML = h;
  }
  function catRows() {
    return Object.keys(A.byCat).map(function (c) { return [c, A.byCat[c]]; }).sort(function (x, y) { return y[1].value - x[1].value; });
  }
  function renderCats() {
    var h = '<thead><tr><th>Category</th><th class="num">Lines</th><th class="num">PTA</th><th class="num">CPT</th><th class="num">Attic/Red.</th><th class="num">Total</th><th class="num">%</th><th class="num">Dead</th></tr></thead><tbody>';
    catRows().forEach(function (r) {
      var c = r[1];
      h += '<tr><td>' + esc(r[0]) + '</td><td class="num">' + c.lines + '</td><td class="num">' + fmtR(c.PTA) + '</td><td class="num">' + fmtR(c.CPT) + '</td><td class="num">' + fmtR(c.OTHER) +
        '</td><td class="num">' + fmtR(c.value) + '</td><td class="num">' + pct(c.value, A.t.TOTAL) + '</td><td class="num">' + fmtR(c.dead) + '</td></tr>';
    });
    h += '<tr class="total"><td>Total</td><td class="num">' + A.inStock.length + '</td><td class="num">' + fmtR(A.t.PTA) + '</td><td class="num">' + fmtR(A.t.CPT) + '</td><td class="num">' + fmtR(A.t.ATTIC + A.t.REDUNDANT) +
      '</td><td class="num">' + fmtR(A.t.TOTAL) + '</td><td class="num">100%</td><td class="num">' + fmtR(sumTotal(A.dead)) + '</td></tr>';
    $('catTable').innerHTML = h + '</tbody>';
  }
  function deadSlowSorted() {
    return A.dead.concat(A.slow).sort(function (a, b) {
      if (a.status !== b.status) return a.status === 'Dead' ? -1 : 1;
      return b.total - a.total;
    });
  }
  function renderDead() {
    var S = state.settings, mv = state.movement, html = '';
    var later = state.history.filter(function (s) { return s.date > current.date; });
    var src = '<strong>Comparing stock date ' + fmtDate(current.date) + ' with:</strong><ul style="margin:6px 0 6px 18px;padding:0">';
    src += '<li>Movement report: ' + (mv ? fmtDate(mv.from) + ' to ' + fmtDate(mv.to) + ' (' + esc(mv.file) + ')' : '<strong>none loaded</strong>') + '</li>';
    if (A.prior.length) {
      var ds = A.prior.slice().reverse().map(function (s) { return fmtDate(s.date); });
      src += '<li>' + A.prior.length + ' saved stock list(s) from before this date: ' + (ds.length > 8 ? ds.slice(0, 4).join(', ') + ' ... ' + ds.slice(-3).join(', ') : ds.join(', ')) + '</li>';
    } else src += '<li>Saved stock lists from before this date: <strong>none</strong></li>';
    src += '</ul>';
    if (!mv && !A.prior.length) {
      html += '<div class="notice err"><strong>Nothing to compare with, so no dead or slow stock can be shown.</strong><br>' +
        'Either load the StockZure movement report in step 1, or add older stock lists under <strong>History &#8594; Add an older StockZure stock list</strong> (choose the correct date for each), then come back here.</div>';
    }
    if (current && !current.dateConfirmed) html += '<div class="notice warn">The stock date has not been chosen yet (step 1). Stock age is worked out from that date.</div>';
    if (later.length) html += '<div class="notice warn">' + later.length + ' saved stock list(s) are dated <strong>after</strong> ' + fmtDate(current.date) + ' (' + later.map(function (s) { return fmtDate(s.date); }).join(', ') + ') and are not used. If one of them is really an older list, remove it under History and add it again with the right date.</div>';
    src += '<span class="muted"><strong>Slow</strong> = no movement for ' + S.slowMonths + '-' + S.deadMonths + ' months. <strong>Dead</strong> = no movement for ' + S.deadMonths + '+ months. Items marked Attic/Redundant are left out.</span>';
    $('ageInfo').innerHTML = html + src;
    $('ageStats').innerHTML = stat(fmtR(sumTotal(A.dead)), 'Dead: ' + A.dead.length + ' lines', 'clay') +
      stat(fmtR(sumTotal(A.slow)), 'Slow: ' + A.slow.length + ' lines', 'yellow');
    var list = deadSlowSorted();
    var h = '<thead><tr><th>Status</th><th>Description</th><th>Location</th><th class="num">Qty</th><th class="num">Value</th><th>Last moved</th><th>List</th></tr></thead><tbody>';
    list.slice(0, 500).forEach(function (it) {
      h += '<tr><td><span class="pill ' + it.status + '">' + it.status + '</span></td><td>' + esc(it.desc) + '<div class="muted">' + esc(it.barcode) + '</div></td><td>' + esc(locLabel(it)) + '</td><td class="num">' + fmtQty(it.qty) + '</td><td class="num">' + fmtR(it.total) +
        '</td><td>' + fmtDate(it.lastMoved) + '<div class="muted">' + esc(it.lastNote) + '</div></td><td>' + markSelect(it) + '</td></tr>';
    });
    if (!list.length) h += '<tr><td colspan="7" class="muted">No dead or slow stock found.</td></tr>';
    $('deadTable').innerHTML = h + '</tbody>';
  }
  function renderHistory() {
    var h = '<thead><tr><th>Stock date</th><th>Source</th><th class="num">Lines with stock</th><th class="num">Value</th><th></th></tr></thead><tbody>';
    state.history.slice().reverse().forEach(function (s) {
      h += '<tr><td>' + fmtDate(s.date) + '</td><td>' + esc(s.source) + '</td><td class="num">' + s.lines + '</td><td class="num">' + fmtR(s.totals ? s.totals.TOTAL : s.value) +
        '</td><td><button class="btn small danger" data-del="' + s.date + '">Remove</button></td></tr>';
    });
    if (!state.history.length) h += '<tr><td colspan="5" class="muted">No history yet. First time on this device? Tap <strong>Restore backup</strong> and choose your latest backup file.</td></tr>';
    $('histTable').innerHTML = h + '</tbody>';
  }
  function renderMovInfo() {
    var mv = state.movement;
    $('movInfo').innerHTML = mv ? 'Saved: last-moved dates from <strong>' + esc(mv.file) + '</strong> (' + fmtDate(mv.from) + ' to ' + fmtDate(mv.to) + ').' +
      (movRows ? ' Full report loaded for audit tools (' + movRows.length + ' lines).' : ' Upload it again this session to use the audit pack and item history.') :
      'No movement report yet.';
  }
  function renderSpotLog() {
    var h = '<thead><tr><th>Generated</th><th>Location</th><th class="num">Items</th><th class="num">Picked from</th><th>Stock list date</th><th>Barcodes</th></tr></thead><tbody>';
    state.spotLog.slice().reverse().forEach(function (s) {
      h += '<tr><td>' + esc(s.when) + '</td><td>' + esc(s.location) + '</td><td class="num">' + s.n + '</td><td class="num">' + s.pool + '</td><td>' + fmtDate(s.stockDate) + '</td><td class="muted">' + esc(s.items.join(', ')) + '</td></tr>';
    });
    if (!state.spotLog.length) h += '<tr><td colspan="6" class="muted">No spot checks generated yet.</td></tr>';
    $('spotLog').innerHTML = h + '</tbody>';
  }
  function renderSettings() {
    var S = state.settings;
    $('setHigh').value = S.highValue; $('setSlow').value = S.slowMonths; $('setDead').value = S.deadMonths;
    $('setAddress').value = S.address; $('setCptAddress').value = S.cptAddress;
    $('setAudFrom').value = S.auditFrom; $('setAudTo').value = S.auditTo;
    if (!$('audFrom').value) $('audFrom').value = S.auditFrom;
    if (!$('audTo').value) $('audTo').value = S.auditTo;
  }

  // ------------------------------------------------------------------ Excel helpers
  function fill(c, argb) { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: argb } }; }
  function newWorkbook() {
    var wb = new ExcelJS.Workbook();
    wb.creator = 'RES Stock Breakdown app'; wb.created = new Date();
    wb._logoId = logoB64 ? wb.addImage({ base64: logoB64, extension: 'png' }) : null;
    return wb;
  }
  // Header: logo (A1), company, title, address, month; total box top right.
  function headerBlock(wb, ws, o) {
    var S = state.settings, n = o.nCols;
    if (wb._logoId != null) ws.addImage(wb._logoId, { tl: { col: 0.1, row: 0.15 }, ext: { width: 120, height: 70 } });
    var tx = o.textCol || 2;
    ws.getCell(1, tx).value = S.company; ws.getCell(1, tx).font = { bold: true, size: 16, color: { argb: X.dark } };
    ws.getCell(2, tx).value = o.title; ws.getCell(2, tx).font = { bold: true, size: 13 };
    ws.getCell(3, tx).value = o.address != null ? o.address : S.address; ws.getCell(3, tx).font = { size: 10, color: { argb: 'FF555555' } };
    ws.getCell(4, tx).value = monthLabel(current.date) + '   (stock date ' + fmtDate(current.date) + ')';
    ws.getCell(4, tx).font = { bold: true, size: 12 };
    if (o.total != null) {
      ws.getCell(1, n - 1).value = o.totalLabel || 'TOTAL VALUE';
      ws.getCell(1, n - 1).alignment = { horizontal: 'right' }; ws.getCell(1, n - 1).font = { bold: true };
      var tc = ws.getCell(1, n); tc.value = o.total; tc.numFmt = o.totalFmt || RAND;
      tc.font = { bold: true, size: 12, color: { argb: X.dark } }; fill(tc, X.yellow); tc.alignment = { horizontal: 'right' };
    }
    for (var r = 1; r <= 5; r++) ws.getRow(r).height = 18;
  }
  function tableHeader(ws, rowNo, headers, startCol) {
    var row = ws.getRow(rowNo), s0 = startCol || 1;
    headers.forEach(function (h, i) {
      var c = row.getCell(i + s0);
      c.value = h; c.font = { bold: true, color: { argb: X.white } }; fill(c, X.dark);
      c.alignment = { vertical: 'middle', wrapText: true };
      c.border = { bottom: { style: 'thin', color: { argb: X.yellow } } };
    });
    row.height = 22;
  }
  function zebra(row, nCols, i, s0) { if (i % 2) for (var c = s0 || 1; c < (s0 || 1) + nCols; c++) fill(row.getCell(c), X.zebra); }
  function boxRow(row, from, to) {
    for (var c = from; c <= to; c++) row.getCell(c).border = { top: { style: 'thin', color: { argb: X.grey } }, left: { style: 'thin', color: { argb: X.grey } }, bottom: { style: 'thin', color: { argb: X.grey } }, right: { style: 'thin', color: { argb: X.grey } } };
  }
  function totalRowCells(row, from, to, argb) {
    for (var c = from; c <= to; c++) { var cell = row.getCell(c); cell.font = { bold: true }; fill(cell, argb || X.air); cell.border = { top: { style: 'thin', color: { argb: X.dark } } }; }
  }
  function sumFormula(ws, col, r1, r2, result) {
    var L = ws.getColumn(col).letter;
    return r2 >= r1 ? { formula: 'SUBTOTAL(9,' + L + r1 + ':' + L + r2 + ')', result: round2(result) } : 0;
  }
  function landscape(ws) { ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } }; }
  function footerNote(ws, r, nCols) {
    var c = ws.getCell(r, 2);
    c.value = 'This document was developed with the assistance of an AI agent under the direction of qualified RES personnel.';
    c.font = { italic: true, size: 8, color: { argb: 'FF777777' } };
  }

  // Standard stock list tab
  var STOCK_HEADERS = ['Barcode', 'Description', 'Qty In Stock', 'Notes', 'Purch. Price', 'Total Replacement Value', 'Category', 'Section'];
  function stockSheet(wb, name, title, list, o) {
    o = o || {};
    var headers = STOCK_HEADERS.slice(), extra = o.extra || null;
    if (extra) headers = headers.concat(extra.headers);
    var n = headers.length;
    var ws = wb.addWorksheet(name, { properties: { tabColor: { argb: o.tab || X.blue } }, views: [{ state: 'frozen', ySplit: 7 }] });
    var widths = [24, 56, 12, 26, 14, 20, 26, 22].concat(extra ? extra.widths : []);
    for (var i = 0; i < n; i++) ws.getColumn(i + 1).width = widths[i];
    var total = round2(sumTotal(list));
    headerBlock(wb, ws, { nCols: n, title: title, total: total, address: o.address });
    tableHeader(ws, 7, headers);
    list.forEach(function (it, idx) {
      var row = ws.getRow(8 + idx);
      var vals = [it.barcode, it.desc, it.qty, it.notes, it.price, it.total, it.cat, it.sec || ''];
      if (extra) vals = vals.concat(extra.values(it));
      vals.forEach(function (v, c) { row.getCell(c + 1).value = v; });
      row.getCell(5).numFmt = RAND; row.getCell(6).numFmt = RAND;
      zebra(row, n, idx);
      if (extra && extra.style) extra.style(row, it);
    });
    var last = 7 + list.length;
    if (list.length) {
      ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: last, column: n } };
      var tr = ws.getRow(last + 2); tr.getCell(2).value = 'TOTAL';
      tr.getCell(6).value = sumFormula(ws, 6, 8, last, total); tr.getCell(6).numFmt = RAND;
      totalRowCells(tr, 1, n);
      ws.getCell(1, n).value = { formula: 'F' + (last + 2), result: total };
      footerNote(ws, last + 4, n);
    } else {
      ws.getCell(8, 2).value = o.emptyText || 'No stock in this section for this stock date.';
      ws.getCell(8, 2).font = { italic: true, color: { argb: 'FF777777' } };
    }
    landscape(ws);
    return ws;
  }
  function byDesc(a, b) { return a.desc.localeCompare(b.desc); }

  // ------------------------------------------------------------------ Exco workbook
  function buildExcoWorkbook() {
    var S = state.settings, t = A.t, wb = newWorkbook();
    var ws = wb.addWorksheet('SUMMARY', { properties: { tabColor: { argb: X.yellow } } });
    [4, 42, 18, 18, 18, 18, 18].forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
    headerBlock(wb, ws, { nCols: 7, title: 'SUMMARY - CURRENT STOCK HOLDING', total: t.TOTAL, totalLabel: 'TOTAL STOCK VALUE', textCol: 3 });
    var r = 7;
    function money(c, v) { c.value = round2(v); c.numFmt = RAND; }
    function block(title, headers) { tableHeader(ws, r, [title].concat(headers), 2); r++; }

    // 1. Current stock holding
    block('Current Stock Holding', ['Value']);
    var first = r;
    [['PTA Current Stock (incl. O&M)', t.PTA], ['Redundant Stock', t.REDUNDANT], ['Attic Stock', t.ATTIC], ['CPT Current Stock', t.CPT]].forEach(function (x, i) {
      var row = ws.getRow(r++); row.getCell(2).value = x[0]; money(row.getCell(3), x[1]); zebra(row, 2, i, 2);
    });
    var tr = ws.getRow(r++); tr.getCell(2).value = 'TOTAL';
    tr.getCell(3).value = { formula: 'SUM(C' + first + ':C' + (r - 2) + ')', result: t.TOTAL }; tr.getCell(3).numFmt = RAND;
    totalRowCells(tr, 2, 3, X.yellow);
    ws.getCell(1, 7).value = { formula: 'C' + (r - 1), result: t.TOTAL };
    var hv = ws.getRow(r++); hv.getCell(2).value = 'High Value Items PTA (line total from ' + fmtR(S.highValue).replace(/\u00a0/g, ' ') + ')'; money(hv.getCell(3), sumTotal(A.high));
    r++;

    // 2. Breakdown matrix
    block('Breakdown', ['PTA', 'CPT']);
    var b = A.bySec;
    [['General Stock', t.PTA_GEN, t.CPT_GEN], ['Small Stock - Consumables', t.PTA_SMALL, t.CPT_SMALL]].forEach(function (x, i) {
      var row = ws.getRow(r++); row.getCell(2).value = x[0]; money(row.getCell(3), x[1]); money(row.getCell(4), x[2]); zebra(row, 3, i, 2);
    });
    var r1 = ws.getRow(r++); r1.getCell(2).value = 'Total without O&M'; money(r1.getCell(3), t.PTA_NO_OM); money(r1.getCell(4), t.CPT_NO_OM); totalRowCells(r1, 2, 4);
    var r2 = ws.getRow(r++); r2.getCell(2).value = 'O&M Stock'; money(r2.getCell(3), t.PTA_OM); money(r2.getCell(4), t.CPT_OM);
    var r3 = ws.getRow(r++); r3.getCell(2).value = 'Current Stock'; money(r3.getCell(3), t.PTA); money(r3.getCell(4), t.CPT); totalRowCells(r3, 2, 4, X.yellow);
    var r4 = ws.getRow(r++); r4.getCell(2).value = 'Lines with stock';
    r4.getCell(3).value = A.ptaLines.length; r4.getCell(4).value = A.cptLines.length;
    r++;

    // 3. Difference from last week
    block('Difference from last week', ['Last week', 'This week', 'Difference', '']);
    if (A.prev) {
      ws.getCell(r - 1, 3).value = 'Last week (' + fmtDate(A.prev.date) + ')';
      [['PTA Current Stock', 'PTA'], ['CPT Current Stock', 'CPT'], ['TOTAL', 'TOTAL']].forEach(function (x, i) {
        var d = diffInfo(x[1]), row = ws.getRow(r++);
        row.getCell(2).value = x[0];
        money(row.getCell(3), A.prev.totals[x[1]] || 0); money(row.getCell(4), t[x[1]]);
        money(row.getCell(5), d ? d.diff : 0);
        row.getCell(6).value = d ? d.word.toUpperCase() : '';
        row.getCell(6).font = { bold: true, color: { argb: d && d.diff < 0 ? 'FF8E3A33' : 'FF2F5E39' } };
        zebra(row, 5, i, 2);
      });
    } else {
      ws.getCell(r++, 2).value = 'No previous week saved yet - this will show from next week.';
    }
    r++;

    // 4. High value rating bands
    block('PTA High Value - value rating', ['Lines', 'Value']);
    VALUE_BANDS.forEach(function (bd, i) {
      var list = A.high.filter(function (it) { return bandOf(it.total) === bd; });
      var row = ws.getRow(r++); row.getCell(2).value = bd.name; row.getCell(3).value = list.length; money(row.getCell(4), sumTotal(list));
      fill(row.getCell(2), bd.fill);
    });
    r++;

    // 5. By category
    block('By category', ['Lines', 'PTA', 'CPT', 'Attic / Redundant', '% of total']);
    var cfirst = r;
    catRows().forEach(function (x, i) {
      var c = x[1], row = ws.getRow(r++);
      row.getCell(2).value = x[0]; row.getCell(3).value = c.lines; money(row.getCell(4), c.PTA); money(row.getCell(5), c.CPT); money(row.getCell(6), c.OTHER);
      row.getCell(7).value = t.TOTAL ? c.value / t.TOTAL : 0; row.getCell(7).numFmt = '0.0%';
      zebra(row, 6, i, 2);
    });
    var ct = ws.getRow(r++); ct.getCell(2).value = 'Total';
    ['C', 'D', 'E', 'F'].forEach(function (L, j) {
      var res = [A.inStock.length, t.PTA, t.CPT, t.ATTIC + t.REDUNDANT][j];
      ct.getCell(3 + j).value = { formula: 'SUM(' + L + cfirst + ':' + L + (r - 2) + ')', result: round2(res) };
      if (j) ct.getCell(3 + j).numFmt = RAND;
    });
    ct.getCell(7).value = 1; ct.getCell(7).numFmt = '0.0%';
    totalRowCells(ct, 2, 7);
    r++;

    // 6. Stock age
    block('Stock age (last movement)', ['Lines', 'Value', '% of total']);
    [['Dead - no movement ' + S.deadMonths + '+ months', A.dead, X.deadFill], ['Slow - no movement ' + S.slowMonths + '-' + S.deadMonths + ' months', A.slow, X.slowFill]].forEach(function (x) {
      var row = ws.getRow(r++), v = sumTotal(x[1]);
      row.getCell(2).value = x[0]; row.getCell(3).value = x[1].length; money(row.getCell(4), v);
      row.getCell(5).value = t.TOTAL ? v / t.TOTAL : 0; row.getCell(5).numFmt = '0.0%';
      for (var c = 2; c <= 5; c++) fill(row.getCell(c), x[2]);
    });
    r++;

    // 7. Other information
    block('Other information', ['Lines', 'Value']);
    var exIn = A.excluded.filter(function (i) { return i.qty > 0; });
    [['Equipment / tools - not in stock value', exIn.length, sumTotal(exIn)],
     ['Items still needing a category', A.review.length, sumTotal(A.review)],
     ['Items with stock but R0 price', A.zeroPrice.length, 0]].forEach(function (x) {
      var row = ws.getRow(r++); row.getCell(2).value = x[0]; row.getCell(3).value = x[1]; money(row.getCell(4), x[2]);
    });
    r++;
    var mv = state.movement;
    var notes = [
      'PTA Current Stock = PTA General + Small Stock + O&M. Attic and Redundant stock are shown separately and are not in PTA or CPT Current Stock. Equipment and tools are not counted as stock.',
      'Small Stock - Consumables = terminations & accessories, fixings & consumables, signage & safety, lighting & small power. All other stock is General Stock.',
      'Stock age: ' + (mv ? 'StockZure movement report ' + fmtDate(mv.from) + ' to ' + fmtDate(mv.to) : 'no movement report loaded') + (A.prior.length ? '; weekly stock lists back to ' + fmtDate(A.prior[A.prior.length - 1].date) : '') + '.',
      'Values = Qty In Stock x Purch. Price from StockZure. Write-downs or disposals must be approved by Finance (CA(SA)).',
      'Generated ' + nowStamp() + ' from "' + current.fileName + '".',
      'This document was developed with the assistance of an AI agent under the direction of qualified RES personnel.'
    ];
    notes.forEach(function (txt, i) {
      var c = ws.getCell(r + i, 2); c.value = txt;
      c.font = { italic: true, size: 9, color: { argb: 'FF555555' } }; c.alignment = { wrapText: true, vertical: 'top' };
      ws.mergeCells(r + i, 2, r + i, 7); ws.getRow(r + i).height = 28;
    });
    ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };

    // ---------- PTA tabs
    var all = current.items.filter(function (it) { return it.cat !== EXCLUDED; });
    var ptaAll = all.filter(function (it) { return it.sec === SEC.PTA_GEN || it.sec === SEC.PTA_SMALL || it.sec === SEC.PTA_OM; });
    var cptAll = all.filter(function (it) { return it.sec === SEC.CPT_GEN || it.sec === SEC.CPT_SMALL || it.sec === SEC.CPT_OM; });
    stockSheet(wb, 'PTA Current Stock', 'PTA CURRENT STOCK HOLDING', ptaAll, { tab: X.blue });
    stockSheet(wb, 'General Stock', 'GENERAL STOCK PTA', b[SEC.PTA_GEN].items.slice().sort(byDesc), { tab: X.grey });
    stockSheet(wb, 'Small Stock-Consumables', 'CONSUMABLES (SMALL STOCK) PTA', b[SEC.PTA_SMALL].items.slice().sort(byDesc), { tab: X.grey });
    stockSheet(wb, 'O&M PTA Stock', 'O&M STOCK PTA', b[SEC.PTA_OM].items.slice().sort(byDesc), { tab: X.grey });
    stockSheet(wb, 'PTA HIGH Value', 'PTA HIGH VALUE - LINE TOTAL FROM ' + fmtR(S.highValue).replace(/\u00a0/g, ' '), A.high, {
      tab: X.yellow,
      extra: {
        headers: ['Value Rating'], widths: [20],
        values: function (it) { return [bandOf(it.total).name]; },
        style: function (row, it) { fill(row.getCell(9), bandOf(it.total).fill); }
      }
    });

    // ---------- CPT tabs
    var cptEmpty = 'No Cape Town stock in this stock list yet. CPT items are recognised by "CPT" or "Cape Town" in the Shelf Barcode or Notes in StockZure.';
    stockSheet(wb, 'CPT CURRENT Stock', 'CAPE TOWN CURRENT STOCK HOLDING', cptAll, { tab: X.clay, address: S.cptAddress, emptyText: cptEmpty });
    stockSheet(wb, 'General Stock CPT', 'GENERAL STOCK CAPE TOWN', b[SEC.CPT_GEN].items.slice().sort(byDesc), { tab: X.clay, address: S.cptAddress, emptyText: cptEmpty });
    stockSheet(wb, 'Small Stock-Consumables CPT', 'CONSUMABLES (SMALL STOCK) CAPE TOWN', b[SEC.CPT_SMALL].items.slice().sort(byDesc), { tab: X.clay, address: S.cptAddress, emptyText: cptEmpty });
    stockSheet(wb, 'O&M CPT Stock', 'O&M STOCK CAPE TOWN', b[SEC.CPT_OM].items.slice().sort(byDesc), { tab: X.clay, address: S.cptAddress, emptyText: cptEmpty });

    // ---------- Attic / Redundant
    var locExtra = { headers: ['Location'], widths: [12], values: function (it) { return [it.loc + (it.om ? ' O&M' : '')]; } };
    stockSheet(wb, 'ATTIC Stock', 'ATTIC STOCK - SPARES KEPT FOR PAST PROJECTS', b[SEC.ATTIC].items.slice().sort(byDesc), { tab: X.dark, extra: locExtra, emptyText: 'No items marked as Attic stock yet. Mark them in the app (step 3 or 5).' });
    stockSheet(wb, 'REDUNDANT Stock', 'REDUNDANT STOCK - CAN BE DISPOSED OF', b[SEC.REDUNDANT].items.slice().sort(byDesc), { tab: X.dark, extra: locExtra, emptyText: 'No items marked as Redundant stock yet. Mark them in the app (step 3 or 5).' });

    deadSlowSheet(wb);
    dataChecksSheet(wb);
    return wb;
  }

  function deadSlowSheet(wb) {
    var S = state.settings;
    var headers = ['Barcode', 'Description', 'Location', 'Category', 'Qty In Stock', 'Purch. Price', 'Total Replacement Value', 'Notes', 'Last moved', 'Based on', 'Months', 'Status', 'Action', 'Comments'];
    var n = headers.length;
    var ws = wb.addWorksheet('Dead & Slow Stock', { properties: { tabColor: { argb: X.clay } }, views: [{ state: 'frozen', ySplit: 7 }] });
    [22, 48, 10, 24, 11, 13, 18, 22, 13, 28, 8, 8, 20, 30].forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
    var list = deadSlowSorted(), tot = round2(sumTotal(list));
    headerBlock(wb, ws, { nCols: n, title: 'DEAD & SLOW STOCK - FOR DECISION', total: tot });
    ws.getCell(5, 2).value = 'Dead = no movement ' + S.deadMonths + '+ months. Slow = no movement ' + S.slowMonths + '-' + S.deadMonths + ' months. Choose an Action per line.';
    ws.getCell(5, 2).font = { italic: true, size: 9, color: { argb: 'FF555555' } };
    tableHeader(ws, 7, headers);
    fill(ws.getRow(7).getCell(13), X.yellow); ws.getRow(7).getCell(13).font = { bold: true, color: { argb: X.dark } };
    list.forEach(function (it, i) {
      var row = ws.getRow(8 + i);
      [it.barcode, it.desc, locLabel(it), it.cat, it.qty, it.price, it.total, it.notes, it.lastMoved ? excelDate(it.lastMoved) : '', it.lastNote, Math.floor(it.months || 0), it.status, '', '']
        .forEach(function (v, c) { row.getCell(c + 1).value = v; });
      row.getCell(6).numFmt = RAND; row.getCell(7).numFmt = RAND; row.getCell(9).numFmt = 'dd mmm yyyy';
      fill(row.getCell(12), it.status === 'Dead' ? X.deadFill : X.slowFill);
      fill(row.getCell(13), X.actionFill);
      row.getCell(13).dataValidation = { type: 'list', allowBlank: true, formulae: ['"Use on project,Move to Attic,Mark Redundant,Return to supplier,Sell,Transfer to CPT,Write off,Keep"'] };
    });
    var last = 7 + list.length;
    if (list.length) {
      ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: last, column: n } };
      var tr = ws.getRow(last + 2); tr.getCell(2).value = 'TOTAL';
      tr.getCell(7).value = sumFormula(ws, 7, 8, last, tot); tr.getCell(7).numFmt = RAND; totalRowCells(tr, 1, n);
      ws.getCell(1, n).value = { formula: 'G' + (last + 2), result: tot };
    } else ws.getCell(8, 2).value = 'No dead or slow stock found.';
    landscape(ws);
  }

  function normName(s) {
    var t = String(s || '').toLowerCase().replace(/[^a-z]/g, '');
    if (t === 'whouse' || t === 'wh' || t === 'warehous') t = 'warehouse';
    return t.replace(/s$/, '');
  }
  function spellingGroups(rows, field) {
    var g = {};
    rows.forEach(function (r) {
      var v = r[field]; if (!v) return;
      var k = normName(v); if (!k) return;
      g[k] = g[k] || {}; g[k][v] = (g[k][v] || 0) + 1;
    });
    return Object.keys(g).filter(function (k) { return Object.keys(g[k]).length > 1; }).map(function (k) {
      return Object.keys(g[k]).map(function (v) { return v + ' (' + g[k][v] + ')'; }).join(' / ');
    });
  }
  function dataChecksSheet(wb) {
    var ws = wb.addWorksheet('Data Checks', { properties: { tabColor: { argb: X.dark } }, views: [{ state: 'frozen', ySplit: 7 }] });
    [40, 24, 52, 12, 16, 44].forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
    var checks = [];
    A.zeroPrice.forEach(function (it) { checks.push(['Stock but R0 price - fix price in StockZure', it.barcode, it.desc, it.qty, it.total, it.notes]); });
    A.dupes.forEach(function (it) { checks.push(['Barcode used on more than one line - merge in StockZure', it.barcode, it.desc, it.qty, it.total, it.shelf]); });
    A.noBarcode.forEach(function (it) { checks.push(['No barcode', '', it.desc, it.qty, it.total, '']); });
    A.excluded.forEach(function (it) { checks.push(['Equipment / tool - left out of stock value', it.barcode, it.desc, it.qty, it.total, it.notes]); });
    if (movRows) {
      spellingGroups(movRows, 'signby').forEach(function (s) { checks.push(['Movement report: "Sign by" spelt different ways', '', s, '', '', 'Pick one spelling in StockZure']); });
      spellingGroups(movRows, 'customer').forEach(function (s) { checks.push(['Movement report: customer spelt different ways', '', s, '', '', 'Pick one spelling in StockZure']); });
      parseAdjustments(movRows).filter(function (a) { return isVagueReason(a.reason); }).forEach(function (a) {
        checks.push(['Adjustment with a vague reason', a.barcode, a.desc, a.change, a.value, a.date + ' - "' + a.reason + '" - ' + a.user]);
      });
      var ret = {};
      movRows.forEach(function (r) { if (r.returns && (r.status === 'OUT' || r.status === 'Reserved')) ret[r.returns] = (ret[r.returns] || 0) + 1; });
      Object.keys(ret).sort(function (a, b) { return ret[b] - ret[a]; }).forEach(function (s) {
        checks.push(['"Returns From Site" filled on OUT / Reserved lines', '', s, ret[s], '', 'Should only be filled when stock comes back from site']);
      });
    }
    headerBlock(wb, ws, { nCols: 6, title: 'DATA CHECKS - ITEMS TO TIDY UP IN STOCKZURE', total: checks.length, totalLabel: 'ITEMS TO CHECK', totalFmt: '0' });
    tableHeader(ws, 7, ['Check', 'Barcode', 'Description / details', 'Qty / lines', 'Value', 'Notes']);
    checks.forEach(function (x, i) {
      var row = ws.getRow(8 + i);
      x.forEach(function (v, c) { row.getCell(c + 1).value = v; });
      row.getCell(5).numFmt = RAND; zebra(row, 6, i);
    });
    if (!checks.length) ws.getCell(8, 1).value = 'No data problems found.';
    else ws.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7 + checks.length, column: 6 } };
    landscape(ws);
  }

  // ------------------------------------------------------------------ audit pack
  function auditRange() {
    var f = $('audFrom').value || state.settings.auditFrom, t = $('audTo').value || state.settings.auditTo;
    return { from: f, to: t };
  }
  function inRange(d, rg) { var x = d.slice(0, 10); return x >= rg.from && x <= rg.to; }
  function buildAuditWorkbook() {
    var rg = auditRange(), mv = state.movement, wb = newWorkbook();
    var rows = movRows.filter(function (r) { return r.date && inRange(r.date, rg); })
      .sort(function (a, b) { return a.date < b.date ? -1 : 1; });
    var adj = parseAdjustments(movRows).filter(function (a) { return a.date && inRange(a.date, rg); });
    var periodTxt = fmtDate(rg.from) + ' to ' + fmtDate(rg.to);

    // ---------- AUDIT SUMMARY
    var ws = wb.addWorksheet('AUDIT SUMMARY', { properties: { tabColor: { argb: X.yellow } } });
    [4, 46, 16, 20, 30].forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
    headerBlock(wb, ws, { nCols: 5, title: 'STOCK AUDIT PACK - ' + periodTxt.toUpperCase(), textCol: 3 });
    var r = 7;
    function line(label, val, fmt) { var row = ws.getRow(r++); row.getCell(2).value = label; row.getCell(3).value = val; if (fmt) row.getCell(3).numFmt = fmt; return row; }
    tableHeader(ws, r++, ['Movements in period', 'Lines', 'Qty', 'Value'], 2);
    ['IN', 'OUT', 'Reserved', 'COUNT'].forEach(function (s, i) {
      var l = rows.filter(function (x) { return x.status === s; });
      var row = ws.getRow(r++);
      row.getCell(2).value = { IN: 'IN - received / returned', OUT: 'OUT - issued to site', Reserved: 'Reserved - on picklists', COUNT: 'COUNT - stock counts' }[s];
      row.getCell(3).value = l.length;
      row.getCell(4).value = round3(l.reduce(function (a, x) { return a + x.qty; }, 0));
      row.getCell(5).value = s === 'COUNT' ? '' : round2(l.reduce(function (a, x) { return a + x.value; }, 0)); row.getCell(5).numFmt = RAND;
      zebra(row, 4, i, 2);
    });
    r++;
    tableHeader(ws, r++, ['Stock on hand (stock list ' + fmtDate(current.date) + ')', 'Lines', 'Value', ''], 2);
    [['PTA Current Stock (incl. O&M)', A.ptaLines.length, A.t.PTA], ['CPT Current Stock', A.cptLines.length, A.t.CPT],
     ['Attic Stock', A.bySec[SEC.ATTIC].lines, A.t.ATTIC], ['Redundant Stock', A.bySec[SEC.REDUNDANT].lines, A.t.REDUNDANT], ['TOTAL', A.inStock.length, A.t.TOTAL]].forEach(function (x, i) {
      var row = ws.getRow(r++); row.getCell(2).value = x[0]; row.getCell(3).value = x[1]; row.getCell(4).value = round2(x[2]); row.getCell(4).numFmt = RAND;
      if (x[0] === 'TOTAL') totalRowCells(row, 2, 4, X.yellow); else zebra(row, 3, i, 2);
    });
    r++;
    tableHeader(ws, r++, ['Controls', 'Count', 'Value', ''], 2);
    line('Quantity adjustments in period', adj.length);
    line('  of which with a vague reason', adj.filter(function (a) { return isVagueReason(a.reason); }).length);
    var adjNet = adj.reduce(function (s, a) { return s + (a.value || 0); }, 0);
    var ar = line('Net value of adjustments', '', null); ar.getCell(4).value = round2(adjNet); ar.getCell(4).numFmt = RAND;
    var dr = line('Dead stock (no movement ' + state.settings.deadMonths + '+ months)', A.dead.length); dr.getCell(4).value = round2(sumTotal(A.dead)); dr.getCell(4).numFmt = RAND;
    var sr = line('Slow stock (no movement ' + state.settings.slowMonths + '-' + state.settings.deadMonths + ' months)', A.slow.length); sr.getCell(4).value = round2(sumTotal(A.slow)); sr.getCell(4).numFmt = RAND;
    line('Spot checks generated (logged in app)', state.spotLog.filter(function (s) { return inRange(s.when, rg); }).length);
    r++;
    var cover = mv ? 'Movement report used: ' + mv.file + ' (' + fmtDate(mv.from) + ' to ' + fmtDate(mv.to) + ').' : '';
    if (mv && (mv.from > rg.from || mv.to < rg.to)) cover += ' NOTE: the report does not cover the whole audit period - export the movement report for ' + periodTxt + ' from StockZure and load it again.';
    [cover, 'Source: StockZure exports. Values = Qty x Purch. Price.', 'Generated ' + nowStamp() + '.',
     'This document was developed with the assistance of an AI agent under the direction of qualified RES personnel.'].forEach(function (txt, i) {
      var c = ws.getCell(r + i, 2); c.value = txt; c.font = { italic: true, size: 9, color: { argb: 'FF555555' } }; c.alignment = { wrapText: true };
      ws.mergeCells(r + i, 2, r + i, 5); ws.getRow(r + i).height = 28;
    });
    ws.pageSetup = { orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0, paperSize: 9 };

    // ---------- Movement Register
    var mh = ['Date', 'Status', 'Barcode', 'Description', 'Qty', 'Purch. Price', 'Value', 'Customer', 'Job No.', 'Sign by', 'Returns From Site', 'Supplier', 'Shelf', 'Notes', 'Captured by'];
    var wm = wb.addWorksheet('Movement Register', { properties: { tabColor: { argb: X.blue } }, views: [{ state: 'frozen', ySplit: 7 }] });
    [17, 10, 22, 44, 8, 12, 14, 24, 10, 14, 18, 16, 16, 18, 40].forEach(function (w, i) { wm.getColumn(i + 1).width = w; });
    headerBlock(wb, wm, { nCols: mh.length, title: 'MOVEMENT REGISTER - ' + periodTxt.toUpperCase(), total: rows.length, totalLabel: 'LINES', totalFmt: '0' });
    tableHeader(wm, 7, mh);
    rows.forEach(function (x, i) {
      var row = wm.getRow(8 + i);
      [x.date, x.status, x.barcode, x.desc, x.qty, x.price, x.value, x.customer, x.job, x.signby, x.returns, x.supplier, x.shelf, x.notes, x.user]
        .forEach(function (v, c) { row.getCell(c + 1).value = v; });
      row.getCell(6).numFmt = RAND; row.getCell(7).numFmt = RAND;
      if (x.status === 'IN') fill(row.getCell(2), X.okFill); else if (x.status === 'OUT') fill(row.getCell(2), X.deadFill); else if (x.status === 'Reserved') fill(row.getCell(2), X.slowFill);
    });
    if (rows.length) wm.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7 + rows.length, column: mh.length } };
    else wm.getCell(8, 2).value = 'No movements in this period in the loaded report.';
    landscape(wm);

    // ---------- Adjustments Register
    var ah = ['Date', 'Barcode', 'Description', 'Qty from', 'Qty to', 'Change', 'Purch. Price', 'Value of change', 'Adjusted by', 'Reason', 'Reason OK?'];
    var wa = wb.addWorksheet('Adjustments Register', { properties: { tabColor: { argb: X.clay } }, views: [{ state: 'frozen', ySplit: 7 }] });
    [17, 22, 44, 9, 9, 9, 12, 15, 36, 30, 11].forEach(function (w, i) { wa.getColumn(i + 1).width = w; });
    headerBlock(wb, wa, { nCols: ah.length, title: 'ADJUSTMENTS REGISTER - ' + periodTxt.toUpperCase(), total: round2(adjNet), totalLabel: 'NET VALUE' });
    tableHeader(wa, 7, ah);
    adj.forEach(function (a, i) {
      var row = wa.getRow(8 + i), vague = isVagueReason(a.reason);
      [a.date, a.barcode, a.desc, a.from, a.to, a.change, a.price, a.value, a.user, a.reason, vague ? 'Too vague' : 'OK']
        .forEach(function (v, c) { row.getCell(c + 1).value = v; });
      row.getCell(7).numFmt = RAND; row.getCell(8).numFmt = RAND;
      fill(row.getCell(11), vague ? X.slowFill : X.okFill);
    });
    if (adj.length) wa.autoFilter = { from: { row: 7, column: 1 }, to: { row: 7 + adj.length, column: ah.length } };
    else wa.getCell(8, 2).value = 'No quantity adjustments in this period.';
    landscape(wa);

    // ---------- Dead & Slow, Stock on Hand, Spot check log
    deadSlowSheet(wb);
    stockSheet(wb, 'Stock on Hand', 'STOCK ON HAND - ALL LOCATIONS', A.inStock.slice().sort(byDesc), {
      tab: X.grey, extra: { headers: ['Location', 'Last moved'], widths: [12, 14], values: function (it) { return [locLabel(it), it.lastMoved ? excelDate(it.lastMoved) : '']; }, style: function (row) { row.getCell(10).numFmt = 'dd mmm yyyy'; } }
    });
    var wl = wb.addWorksheet('Spot Check Log', { properties: { tabColor: { argb: X.dark } } });
    [18, 14, 10, 12, 14, 80].forEach(function (w, i) { wl.getColumn(i + 1).width = w; });
    headerBlock(wb, wl, { nCols: 6, title: 'RANDOM SPOT CHECKS GENERATED', textCol: 2 });
    tableHeader(wl, 7, ['Generated', 'Location', 'Items', 'Picked from', 'Stock list date', 'Barcodes picked']);
    state.spotLog.forEach(function (s, i) {
      var row = wl.getRow(8 + i);
      [s.when, s.location, s.n, s.pool, s.stockDate, s.items.join(', ')].forEach(function (v, c) { row.getCell(c + 1).value = v; });
    });
    if (!state.spotLog.length) wl.getCell(8, 1).value = 'No spot checks generated yet.';
    return wb;
  }

  // ------------------------------------------------------------------ item history
  var histKey = null;
  function itemMatches(q) {
    var seen = {}, out = [];
    function add(k, barcode, desc) { if (k && !seen[k]) { seen[k] = 1; out.push({ k: k, barcode: barcode, desc: desc }); } }
    (current ? current.items : []).forEach(function (it) { if ((it.barcode + ' ' + it.desc).toLowerCase().indexOf(q) > -1) add(it.k, it.barcode, it.desc); });
    (movRows || []).forEach(function (r) { if ((r.barcode + ' ' + r.desc).toLowerCase().indexOf(q) > -1) add(r.k, r.barcode, r.desc); });
    return out;
  }
  function renderHistPick() {
    var q = $('histSearch').value.trim().toLowerCase();
    histKey = null; $('btnHistDl').disabled = true; $('itemHistTable').innerHTML = '';
    if (q.length < 2) { $('histPick').innerHTML = ''; return; }
    if (!movRows) { $('histPick').innerHTML = '<div class="notice warn">Load the movement report in step 1 to see item history.</div>'; return; }
    var m = itemMatches(q).slice(0, 12);
    $('histPick').innerHTML = m.length ? m.map(function (x) { return '<button class="btn small ghost" style="margin:2px" data-hk="' + esc(x.k) + '">' + esc(x.desc || x.barcode) + '</button>'; }).join('') : '<span class="muted">No matching items.</span>';
  }
  function itemHistoryRows(k) {
    return movRows.filter(function (r) { return r.k === k; }).sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }
  function showItemHistory(k) {
    histKey = k;
    var rows = itemHistoryRows(k), it = current ? current.items.filter(function (x) { return x.k === k; }) : [];
    var qty = it.reduce(function (s, x) { return s + x.qty; }, 0);
    var h = '<thead><tr><th>Date</th><th>Status</th><th class="num">Qty</th><th>Customer / Job</th><th>Sign by</th><th>Captured by</th></tr></thead><tbody>';
    rows.forEach(function (r) {
      h += '<tr><td>' + esc(r.date) + '</td><td>' + esc(r.status) + '</td><td class="num">' + fmtQty(r.qty) + '</td><td>' + esc(r.customer) + (r.job ? ' (' + esc(r.job) + ')' : '') + '</td><td>' + esc(r.signby) + '</td><td class="muted">' + esc(r.user) + '</td></tr>';
    });
    if (!rows.length) h += '<tr><td colspan="6" class="muted">No movements for this item in the loaded report.</td></tr>';
    $('itemHistTable').innerHTML = h + '</tbody>';
    $('histPick').innerHTML = '<div class="muted"><strong>' + esc((it[0] || rows[0] || {}).desc || k) + '</strong> - in stock now: ' + fmtQty(qty) + ' - ' + rows.length + ' movement(s)</div>';
    $('btnHistDl').disabled = false;
  }
  function buildItemHistoryWorkbook(k) {
    var rows = itemHistoryRows(k), wb = newWorkbook(), it = current ? current.items.filter(function (x) { return x.k === k; }) : [];
    var first = it[0] || rows[0] || { barcode: k, desc: '' };
    var ws = wb.addWorksheet('Item History', { views: [{ state: 'frozen', ySplit: 9 }] });
    var hd = ['Date', 'Status', 'Qty', 'Purch. Price', 'Value', 'Customer', 'Job No.', 'Sign by', 'Returns From Site', 'Supplier', 'Notes', 'Captured by', 'Qty adjustment'];
    [17, 10, 8, 12, 14, 24, 10, 14, 18, 16, 18, 38, 44].forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
    headerBlock(wb, ws, { nCols: hd.length, title: 'ITEM HISTORY' });
    ws.getCell(5, 2).value = 'Barcode: ' + first.barcode + '   |   ' + first.desc;
    ws.getCell(5, 2).font = { bold: true };
    ws.getCell(6, 2).value = 'In stock on ' + fmtDate(current ? current.date : todayISO()) + ': ' + it.reduce(function (s, x) { return s + x.qty; }, 0) +
      (state.movement ? '   |   Movement report ' + fmtDate(state.movement.from) + ' to ' + fmtDate(state.movement.to) : '');
    tableHeader(ws, 9, hd);
    rows.forEach(function (r, i) {
      var row = ws.getRow(10 + i);
      [r.date, r.status, r.qty, r.price, r.value, r.customer, r.job, r.signby, r.returns, r.supplier, r.notes, r.user, r.adj].forEach(function (v, c) { row.getCell(c + 1).value = v; });
      row.getCell(4).numFmt = RAND; row.getCell(5).numFmt = RAND; row.getCell(13).alignment = { wrapText: true };
      zebra(row, hd.length, i);
    });
    footerNote(ws, 12 + rows.length, hd.length);
    landscape(ws);
    return { wb: wb, name: 'RES Item History ' + String(first.barcode).replace(/[^A-Za-z0-9 _-]/g, '_') + ' ' + todayISO() + '.xlsx' };
  }

  // ------------------------------------------------------------------ random spot check
  function randInt(n) {
    if (window.crypto && window.crypto.getRandomValues) {
      var a = new Uint32Array(1), lim = Math.floor(0x100000000 / n) * n;
      do { window.crypto.getRandomValues(a); } while (a[0] >= lim);
      return a[0] % n;
    }
    return Math.floor(Math.random() * n);
  }
  function pickSpot() {
    var loc = $('spotLoc').value, n = Math.max(1, Math.min(50, Math.round(num($('spotN').value)) || 10));
    var pool = A.inStock.filter(function (it) { return loc === 'ALL' || it.loc === loc; });
    if (!pool.length) { notice($('spotInfo'), 'warn', 'No stock found for this location in the loaded stock list.'); return; }
    var arr = pool.slice(), chosen = [];
    for (var i = 0; i < Math.min(n, arr.length); i++) {
      var j = i + randInt(arr.length - i), tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp; chosen.push(arr[i]);
    }
    var locName = { PTA: 'PTA (incl. O&M)', CPT: 'Cape Town', ALL: 'All locations' }[loc];
    spot = { when: nowStamp(), location: locName, n: chosen.length, pool: pool.length, stockDate: current.date, file: current.fileName, items: chosen };
    state.spotLog.push({ when: spot.when, location: locName, n: chosen.length, pool: pool.length, stockDate: current.date, items: chosen.map(function (x) { return x.barcode; }) });
    saveStore();
    $('spotInfo').innerHTML = 'Generated ' + esc(spot.when) + ': ' + chosen.length + ' lines picked at random by computer from ' + pool.length + ' lines with stock (' + esc(locName) + ', stock list ' + fmtDate(current.date) + '). Saved to the spot check log.';
    var h = '<thead><tr><th>#</th><th>Barcode</th><th>Description</th><th>Shelf</th><th>Location</th><th class="num">System qty</th></tr></thead><tbody>';
    chosen.forEach(function (it, i) { h += '<tr><td>' + (i + 1) + '</td><td>' + esc(it.barcode) + '</td><td>' + esc(it.desc) + '</td><td>' + esc(it.shelf) + '</td><td>' + esc(locLabel(it)) + '</td><td class="num">' + fmtQty(it.qty) + '</td></tr>'; });
    $('spotTable').innerHTML = h + '</tbody>';
    $('btnSpotDl').disabled = false;
    renderSpotLog();
  }
  function buildSpotWorkbook() {
    var wb = newWorkbook(), ws = wb.addWorksheet('Spot Check');
    [5, 22, 46, 18, 12, 12, 12, 12, 26].forEach(function (w, i) { ws.getColumn(i + 1).width = w; });
    headerBlock(wb, ws, { nCols: 9, title: 'RANDOM SPOT CHECK - STOCK COUNT SHEET', textCol: 3 });
    ws.getCell(5, 3).value = 'Generated ' + spot.when + '  |  ' + spot.location + '  |  ' + spot.n + ' lines picked at random by computer from ' + spot.pool + ' lines with stock on stock list ' + fmtDate(spot.stockDate) + ' (' + spot.file + ')';
    ws.getCell(5, 3).font = { size: 9, italic: true };
    var r = 7;
    ws.getCell(r, 1).value = 'PART A - SHEET TO FLOOR: find each item on the shelves and count it.'; ws.getCell(r, 1).font = { bold: true, size: 12 }; r++;
    tableHeader(ws, r++, ['#', 'Barcode', 'Description', 'Shelf', 'Location', 'System qty', 'Counted qty', 'Variance', 'Comment']);
    spot.items.forEach(function (it, i) {
      var row = ws.getRow(r++);
      [i + 1, it.barcode, it.desc, it.shelf, locLabel(it), it.qty, '', '', ''].forEach(function (v, c) { row.getCell(c + 1).value = v; });
      row.height = 24; boxRow(row, 1, 9); row.getCell(3).alignment = { wrapText: true, vertical: 'middle' };
      fill(row.getCell(7), X.actionFill);
    });
    r++;
    ws.getCell(r, 1).value = 'PART B - FLOOR TO SHEET: pick items off the shelves, record them, then check them against the stock list.'; ws.getCell(r, 1).font = { bold: true, size: 12 }; r++;
    tableHeader(ws, r++, ['#', 'Barcode (from label)', 'Description', 'Shelf / bin', 'Counted qty', 'Qty on stock list', 'Variance', 'Found on list?', 'Comment']);
    for (var i = 0; i < spot.n; i++) {
      var row = ws.getRow(r++); row.getCell(1).value = i + 1; row.height = 24; boxRow(row, 1, 9);
    }
    r++;
    [['Counted by:', 'Signature:', 'Date:'], ['Checked by:', 'Signature:', 'Date:'], ['Auditor (if present):', 'Signature:', 'Date:']].forEach(function (x) {
      var row = ws.getRow(r++); row.height = 30;
      row.getCell(2).value = x[0]; row.getCell(4).value = x[1]; row.getCell(7).value = x[2];
      [3, 5, 6, 8, 9].forEach(function (c) { row.getCell(c).border = { bottom: { style: 'thin', color: { argb: X.dark } } }; });
      row.getCell(2).font = row.getCell(4).font = row.getCell(7).font = { bold: true };
    });
    r++;
    footerNote(ws, r, 9);
    landscape(ws);
    return wb;
  }

  // ------------------------------------------------------------------ actions
  function download(wb, name) {
    return wb.xlsx.writeBuffer().then(function (buf) {
      var blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob); a.download = name;
      document.body.appendChild(a); a.click();
      setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
    });
  }
  function runBusy(btn, label, msg, work) {
    if (btn.disabled) return;
    var old = btn.textContent; btn.disabled = true; btn.textContent = label;
    loaderShow(msg);
    setTimeout(function () {
      Promise.resolve().then(work).catch(function (e) { window.alert('Something went wrong: ' + (e.message || e)); })
        .then(function () { btn.disabled = false; btn.textContent = old; loaderHide(); });
    }, 40);
  }
  function loadLogo() {
    try {
      return fetch('logo.png').then(function (r) { return r.ok ? r.blob() : null; }).then(function (b) {
        if (!b) return;
        return new Promise(function (res) {
          var fr = new FileReader();
          fr.onload = function () { logoB64 = String(fr.result).split(',')[1] || null; res(); };
          fr.onerror = function () { res(); };
          fr.readAsDataURL(b);
        });
      }).catch(function () { /* no logo - reports still work */ });
    } catch (e) { return Promise.resolve(); }
  }
  function handleFile(file) {
    if (!file) return;
    if (!EXCEL_EXT.test(file.name)) { notice($('parseMsg'), 'err', 'Please choose an Excel file (.xlsx or .xlsb).'); return; }
    notice($('parseMsg'), 'warn', 'Reading ' + esc(file.name) + '...');
    loaderShow('Reading stock list...');
    file.arrayBuffer().then(function (buf) { return readStockList(buf, file.name); }).then(function (res) {
      var dn = dateFromName(file.name);
      current = { fileName: file.name, date: dn || todayISO(), items: res.items, dateConfirmed: !!dn };
      $('reportDate').value = dn || '';
      $('fileInfo').innerHTML = '<strong>' + esc(file.name) + '</strong><br>Sheet "' + esc(res.sheet) + '" - ' + res.items.length + ' lines' +
        (dn ? '<br>Stock date taken from the file name: ' + fmtDate(dn) : '');
      $('parseMsg').innerHTML = ''; $('genMsg').innerHTML = '';
      setDateWarning(); $('spotTable').innerHTML = ''; $('spotInfo').innerHTML = '';
      $('btnSpotDl').disabled = true; spot = null;
      renderReviewFilter(); renderAll(); renderSpotLog();
      show($('results'));
    }).catch(function (e) {
      notice($('parseMsg'), 'err', 'Could not read this file: ' + esc(e.message || e));
    }).then(loaderHide, loaderHide);
  }
  function handleMovement(file) {
    if (!file) return;
    if (!EXCEL_EXT.test(file.name)) { notice($('movMsg'), 'err', 'Please choose an Excel file (.xlsx or .xlsb).'); return; }
    loaderShow('Reading movement report...');
    file.arrayBuffer().then(function (buf) { return readMovement(buf, file.name); }).then(function (rows) {
      movRows = rows;
      var p = movementPeriod(rows, file.name), last = {};
      rows.forEach(function (r) { if (isMove(r) && r.k && r.date) { var d = r.date.slice(0, 10); if (!last[r.k] || d > last[r.k]) last[r.k] = d; } });
      state.movement = { file: file.name, from: p.from, to: p.to, uploaded: nowStamp(), last: last };
      saveStore();
      notice($('movMsg'), 'ok', 'Loaded ' + rows.length + ' movement lines (' + fmtDate(p.from) + ' to ' + fmtDate(p.to) + '). Last-moved dates saved for dead stock.');
      renderMovInfo();
      if (current) renderAll();
    }).catch(function (e) {
      notice($('movMsg'), 'err', 'Could not read this file: ' + esc(e.message || e));
    }).then(loaderHide, loaderHide);
  }
  function setDateWarning() {
    var need = current && !current.dateConfirmed;
    $('reportDate').classList.toggle('needdate', !!need);
    $('dateMsg').innerHTML = need ? '<div class="notice err"><strong>Choose the stock date.</strong> This file name has no date in it. Pick the date the stock list was exported. Stock age, history and "difference from last week" all depend on it. Nothing can be saved until you do.</div>' : '';
  }
  // Checks before saving this stock list to history. Returns true if OK to save.
  function okToSave() {
    if (!current) return false;
    if (!current.dateConfirmed) {
      setDateWarning();
      $('reportDate').scrollIntoView({ behavior: 'smooth', block: 'center' }); $('reportDate').focus();
      return false;
    }
    if (current.date > todayISO() && !window.confirm('The stock date ' + fmtDate(current.date) + ' is in the future. Save it anyway?')) return false;
    if (state.history.some(function (s) { return s.date === current.date; }) &&
      !window.confirm('History already has a stock list for ' + fmtDate(current.date) + '. Replace it with "' + current.fileName + '"?')) return false;
    return true;
  }
  function saveToHistory(source) {
    putSnapshot(snapshotFrom(current.items, current.date, source + ': ' + current.fileName, A.t));
    renderAll();
  }
  function saveHistoryOnly() {
    if (!okToSave()) { if (current && !current.dateConfirmed) notice($('genMsg'), 'err', 'Choose the stock date in step 1 first.'); return; }
    renderAll();
    saveToHistory('Saved stock list');
    notice($('genMsg'), 'ok', 'Saved the stock list for ' + fmtDate(current.date) + ' to history.' + (state.storageOK ? '' : ' <strong>Warning:</strong> history could not be saved in this browser.'));
  }
  function generateExco() {
    if (!current) return;
    if (!okToSave()) { if (!current.dateConfirmed) notice($('genMsg'), 'err', 'Choose the stock date in step 1 first.'); return; }
    runBusy($('btnGenerate'), 'Building...', 'Building Exco workbook...', function () {
      renderAll();
      var wb = buildExcoWorkbook(), name = 'RES Stock Breakdown ' + current.date + '.xlsx';
      return download(wb, name).then(function () {
        saveToHistory('Weekly report');
        notice($('genMsg'), 'ok', 'Downloaded <strong>' + esc(name) + '</strong>. This week (' + fmtDate(current.date) + ') is saved to history.' +
          (state.storageOK ? '' : ' <strong>Warning:</strong> history could not be saved in this browser.'));
      });
    });
  }
  function generateAudit() {
    if (!current) return;
    if (!movRows) { notice($('audMsg'), 'warn', 'Load the StockZure movement report in step 1 first (this session).'); return; }
    var rg = auditRange();
    if (rg.from > rg.to) { notice($('audMsg'), 'err', 'The "from" date is after the "to" date.'); return; }
    runBusy($('btnAudit'), 'Building...', 'Building audit pack...', function () {
      var wb = buildAuditWorkbook(), name = 'RES Stock Audit Pack ' + rg.from + ' to ' + rg.to + '.xlsx';
      return download(wb, name).then(function () {
        var mv = state.movement, warn = mv && (mv.from > rg.from || mv.to < rg.to);
        notice($('audMsg'), warn ? 'warn' : 'ok', 'Downloaded <strong>' + esc(name) + '</strong>.' + (warn ? ' Note: the loaded movement report covers ' + fmtDate(mv.from) + ' to ' + fmtDate(mv.to) + ', not the whole audit period.' : ''));
      });
    });
  }
  function setMark(k, val) {
    if (!k) { window.alert('This line has no barcode, so the choice can\'t be remembered. Add a barcode in StockZure.'); return; }
    if (val) state.marks[k] = val; else delete state.marks[k];
    saveStore();
  }
  function rerenderKeepScroll() {
    var s1 = $('reviewTable').parentNode.scrollTop, s2 = $('deadTable').parentNode.scrollTop;
    renderAll();
    $('reviewTable').parentNode.scrollTop = s1; $('deadTable').parentNode.scrollTop = s2;
  }
  function addOldExport(file) {
    var d = $('oldDate').value || dateFromName(file.name);
    if (!d) { notice($('oldMsg'), 'err', 'Choose the date of that export first.'); $('oldInput').value = ''; return; }
    loaderShow('Adding to history...');
    file.arrayBuffer().then(function (buf) { return readStockList(buf, file.name); }).then(function (res) {
      categorise(res.items);
      if (state.history.some(function (s) { return s.date === d; }) && !window.confirm('There is already a stock list for ' + fmtDate(d) + ' in history. Replace it?')) { $('oldMsg').innerHTML = ''; return; }
      putSnapshot(snapshotFrom(res.items, d, 'Older export: ' + file.name));
      notice($('oldMsg'), 'ok', 'Added ' + fmtDate(d) + ' to history.');
      renderHistory(); if (current) renderAll();
    }).catch(function (e) { notice($('oldMsg'), 'err', 'Could not read this file: ' + esc(e.message || e)); })
      .then(function () { $('oldInput').value = ''; loaderHide(); });
  }
  function downloadBackup() {
    var data = { app: 'res-stock-breakdown', version: 2, exported: new Date().toISOString(), settings: state.settings, overrides: state.overrides, marks: state.marks, history: state.history, movement: state.movement, spotLog: state.spotLog };
    var blob = new Blob([JSON.stringify(data)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'RES stock breakdown backup ' + todayISO() + '.json';
    document.body.appendChild(a); a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 4000);
  }
  function restoreBackup(file) {
    file.text().then(function (txt) {
      var d = JSON.parse(txt);
      if (d.app !== 'res-stock-breakdown' || !Array.isArray(d.history)) throw new Error('This is not a Stock Breakdown backup file.');
      if (!window.confirm('Replace the history and choices in this browser with the backup from ' + (d.exported || '').slice(0, 10) + '?')) return;
      state.settings = Object.assign({}, DEFAULT_SETTINGS, d.settings || {});
      state.overrides = d.overrides || {}; state.marks = d.marks || {};
      state.history = d.history; state.movement = d.movement || null; state.spotLog = d.spotLog || [];
      saveStore(); renderSettings(); renderHistory(); renderMovInfo(); renderSpotLog();
      if (current) { renderReviewFilter(); renderAll(); }
      window.alert('Backup restored: ' + state.history.length + ' stock list(s).');
    }).catch(function (e) { window.alert('Could not restore: ' + (e.message || e)); })
      .then(function () { $('restoreInput').value = ''; });
  }

  // ------------------------------------------------------------------ wire up
  function dropZone(zoneId, inputId, handler) {
    var z = $(zoneId);
    $(inputId).addEventListener('change', function (e) { handler(e.target.files[0]); e.target.value = ''; });
    ['dragenter', 'dragover'].forEach(function (ev) { z.addEventListener(ev, function (e) { e.preventDefault(); z.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { z.addEventListener(ev, function (e) { e.preventDefault(); z.classList.remove('over'); }); });
    z.addEventListener('drop', function (e) { if (e.dataTransfer.files[0]) handler(e.dataTransfer.files[0]); });
  }
  function init() {
    loadStore();
    if (!state.storageOK) show($('storageWarn'));
    renderSettings(); renderHistory(); renderMovInfo();
    $('reportDate').value = todayISO();
    loadLogo();
    dropZone('drop', 'fileInput', handleFile);
    dropZone('dropMov', 'movInput', handleMovement);
    $('reportDate').addEventListener('change', function () {
      if (current && this.value) { current.date = this.value; current.dateConfirmed = true; setDateWarning(); renderAll(); }
    });
    $('btnSaveHist').addEventListener('click', saveHistoryOnly);
    $('reviewFilter').addEventListener('change', renderReview);
    $('reviewSearch').addEventListener('input', renderReview);
    function onSelect(e) {
      var sel = e.target, k = sel.getAttribute('data-k');
      if (sel.classList.contains('cat')) {
        if (!sel.value) return;
        if (!k) { window.alert('This line has no barcode, so the choice can\'t be remembered. Add a barcode in StockZure.'); return; }
        var it = current.items.filter(function (x) { return x.k === k; })[0];
        if (it && sel.value === autoCategory(it)) delete state.overrides[k]; else state.overrides[k] = sel.value;
        saveStore(); rerenderKeepScroll();
      } else if (sel.classList.contains('mark')) {
        setMark(k, sel.value); rerenderKeepScroll();
      }
    }
    $('reviewTable').addEventListener('change', onSelect);
    $('deadTable').addEventListener('change', onSelect);
    $('btnGenerate').addEventListener('click', generateExco);
    $('btnAudit').addEventListener('click', generateAudit);
    $('histSearch').addEventListener('input', renderHistPick);
    $('histPick').addEventListener('click', function (e) { var k = e.target.getAttribute && e.target.getAttribute('data-hk'); if (k) showItemHistory(k); });
    $('btnHistDl').addEventListener('click', function () {
      if (!histKey) return;
      runBusy($('btnHistDl'), 'Building...', 'Building item history...', function () { var x = buildItemHistoryWorkbook(histKey); return download(x.wb, x.name); });
    });
    $('btnSpot').addEventListener('click', function () { if (current) pickSpot(); });
    $('btnSpotDl').addEventListener('click', function () {
      if (!spot) return;
      runBusy($('btnSpotDl'), 'Building...', 'Building count sheet...', function () {
        return download(buildSpotWorkbook(), 'RES Spot Check ' + spot.when.replace(/[: ]/g, '-') + '.xlsx');
      });
    });
    $('histTable').addEventListener('click', function (e) {
      var d = e.target.getAttribute && e.target.getAttribute('data-del');
      if (!d || !window.confirm('Remove the stock list for ' + fmtDate(d) + ' from history?')) return;
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
      S.cptAddress = $('setCptAddress').value.trim() || DEFAULT_SETTINGS.cptAddress;
      S.auditFrom = $('setAudFrom').value || DEFAULT_SETTINGS.auditFrom;
      S.auditTo = $('setAudTo').value || DEFAULT_SETTINGS.auditTo;
      $('audFrom').value = S.auditFrom; $('audTo').value = S.auditTo;
      saveStore(); renderSettings();
      notice($('setMsg'), 'ok', 'Settings saved.');
      if (current) renderAll();
    });
    $('btnResetCats').addEventListener('click', function () {
      if (!window.confirm('Clear all the categories you picked by hand?')) return;
      state.overrides = {}; saveStore(); notice($('setMsg'), 'ok', 'Category choices cleared.'); if (current) renderAll();
    });
    $('btnResetMarks').addEventListener('click', function () {
      if (!window.confirm('Clear all Attic and Redundant marks?')) return;
      state.marks = {}; saveStore(); notice($('setMsg'), 'ok', 'Attic / Redundant marks cleared.'); if (current) renderAll();
    });
    renderSpotLog();
  }

  if (typeof ExcelJS === 'undefined') {
    document.addEventListener('DOMContentLoaded', function () {
      notice($('parseMsg'), 'err', 'The Excel library did not load. Check that exceljs.min.js is in the main folder of the GitHub repo (next to index.html), then refresh the page.');
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
