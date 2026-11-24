/* ── 상단 고정 헤더: 테마 버튼 · [API 키 등록] 버튼 + 키 입력 박스 ──
 * scheduler.html · boss_check.html 공용 (같은 마크업: #btnTheme, #btnApiKey, #apiKeyBox)
 *  - 키가 없으면 박스를 열어 두고, 저장하면 닫고, 삭제하면 다시 연다
 *  - 키가 있을 때 박스 바깥을 누르면 닫는다
 * 의존: api_key.js, api_key_box.js, ../base_js/theme.js
 *
 * 예) const header = PageHeader.mount(); header.setKeyBoxOpen(true);
 */
(function () {
    function mount() {
        const keyBox = document.getElementById('apiKeyBox');
        const keyBtn = document.getElementById('btnApiKey');
        const keyState = keyBtn.querySelector('.top-btn-state');

        function setKeyBoxOpen(open) {
            keyBox.hidden = !open;
            keyBtn.setAttribute('aria-expanded', String(open));
        }

        function renderKeyState() {
            const has = ApiKey.has();
            keyState.textContent = has ? '저장됨' : '미등록';
            keyState.classList.toggle('is-set', has);
        }

        ApiKeyBox.mount(keyBox);
        Theme.mount(document.getElementById('btnTheme'));

        keyBtn.addEventListener('click', () => setKeyBoxOpen(keyBox.hidden));
        document.addEventListener('click', (e) => {
            if (!keyBox.hidden && ApiKey.has() && !e.target.closest('.key-corner')) setKeyBoxOpen(false);
        });
        ApiKey.onChange(() => {
            renderKeyState();
            setKeyBoxOpen(!ApiKey.has());
        });

        renderKeyState();
        setKeyBoxOpen(!ApiKey.has()); // 처음 방문(키 없음)이면 열어 둔다
        return { setKeyBoxOpen };
    }

    window.PageHeader = { mount };
})();
