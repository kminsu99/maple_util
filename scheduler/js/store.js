/* ── localStorage JSON 저장 도우미 ──
 * 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서도 오류 없이 기본값을 돌려준다.
 */
(function () {
    const PREFIX = 'maple_util_sched_';

    function load(name, fallback) {
        try {
            const raw = localStorage.getItem(PREFIX + name);
            return raw ? JSON.parse(raw) : fallback;
        } catch (e) {
            return fallback;
        }
    }

    function save(name, value) {
        try {
            localStorage.setItem(PREFIX + name, JSON.stringify(value));
            return true;
        } catch (e) {
            return false;
        }
    }

    function remove(name) {
        try { localStorage.removeItem(PREFIX + name); } catch (e) { }
    }

    window.Store = { load, save, remove };
})();
