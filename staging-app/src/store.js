/* =========================================================
   ХРАНИЛИЩЕ ПРОТОТИПА
   ---------------------------------------------------------
   Пока всё живёт прямо в телефоне пользователя:
     • баланс кадров и настройки — localStorage (мелочь);
     • сами картинки — IndexedDB (localStorage их не вмещает).

   Когда подключим сервер, меняется ТОЛЬКО этот файл:
   те же функции начнут ходить в API, остальной код не заметит.
   ========================================================= */
(function () {
  const CREDITS_KEY = 'nsCredits';
  const JOBS_META_KEY = 'nsJobsMeta';
  const FREE_GRANTED_KEY = 'nsFreeGranted';
  const FREE_CREDITS = 2; // столько кадров дарим новичку, чтобы он попробовал без оплаты

  const DB_NAME = 'neuro-staging';
  const DB_STORE = 'images';
  let dbPromise = null;

  function openDb() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(DB_STORE)) db.createObjectStore(DB_STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
    return dbPromise;
  }

  async function idbPut(key, blob) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).put(blob, key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  async function idbGet(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readonly');
      const req = tx.objectStore(DB_STORE).get(key);
      req.onsuccess = () => resolve(req.result || null);
      req.onerror = () => reject(req.error);
    });
  }

  async function idbDelete(key) {
    const db = await openDb();
    return new Promise((resolve, reject) => {
      const tx = db.transaction(DB_STORE, 'readwrite');
      tx.objectStore(DB_STORE).delete(key);
      tx.oncomplete = resolve;
      tx.onerror = () => reject(tx.error);
    });
  }

  /* ---------------- Баланс кадров ---------------- */

  function getCredits() {
    // Первый заход — начисляем бесплатные кадры ровно один раз.
    if (!localStorage.getItem(FREE_GRANTED_KEY)) {
      localStorage.setItem(FREE_GRANTED_KEY, '1');
      localStorage.setItem(CREDITS_KEY, String(FREE_CREDITS));
      return FREE_CREDITS;
    }
    const raw = Number(localStorage.getItem(CREDITS_KEY));
    return Number.isFinite(raw) && raw > 0 ? raw : 0;
  }

  function setCredits(value) {
    const safe = Math.max(0, Math.floor(value));
    localStorage.setItem(CREDITS_KEY, String(safe));
    document.dispatchEvent(new CustomEvent('ns:credits', { detail: safe }));
    return safe;
  }

  function addCredits(n) { return setCredits(getCredits() + n); }
  function spendCredit() {
    const left = getCredits();
    if (left <= 0) return false;
    setCredits(left - 1);
    return true;
  }

  /* ---------------- История заказов ---------------- */

  function readMeta() {
    try { return JSON.parse(localStorage.getItem(JOBS_META_KEY) || '[]'); }
    catch { return []; }
  }

  function writeMeta(list) {
    localStorage.setItem(JOBS_META_KEY, JSON.stringify(list.slice(0, 50)));
  }

  // Сохраняем пару "было/стало" + подписи к ней.
  async function saveJob({ id, beforeBlob, afterBlob, styleId, roomId, modeId }) {
    await idbPut(id + ':before', beforeBlob);
    await idbPut(id + ':after', afterBlob);
    const meta = readMeta();
    meta.unshift({ id, styleId, roomId, modeId, createdAt: Date.now() });
    writeMeta(meta);
  }

  async function loadJob(id) {
    const meta = readMeta().find((j) => j.id === id);
    if (!meta) return null;
    const before = await idbGet(id + ':before');
    const after = await idbGet(id + ':after');
    if (!before || !after) return null;
    return { ...meta, before, after };
  }

  async function deleteJob(id) {
    await idbDelete(id + ':before');
    await idbDelete(id + ':after');
    writeMeta(readMeta().filter((j) => j.id !== id));
  }

  function listJobs() { return readMeta(); }

  window.NS_Store = {
    getCredits, setCredits, addCredits, spendCredit,
    saveJob, loadJob, listJobs, deleteJob,
    FREE_CREDITS
  };
})();
