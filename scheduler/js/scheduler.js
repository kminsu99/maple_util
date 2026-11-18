/* ── 스케줄러 페이지 진입점 ──
 * 의존: api_key_box.js, character_picker.js, schedule_board.js (및 그 의존 파일)
 * 페이지 기능이 늘어나면 기능별 파일로 나누고 여기서는 초기화·연결만 담당한다.
 */
(function () {
    function init() {
        const keyBox = document.getElementById('apiKeyBox');
        const keyBtn = document.getElementById('btnApiKey');
        const keyState = keyBtn.querySelector('.top-btn-state');
        const charBtn = document.getElementById('btnCharacters');

        ApiKeyBox.mount(keyBox);
        CharacterPicker.mount(document.getElementById('characterPicker'), { trigger: charBtn });
        ScheduleBoard.mount(document.getElementById('scheduleBoard'));

        // ── 상단 [API 키 등록] 버튼: 키 입력 박스 펼치기/접기 ──
        function setKeyBoxOpen(open) {
            keyBox.hidden = !open;
            keyBtn.setAttribute('aria-expanded', String(open));
        }

        function renderKeyState() {
            const has = ApiKey.has();
            keyState.textContent = has ? '저장됨' : '미등록';
            keyState.classList.toggle('is-set', has);
        }

        keyBtn.addEventListener('click', () => setKeyBoxOpen(keyBox.hidden));

        // 박스 바깥을 누르면 닫기 (키가 저장된 경우만)
        document.addEventListener('click', (e) => {
            if (keyBox.hidden || !ApiKey.has()) return;
            if (!e.target.closest('.key-corner')) setKeyBoxOpen(false);
        });

        // 키가 없는데 캐릭터 등록을 누르면 키 입력 박스도 열어준다
        charBtn.addEventListener('click', () => { if (!ApiKey.has()) setKeyBoxOpen(true); });

        // 키 저장 시 박스 닫기, 삭제 시 열기
        ApiKey.onChange(() => {
            renderKeyState();
            setKeyBoxOpen(!ApiKey.has());
        });

        renderKeyState();
        setKeyBoxOpen(!ApiKey.has()); // 처음 방문(키 없음)이면 열어 둔다
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
