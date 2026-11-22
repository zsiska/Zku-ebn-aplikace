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
const VERZE = 1;
const RELACE = /^https:\/\/www\.googleapis\.com\/upload\/drive\/v3\/files\?/;

function doGet() {
  return ContentService.createTextOutput("Fotky z akce: skript běží. Adresu této stránky vložte do aplikace.");
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
    out = { ok: false, error: String((err && err.message) || err), retry: !!(err && err.retry) };
  }
  return ContentService.createTextOutput(JSON.stringify(out)).setMimeType(ContentService.MimeType.JSON);
}

const POZADAVKY = { ping: ping, start: start, chunk: chunk, status: status, finish: finish };

function chyba(text, retry) {
  const e = new Error(text);
  e.retry = !!retry;
  return e;
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
  return { v: VERZE, owner: Session.getEffectiveUser().getEmail(), pevnyPrijemce: !!PRIJEMCE };
}

// Založí na Disku relaci pro nahrávání po částech.
function start(q) {
  const size = Number(q.size);
  if (!(size > 0)) throw chyba("Prázdný soubor nelze poslat.");
  const name = cisty(q.name, 200) || "soubor";
  const mime = /^[\w.+-]+\/[\w.+-]+$/.test(String(q.mime)) ? String(q.mime).slice(0, 100) : "application/octet-stream";
  const s = slozky(cisty(q.akce, 100), cisty(q.od, 60));
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
      "<p>Ve složce na Disku Google: vybrat soubory → ⋮ → Stáhnout. Nebo jednotlivě:</p><ul>" + radky + "</ul>",
  });
  return { mailed: true, folder: s.ev.getUrl(), pristup: pristup, to: to };
}
