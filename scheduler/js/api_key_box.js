/* ── API 키 입력 박스 UI ──
 * 의존: api_key.js, css/api_key_box.css
 *
 * 예) ApiKeyBox.mount(document.getElementById('apiKeyBox'));
 */
(function () {
    const TEMPLATE = `
        <div class="nx-keybox-head">
            <strong>넥슨 오픈API 키</strong>
            <span class="nx-keybox-status"></span>
        </div>
        <div class="nx-keybox-saved">
            <code class="nx-keybox-masked"></code>
            <button type="button" class="nx-btn nx-edit">변경</button>
            <button type="button" class="nx-btn nx-btn-ghost nx-clear">삭제</button>
        </div>
        <form class="nx-keybox-form" autocomplete="off">
            <input type="password" class="nx-input" placeholder="API 키 붙여넣기" spellcheck="false" aria-label="넥슨 오픈API 키">
            <button type="button" class="nx-btn nx-btn-ghost nx-toggle" aria-label="키 보기">보기</button>
            <button type="submit" class="nx-btn">저장</button>
            <button type="button" class="nx-btn nx-btn-ghost nx-cancel">취소</button>
        </form>
        <p class="nx-keybox-note">
            키는 이 브라우저(localStorage)에만 저장되며 다른 곳으로 전송되지 않습니다.
            발급: <a href="https://openapi.nexon.com/" target="_blank" rel="noopener">넥슨 오픈API 센터</a>
        </p>`;

    function mount(container) {
        if (!container) return;
        container.classList.add('nx-keybox');
        container.innerHTML = TEMPLATE;

        const $ = (sel) => container.querySelector(sel);
        const status = $('.nx-keybox-status');
        const saved = $('.nx-keybox-saved');
        const form = $('.nx-keybox-form');
        const input = $('.nx-input');
        const toggle = $('.nx-toggle');
        const cancel = $('.nx-cancel');

        function render(editing) {
            const key = ApiKey.get();
            const showForm = editing || !key;
            status.textContent = key ? '저장됨' : '미등록';
            status.classList.toggle('is-set', !!key);
            saved.hidden = showForm;
            form.hidden = !showForm;
            cancel.hidden = !key;
            $('.nx-keybox-masked').textContent = ApiKey.mask(key);
            if (showForm) {
                input.value = '';
                input.type = 'password';
                toggle.textContent = '보기';
            }
        }

        form.addEventListener('submit', (e) => {
            e.preventDefault();
            const value = input.value.trim();
            if (!value) { input.focus(); return; }
            if (!ApiKey.set(value)) {
                status.textContent = '저장 실패 (브라우저 저장소 사용 불가)';
                return;
            }
            render(false);
        });

        toggle.addEventListener('click', () => {
            const show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            toggle.textContent = show ? '숨기기' : '보기';
        });

        $('.nx-edit').addEventListener('click', () => { render(true); input.focus(); });
        cancel.addEventListener('click', () => render(false));
        $('.nx-clear').addEventListener('click', () => {
            if (confirm('저장된 API 키를 삭제할까요?')) { ApiKey.clear(); render(false); }
        });

        // 다른 탭에서 키가 바뀌면 갱신 (입력 중일 때는 유지)
        ApiKey.onChange(() => { if (form.hidden || !ApiKey.has()) render(false); });

        render(false);
    }

    window.ApiKeyBox = { mount };
})();
