/* =========================================================
   РАСЧЁТ СМЕТЫ
   ---------------------------------------------------------
   Из площади комнаты и высоты потолка получаем объёмы работ,
   умножаем на прайс и собираем список позиций.

   Честная рамка: это ПРЕДВАРИТЕЛЬНАЯ смета для коммерческого
   предложения, а не рабочая документация. Периметр комнаты
   оценивается по площади (точных обмеров у нас нет), поэтому
   итог всегда даётся вилкой.
   ========================================================= */
(function () {
  const P = window.NS_PRICING;

  // Периметр по площади: считаем комнату близкой к пропорции 3:4.
  // Для 18 м² даёт ≈17 пог. м — ошибка в пределах точности КП.
  function perimeterFromArea(area) {
    const side = Math.sqrt((area * 3) / 4);
    return 2 * (side + area / side);
  }

  function geometry(area, height, roomId) {
    const perim = perimeterFromArea(area);
    // Проёмы: в санузле только дверь, в остальных комнатах дверь и окно.
    const openings = roomId === 'bath' ? 1.7 : 1.7 + 1.8;
    const wall = Math.max(0, perim * height - openings);
    return {
      floor: area,
      ceil: area,
      wall: Math.round(wall * 10) / 10,
      perim: Math.round((perim - 0.9) * 10) / 10, // минус ширина дверного проёма
      item: 1
    };
  }

  function formatMoney(value) {
    // Неразрывный пробел: иначе "₽" убегает на следующую строку.
    return Math.round(value).toLocaleString('ru-RU') + '\u00A0' + P.currency;
  }

  function unitLabel(unit) {
    return { floor: 'м² пола', wall: 'м² стен', ceil: 'м² потолка', perim: 'пог. м', item: 'шт', fixed: '' }[unit] || '';
  }

  /* Главная функция: на входе — что за комната, какой стиль,
     площадь и высота; на выходе — готовая смета. */
  function calculate({ roomId, styleId, area, height, stateId }) {
    const stateFactors = (window.NS_PRESETS.OBJECT_STATES
      .find((s) => s.id === stateId) || {}).factors || {};
    const segmentId = P.styleSegment[styleId] || 'comfort';
    const segment = P.segments[segmentId];
    const geo = geometry(area, height, roomId);

    const lines = [];
    for (const work of P.works) {
      // Позиции, привязанные к типу помещения (сантехника, фартук, плитка).
      if (work.rooms && !work.rooms.includes(roomId)) continue;
      // Плитка в санузле заменяет покраску стен.
      if (work.id === 'walls' && roomId === 'bath') continue;

      // Состояние объекта может убрать работу совсем (демонтаж в
      // новостройке) или урезать её объём (стяжка поверх черновой).
      const stateFactor = stateFactors[work.id] === undefined ? 1 : stateFactors[work.id];
      if (stateFactor === 0) continue;

      const qty = work.unit === 'fixed' ? 1 : geo[work.unit];
      const sum = work.rate * segment.factor * qty * stateFactor;
      lines.push({
        label: work.label,
        qty: work.unit === 'fixed' ? '' : Math.round(qty * 10) / 10,
        unit: unitLabel(work.unit),
        sum,
        sumText: formatMoney(sum)
      });
    }

    const worksTotal = lines.reduce((acc, l) => acc + l.sum, 0);
    const overhead = (worksTotal * P.overheadPercent) / 100;
    const total = worksTotal + overhead;
    const spread = (total * P.spreadPercent) / 100;
    const days = Math.round((14 + area * 0.9) * segment.days);

    return {
      segmentLabel: segment.label,
      lines,
      overhead,
      overheadText: formatMoney(overhead),
      overheadPercent: P.overheadPercent,
      total,
      totalText: formatMoney(total),
      rangeText: `${formatMoney(total - spread)} — ${formatMoney(total + spread)}`,
      perSquareText: formatMoney(total / area) + '/м²',
      days,
      region: P.region
    };
  }

  /* Текстовая версия — то, что подрядчик вставит в КП или отправит
     клиенту сообщением. */
  function asText(estimate, { roomLabel, styleLabel, area }) {
    const head = `Предварительная смета: ${roomLabel}, ${area} м², стиль «${styleLabel}» (${estimate.segmentLabel})`;
    const body = estimate.lines
      .map((l) => `• ${l.label}${l.qty ? ` — ${l.qty} ${l.unit}` : ''}: ${l.sumText}`)
      .join('\n');
    return [
      head,
      body,
      `• Вывоз мусора и расходники (${estimate.overheadPercent}%): ${estimate.overheadText}`,
      ``,
      `Итого: ${estimate.totalText} (${estimate.perSquareText})`,
      `Вилка с учётом уточнения на замере: ${estimate.rangeText}`,
      `Ориентировочный срок: ${estimate.days} дней`,
      ``,
      `Расчёт предварительный, по фото и заявленной площади. Точная смета — после замера.`
    ].join('\n');
  }

  window.NS_Estimate = { calculate, asText, geometry, formatMoney };
})();
