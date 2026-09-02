/* =========================================================
   НАСТРОЙКИ ИГРОКА
   Читает/сохраняет настройки в localStorage браузера — они
   не теряются, если игрок закроет и снова откроет игру.
   ========================================================= */

const Settings = (function () {
  const STORAGE_KEY = 'neuroOtlichnikSettings';

  const defaults = {
    theme: 'light',
    musicOn: true,
    musicVolume: 55, // от 0 до 100
    sfxOn: true,
    sfxVolume: 60, // от 0 до 100
    hasSeenIntro: false,
    hasSeenFactPrompt: false
  };

  function load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...defaults };
      return { ...defaults, ...JSON.parse(raw) };
    } catch (e) {
      return { ...defaults };
    }
  }

  let current = load();

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    } catch (e) {
      // локальное хранилище недоступно (например, приватный режим) — просто не сохраняем
    }
  }

  function applyTheme(theme) {
    document.documentElement.dataset.theme = theme;
  }

  function get() {
    return { ...current };
  }

  function set(partial) {
    current = { ...current, ...partial };
    save();
    if (partial.theme) {
      applyTheme(partial.theme);
    }
  }

  applyTheme(current.theme);

  return { get, set };
})();
