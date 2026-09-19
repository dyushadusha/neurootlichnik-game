/* =========================================================
   ОБЪЕКТ — квартира целиком, а не отдельный кадр
   ---------------------------------------------------------
   Главная единица продукта. Пользователь смотрит квартиру,
   добавляет комнату за комнатой и получает то, чего ему никто
   не даёт: ЦЕНУ ВХОДА = цена квартиры + ремонт.

   Здесь же живёт цена из объявления и подсчёт итогов.
   Хранится в localStorage; сметы пересчитываются на лету,
   чтобы правка прайса сразу отражалась в итогах.
   ========================================================= */
(function () {
  const KEY = 'nsProject';

  function empty() {
    return { listingPrice: null, address: '', rooms: [] };
  }

  function read() {
    try {
      const raw = JSON.parse(localStorage.getItem(KEY));
      if (!raw || !Array.isArray(raw.rooms)) return empty();
      return raw;
    } catch {
      return empty();
    }
  }

  function write(project) {
    try { localStorage.setItem(KEY, JSON.stringify(project)); } catch { /* приватный режим */ }
    document.dispatchEvent(new CustomEvent('ns:project', { detail: project }));
    return project;
  }

  // Комната добавляется вместе с параметрами, по которым считалась смета,
  // чтобы итог можно было пересчитать при смене прайса.
  function addRoom({ jobId, roomId, styleId, stateId, area, height }) {
    const p = read();
    p.rooms = p.rooms.filter((r) => r.jobId !== jobId);
    p.rooms.push({ jobId, roomId, styleId, stateId, area, height, addedAt: Date.now() });
    return write(p);
  }

  function removeRoom(jobId) {
    const p = read();
    p.rooms = p.rooms.filter((r) => r.jobId !== jobId);
    return write(p);
  }

  function setListingPrice(value) {
    const p = read();
    p.listingPrice = Number.isFinite(value) && value > 0 ? value : null;
    return write(p);
  }

  function reset() {
    return write(empty());
  }

  /* Итоги по объекту. Считаем ремонт по всем комнатам и складываем
     с ценой квартиры — это и есть ответ на вопрос "сколько стоит вход". */
  function totals() {
    const p = read();
    let renovation = 0;
    let area = 0;
    let maxDays = 0;

    const rooms = p.rooms.map((room) => {
      const est = window.NS_Estimate.calculate({
        roomId: room.roomId, styleId: room.styleId,
        stateId: room.stateId, area: room.area, height: room.height
      });
      renovation += est.total;
      area += room.area;
      // Комнаты делают последовательно не полностью: срок объекта —
      // не сумма, а самый долгий фронт плюс половина остальных.
      maxDays = Math.max(maxDays, est.days);
      return { ...room, estimate: est };
    });

    const otherDays = rooms.reduce((acc, r) => acc + r.estimate.days, 0) - maxDays;
    const days = rooms.length ? Math.round(maxDays + otherDays * 0.5) : 0;

    const listing = p.listingPrice;
    const entry = listing ? listing + renovation : null;

    return {
      rooms,
      area: Math.round(area * 10) / 10,
      renovation,
      renovationText: window.NS_Estimate.formatMoney(renovation),
      listing,
      listingText: listing ? window.NS_Estimate.formatMoney(listing) : null,
      entry,
      entryText: entry ? window.NS_Estimate.formatMoney(entry) : null,
      // Доля ремонта в цене входа — самая отрезвляющая цифра для покупателя.
      renovationShare: entry ? Math.round((renovation / entry) * 100) : null,
      perSquareText: area ? window.NS_Estimate.formatMoney(renovation / area) + '/м²' : null,
      days
    };
  }

  window.NS_Project = { read, addRoom, removeRoom, setListingPrice, reset, totals };
})();
