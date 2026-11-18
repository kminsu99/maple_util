/* ── 화면 테마 (다크 / 라이트) ──
 * <head>에서 먼저 불러 저장된 테마를 바로 적용한다 (깜빡임 방지).
 * Calc · scheduler 공용. 한 페이지에서 바꾸면 다른 페이지도 같은 테마로 열린다.
 * 저장: localStorage 'maple_util_theme' = "dark" | "light" (JSON 형식)
 * 색상: base_css/dark.css · base_css/light.css
 * 기본값: 다크
 */
(function () {
    const KEY = 'maple_util_theme';
    const root = document.documentElement;

    function load() {
        try {
            const v = JSON.parse(localStorage.getItem(KEY) || 'null');
            return v === 'light' ? 'light' : 'dark';
        } catch (e) {
            return 'dark';
        }
    }

    function save(theme) {
        try { localStorage.setItem(KEY, JSON.stringify(theme)); } catch (e) { }
    }

    function apply(theme) {
        root.setAttribute('data-theme', theme);
    }

    function current() {
        return root.getAttribute('data-theme') === 'light' ? 'light' : 'dark';
    }

    // 토글 버튼 연결: 누르면 다크 ↔ 라이트 전환 후 저장
    function mount(btn) {
        function renderBtn() {
            const light = current() === 'light';
            btn.textContent = light ? '☾ 다크' : '☀ 라이트';
            btn.title = light ? '다크 모드로 전환' : '라이트 모드로 전환';
            btn.setAttribute('aria-pressed', String(light));
        }
        btn.addEventListener('click', () => {
            const next = current() === 'light' ? 'dark' : 'light';
            apply(next);
            save(next);
            renderBtn();
        });
        renderBtn();
    }

    apply(load());
    window.Theme = { mount, current };
})();
