/* ── 스케줄러 페이지 진입점 ──
 * 초기화 · 연결만 담당한다 (기능은 각 모듈).
 * 의존: page_header.js, character_picker.js, schedule_board.js (및 그 의존 파일)
 */
(function () {
    function init() {
        const header = PageHeader.mount();
        const charBtn = document.getElementById('btnCharacters');

        CharacterPicker.mount(document.getElementById('characterPicker'), { trigger: charBtn });
        ScheduleBoard.mount(document.getElementById('scheduleBoard'), {
            refreshBtn: document.getElementById('btnRefresh'),
            refreshAt: document.getElementById('refreshAt'),
        });

        // 키가 없는데 캐릭터 등록을 누르면 키 입력 박스도 열어준다
        charBtn.addEventListener('click', () => { if (!ApiKey.has()) header.setKeyBoxOpen(true); });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
