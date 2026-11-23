/**
 * Fotky z akce – serverová část pro Google Apps Script.
 *
 * Ukládá fotky a videa v plné velikosti na Disk Google účtu, pod kterým je skript
 * nasazený (složka „Fotky z akcí“), a posílá příjemci e-mail s odkazy ke stažení.
 *
 * Nasazení: script.google.com → Nový projekt → vložit tento kód → Uložit →
 * Nasadit → Nové nasazení → Typ: Webová aplikace, Spustit jako: Já,
 * Kdo má přístup: Kdokoli → Nasadit → povolit přístup → zkopírovat adresu webové aplikace.
 *
 * Adresu nasazení sdílejte jen s partou: kdo ji zná, může na Disk nahrávat.
 */

// Volitelné: pevný příjemce. Když je vyplněný, e-mail jde vždy sem, ať je v aplikaci cokoli.
const PRIJEMCE = "";

const KORENOVA_SLOZKA = "Fotky z akcí";
const VERZE = 3;
const RELACE = /^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?/;

function doGet(e) {
  const t = e && e.parameter && e.parameter.smazat;
  if (t) return strankaSmazani(String(t));
  return ContentService.createTextOutput("Fotky z akce: skript běží. Adresu této stránky vložte do aplikace.");
}

// ── Uvolnění místa odkazem z e-mailu ──
// Příjemce nemusí být vlastník Disku: soubory, které mu byly zpřístupněné, by sám smazat nemohl.
// Odkaz nese náhodný kód a smaže jen soubory dané akce (případně jednoho odesílatele) nahrané do okamžiku e-mailu.
function kodSmazani(akce, od) {
  const t = Utilities.getUuid().replace(/-/g, "");
  PropertiesService.getScriptProperties().setProperty("t" + t, JSON.stringify({ akce: akce, od: od || null, until: Date.now(), exp: Date.now() + 90 * 864e5 }));
  return ScriptApp.getService().getUrl() + "?smazat=" + t;
}

function nactiKod(t) {
  const v = PropertiesService.getScriptProperties().getProperty("t" + String(t).replace(/[^0-9a-f]/gi, ""));
  if (!v) return null;
  const d = JSON.parse(v);
  return Date.now() > d.exp ? null : d;
}

function najdi(rodic, jmeno) {
  const it = rodic ? rodic.getFoldersByName(jmeno) : null;
  return it && it.hasNext() ? it.next() : null;
}

function kSmazani(d) {
  const ev = najdi(najdi(DriveApp.getRootFolder(), KORENOVA_SLOZKA), d.akce);
  if (!ev) return [];
  const slozkyOd = [];
  if (d.od) { const f = najdi(ev, d.od); if (f) slozkyOd.push(f); }
  else { const it = ev.getFolders(); while (it.hasNext()) slozkyOd.push(it.next()); }
  const out = [];
  slozkyOd.forEach((f) => {
    const it = f.getFiles();
    while (it.hasNext()) { const x = it.next(); if (x.getDateCreated().getTime() <= d.until) out.push(x); }
  });
  return out;
}

function strankaSmazani(t) {
  const d = nactiKod(t), files = d ? kSmazani(d) : [];
  const celkem = files.reduce((a, f) => a + f.getSize(), 0);
  const co = d ? (d.od ? "soubory od " + esc(d.od) + " z akce " + esc(d.akce) : "všechny fotky a videa z akce " + esc(d.akce)) : "";
  const telo = !d ? "<p>Tento odkaz už neplatí.</p>"
    : !files.length ? "<p>Na Disku už není co mazat: " + co + " už byly smazané.</p>"
    : "<p>Smaže se " + co + ": <b>" + files.length + " souborů, " + velikost(celkem) + "</b>.</p>" +
      "<p><b>Nejdřív si je stáhněte.</b> Smazání nejde vrátit. Nic jiného na Disku se nesmaže.</p>" +
      '<button id="b" onclick="this.disabled=true;this.textContent=\'Mažu…\';google.script.run.withSuccessHandler(function(m){document.getElementById(\'v\').textContent=m;document.getElementById(\'b\').remove();}).withFailureHandler(function(e){document.getElementById(\'v\').textContent=\'Smazání se nepodařilo: \'+e.message;}).smazatPotvrzeno(\'' + t.replace(/[^0-9a-f]/gi, "") + '\')">Mám staženo, smazat z Disku</button>' +
      '<p id="v"></p>';
  return HtmlService.createHtmlOutput(
    '<div style="font:17px/1.45 -apple-system,Segoe UI,Roboto,sans-serif;max-width:520px;margin:24px auto;padding:0 16px">' +
    "<h2>Uvolnit místo na Disku</h2>" + telo +
    "<style>button{font:inherit;font-weight:600;padding:14px 18px;border:0;border-radius:12px;background:#d92d20;color:#fff;width:100%}#v{font-weight:600}</style></div>")
    .setTitle("Uvolnit místo")
    .addMetaTag("viewport", "width=device-width, initial-scale=1");
}

// Volá se ze stránky po potvrzení. Soubory maže natrvalo, aby se místo opravdu uvolnilo (koš by ho dál zabíral).
function smazatPotvrzeno(t) {
  const d = nactiKod(t);
  if (!d) return "Tento odkaz už neplatí.";
  const files = kSmazani(d).slice(0, 400);
  let n = 0, b = 0;
  files.forEach((f) => {
    const size = f.getSize();
    const res = UrlFetchApp.fetch("https://www.googleapis.com/drive/v3/files/" + f.getId(), {
      method: "delete", headers: { Authorization: "Bearer " + ScriptApp.getOAuthToken() }, muteHttpExceptions: true,
    });
    if (res.getResponseCode() === 204 || res.getResponseCode() === 200) { n++; b += size; }
  });
  PropertiesService.getScriptProperties().deleteProperty("plnoUpozorneno"); // při dalším zaplnění zase upozornit
  const zbyva = kSmazani(d).length, m = misto();
  return "Smazáno " + n + " souborů, uvolněno " + velikost(b) + "." + (m.free !== null ? " Na Disku je teď volno " + velikost(m.free) + "." : "") +
    (zbyva ? " Zbývá ještě " + zbyva + " souborů, obnovte stránku a smažte i je." : " Kdo má aplikaci otevřenou, tomu se zbytek odešle sám.");
}

function doPost(e) {
  let out;
  try {
    const q = JSON.parse(e.postData.contents);
    const fn = POZADAVKY[q.a];
    if (!fn) throw new Error("Neznámý požadavek.");
    out = fn(q);
    out.ok = true;
  } catch (err) {
    out = { ok: false, error: String((err && err.message) || err), retry: !!(err && err.retry), full: !!(err && err.full) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

const POZADAVKY = { ping: ping, start: start, chunk: chunk, status: status, finish: finish };

function chyba(text, retry) {
  const e = new Error(text);
  e.retry = !!retry;
  return e;
}

function plnyDisk() {
  const e = new Error("Na Disku organizátora došlo místo.");
  e.full = true;
  return e;
}

function misto() {
  const limit = DriveApp.getStorageLimit(), used = DriveApp.getStorageUsed();
  return limit > 0 ? { free: Math.max(0, limit - used), limit: limit } : { free: null, limit: null };
}

// Upozorní příjemce na plný Disk, nejvýš jednou za 6 hodin.
function upozornitPlno(to, akce) {
  to = PRIJEMCE || cisty(to, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) return;
  const props = PropertiesService.getScriptProperties(), last = Number(props.getProperty("plnoUpozorneno") || 0);
  if (Date.now() - last < 6 * 3600 * 1000 || MailApp.getRemainingDailyQuota() < 1) return;
  props.setProperty("plnoUpozorneno", String(Date.now()));
  MailApp.sendEmail({
    to: to,
    name: "Fotky z akce",
    subject: "Disk Google je plný, další fotky z akce " + (cisty(akce, 100) || "akce") + " čekají",
    htmlBody: "<p>Na Disku Google, kam se ukládají fotky a videa z akce <b>" + esc(cisty(akce, 100) || "akce") + "</b>, došlo místo. Další soubory čekají v telefonech ostatních.</p>" +
      "<p>Uvolněte místo: 1. stáhněte si fotky a videa (odkazy máte v předchozích e-mailech), 2. klepněte na " +
      '<a href="' + kodSmazani(cisty(akce, 100) || "Bez názvu", null) + '"><b>Uvolnit místo: smazat stažené fotky a videa z této akce</b></a>.</p>' +
      "<p>Aplikace pak odesílání sama dokončí, pokud ji mají lidé otevřenou; jinak stačí fotky vybrat znovu, už odeslané se přeskočí.</p>",
  });
}

// Seznam odeslaného (otisk akce, jména, názvu a velikosti) přežije i smazání souborů z Disku.
function klic(akce, od, name, size) {
  const d = Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, akce + "|" + od + "|" + name + "|" + size, Utilities.Charset.UTF_8);
  return "o" + Utilities.base64EncodeWebSafe(d).slice(0, 22);
}

function jePlno(res) {
  return res.getResponseCode() === 403 && /storageQuota|quotaExceeded/i.test(res.getContentText());
}

function cisty(v, max) {
  return String(v == null ? "" : v).replace(/[\u0000-\u001f\/\\]/g, " ").replace(/\s+/g, " ").trim().slice(0, max);
}

function hlavicka(res, jmeno) {
  const h = res.getHeaders();
  for (const k in h) if (k.toLowerCase() === jmeno) return [].concat(h[k])[0];
  return null;
}

function podslozka(rodic, jmeno) {
  const it = rodic.getFoldersByName(jmeno);
  return it.hasNext() ? it.next() : rodic.createFolder(jmeno);
}

function slozky(akce, od) {
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    const koren = podslozka(DriveApp.getRootFolder(), KORENOVA_SLOZKA);
    const ev = podslozka(koren, akce || "Bez názvu");
    return { koren: koren, ev: ev, od: podslozka(ev, od || "Neznámý") };
  } finally {
    lock.releaseLock();
  }
}

function ping() {
  const m = misto();
  return { v: VERZE, owner: Session.getEffectiveUser().getEmail(), pevnyPrijemce: !!PRIJEMCE, free: m.free, limit: m.limit };
}

// Založí na Disku relaci pro nahrávání po částech.
function start(q) {
  const size = Number(q.size);
  if (!(size > 0)) throw chyba("Prázdný soubor nelze poslat.");
  const name = cisty(q.name, 200) || "soubor";
  const mime = /^[\w.+-]+\/[\w.+-]+$/.test(String(q.mime)) ? String(q.mime).slice(0, 100) : "application/octet-stream";
  const akce = cisty(q.akce, 100), od = cisty(q.od, 60);
  if (PropertiesService.getScriptProperties().getProperty(klic(akce, od, name, size))) return { dup: true, id: null };
  const s = slozky(akce, od);
  // Stejný soubor (název a velikost) od téhož člověka už na Disku je: neposílat znovu.
  const stejne = s.od.getFilesByName(name);
  while (stejne.hasNext()) {
    const f = stejne.next();
    if (f.getSize() === size && !f.isTrashed()) return { dup: true, id: f.getId() };
  }
  const m = misto();
  if (m.free !== null && size > m.free) { upozornitPlno(q.to, q.akce); throw plnyDisk(); }
  const res = UrlFetchApp.fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id", {
    method: "post",
    contentType: "application/json; charset=UTF-8",
    headers: {
      Authorization: "Bearer " + ScriptApp.getOAuthToken(),
      "X-Upload-Content-Type": mime,
      "X-Upload-Content-Length": String(size),
    },
    payload: JSON.stringify({ name: name, parents: [s.od.getId()] }),
    muteHttpExceptions: true,
  });
  const code = res.getResponseCode(), loc = hlavicka(res, "location");
  if (jePlno(res)) { upozornitPlno(q.to, q.akce); throw plnyDisk(); }
  if (code !== 200 || !loc) throw chyba("Disk Google soubor nepřijal (" + code + ").", code === 429 || code >= 500);
  return { session: loc };
}

// Pošle část souboru nebo zjistí, kolik už Disk přijal. Přístupový token se do relace neposílá.
function put(session, range, bytes) {
  if (!RELACE.test(String(session))) throw chyba("Neplatná relace nahrávání.");
  const opt = { method: "put", contentType: "application/octet-stream", headers: { "Content-Range": range }, muteHttpExceptions: true, followRedirects: false };
  if (bytes) opt.payload = bytes;
  const res = UrlFetchApp.fetch(session, opt), code = res.getResponseCode();
  if (code === 200 || code === 201) return { done: true, id: JSON.parse(res.getContentText()).id };
  if (code === 308) {
    const m = /bytes=0-(\d+)/.exec(hlavicka(res, "range") || "");
    return { next: m ? Number(m[1]) + 1 : 0 };
  }
  if (jePlno(res)) throw plnyDisk();
  if (code === 404 || code === 410) throw chyba("Relace nahrávání vypršela, soubor je potřeba poslat znovu.");
  throw chyba("Disk Google vrátil chybu " + code + ".", code === 429 || code >= 500);
}

function chunk(q) {
  const bytes = Utilities.base64Decode(String(q.data));
  const s = Number(q.start), t = Number(q.total);
  if (!bytes.length || !(s >= 0) || s + bytes.length > t) throw chyba("Neplatná část souboru.");
  return put(q.session, "bytes " + s + "-" + (s + bytes.length - 1) + "/" + t, bytes);
}

function status(q) {
  return put(q.session, "bytes */" + Number(q.total), null);
}

function vKorenove(file, korenId) {
  let p = file.getParents();
  for (let i = 0; i < 4 && p.hasNext(); i++) {
    const f = p.next();
    if (f.getId() === korenId) return true;
    p = f.getParents();
  }
  return false;
}

function velikost(b) {
  return b >= 1e9 ? (b / 1e9).toFixed(1).replace(".", ",") + " GB" : Math.max(0.1, b / 1e6).toFixed(1).replace(".", ",") + " MB";
}

function esc(t) {
  return String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
}

// Po dokončení dávky: zpřístupní složku akce příjemci a pošle mu e-mail s odkazy.
function finish(q) {
  const to = PRIJEMCE || cisty(q.to, 120);
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) throw chyba("Neplatný e-mail příjemce.");
  const od = cisty(q.od, 60) || "Někdo", akce = cisty(q.akce, 100) || "akce";
  const s = slozky(akce, od), korenId = s.koren.getId();
  const soubory = [];
  (q.files || []).slice(0, 1000).forEach((f) => {
    try {
      const file = DriveApp.getFileById(String(f.id));
      if (vKorenove(file, korenId)) soubory.push(file);
    } catch (e) {}
  });
  if (!soubory.length) throw chyba("Na Disku se nenašel žádný z odeslaných souborů.");
  try {
    const zaznam = {};
    soubory.forEach((f) => { zaznam[klic(akce, od, f.getName(), f.getSize())] = "1"; });
    PropertiesService.getScriptProperties().setProperties(zaznam);
  } catch (e) {} // seznam je jen pomůcka; při zaplnění úložiště vlastností zůstane kontrola podle Disku

  const ja = (Session.getEffectiveUser().getEmail() || "").toLowerCase();
  let pristup = "vlastník";
  if (to.toLowerCase() !== ja) {
    try { s.ev.addViewer(to); pristup = "účet Google příjemce"; }
    catch (e) {
      s.ev.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
      pristup = "kdokoli s odkazem";
    }
  }

  if (MailApp.getRemainingDailyQuota() < 1) return { mailed: false, folder: s.ev.getUrl(), pristup: pristup };
  const fotky = soubory.filter((f) => /^image\//.test(f.getMimeType())).length, videa = soubory.length - fotky;
  const pocet = [fotky ? fotky + (fotky === 1 ? " fotku" : fotky < 5 ? " fotky" : " fotek") : "", videa ? videa + (videa === 1 ? " video" : videa < 5 ? " videa" : " videí") : ""].filter(Boolean).join(" a ") || soubory.length + " souborů";
  const celkem = soubory.reduce((a, f) => a + f.getSize(), 0);
  const radky = soubory.map((f) =>
    '<li><a href="https://drive.google.com/uc?export=download&id=' + f.getId() + '">' + esc(f.getName()) + "</a> (" + velikost(f.getSize()) + ")</li>").join("");
  MailApp.sendEmail({
    to: to,
    name: "Fotky z akce",
    subject: od + " posílá " + pocet + " z akce " + akce,
    htmlBody:
      "<p><b>" + esc(od) + "</b> poslal(a) " + esc(pocet) + " z akce <b>" + esc(akce) + "</b>, celkem " + velikost(celkem) + " v plné velikosti.</p>" +
      '<p><a href="' + s.od.getUrl() + '">Otevřít soubory od ' + esc(od) + "</a> · " +
      '<a href="' + s.ev.getUrl() + '">Všechno z akce ' + esc(akce) + "</a></p>" +
      "<p>Ve složce na Disku Google: vybrat soubory → ⋮ → Stáhnout. Nebo jednotlivě:</p><ul>" + radky + "</ul>" +
      (function () { const m = misto(); return m.free === null ? "" : "<p>Na Disku zbývá " + velikost(m.free) + " volného místa." +
        (m.free < 2e9 ? " Místa je málo." : "") + "</p>"; })() +
      '<p>Až budete mít staženo, můžete uvolnit místo pro ostatní: <a href="' + kodSmazani(akce, od) + '">smazat tyto soubory od ' + esc(od) + " z Disku</a>.</p>",
  });
  const m = misto();
  return { mailed: true, folder: s.ev.getUrl(), pristup: pristup, to: to, free: m.free, limit: m.limit };
}
