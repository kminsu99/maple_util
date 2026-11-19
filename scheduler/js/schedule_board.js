/* ── 스케줄 보드 ──
 * 등록된 캐릭터(ocid)의 스케줄러 정보만 API로 불러와 표시
 * 화면 순서: 툴바(조회 기준일·등록 항목 필터·새로고침) → 요약 → 주간 컨텐츠 → 보스 → 일일 컨텐츠
 * 불러오는 시점: 페이지 진입, 등록 캐릭터 변경([완료]), API 키 저장, [새로고침]
 *
 * 각 섹션(board_weekly/boss/daily.js)은 같은 모양:
 *   compute(entries) → 데이터 (gauges: 서버별 게이지, 맨 위 요약에도 그대로 사용)
 *   html(데이터, entries) → HTML
 *   onClick(e) / onChange(e) → 처리했으면 true (다시 그림)
 *   editing, reset { message, keys }: 편집이 있는 섹션만
 *
 * 의존: util.js, store.js, reset.js, characters.js, scheduler_state.js,
 *       board_rules.js, board_ui.js, board_weekly.js, board_boss.js, board_daily.js
 */
(function () {
    const ONLY_REG_KEY = 'only_registered';    // 인게임 스케줄러 등록 항목만 보기
    const { esc } = BoardUI;

    // 이전 버전에서 저장하던 값 정리 (보스 펼침 상태, 메인/서브 구분)
    ['boss_open', 'boss_char_tags', 'weekly_tags'].forEach((k) => Store.remove(k));

    // 섹션 순서 = 화면 순서, 맨 위 요약 카드 정보
    const SECTIONS = [
        { key: 'weekly', module: () => BoardWeekly, title: '주간 컨텐츠', reset: 'mon' },
        { key: 'boss', module: () => BoardBoss, title: '보스', reset: null },
        { key: 'daily', module: () => BoardDaily, title: '일일 컨텐츠', reset: 'daily' },
    ];

    function mount(container) {
        if (!container) return;
        container.classList.add('sb');

        // ocid → { status: 'loading' | 'ok' | 'error', data, error }
        const states = new Map();
        let loadSeq = 0;

        const onlyRegistered = () => Store.load(ONLY_REG_KEY, true);
        const ctx = {
            visible: (items) => (onlyRegistered() ? items.filter((it) => SchedulerState.flag(it.registration_flag)) : items),
        };
        const sections = {};
        SECTIONS.forEach((s) => { sections[s.key] = s.module().create(ctx); });

        // ── 불러오기 (등록 캐릭터만, 순차 호출) ──
        async function loadAll() {
            const seq = ++loadSeq;
            const ids = Characters.registeredIds();
            Array.from(states.keys()).forEach((id) => { if (!ids.includes(id)) states.delete(id); });
            ids.forEach((id) => states.set(id, { status: 'loading' }));
            render();
            if (!ids.length) return;
            if (!ApiKey.has()) {
                ids.forEach((id) => states.set(id, { status: 'error', error: '먼저 API 키를 저장하세요.' }));
                render();
                return;
            }
            for (const id of ids) {
                if (seq !== loadSeq) return; // 새 요청이 시작되면 중단
                try {
                    const data = await SchedulerState.fetch(id);
                    if (seq !== loadSeq) return;
                    states.set(id, { status: 'ok', data });
                } catch (e) {
                    if (seq !== loadSeq) return;
                    states.set(id, { status: 'error', error: e.message || '불러오지 못했습니다.' });
                }
                render();
            }
        }

        // 등록 캐릭터 목록 (레벨 높은 순)
        function entriesSorted() {
            const level = (e) => (e.st.data ? Number(e.st.data.character_level) : -1);
            return Characters.registeredIds().map((id) => ({ id, st: states.get(id) || { status: 'loading' } }))
                .sort((a, b) => level(b) - level(a));
        }

        function toolbarHtml(st) {
            const date = st.data && st.data.date ? `조회 기준일 ${esc(st.data.date)}` : '';
            return `
                <div class="sb-toolbar">
                    <span class="sb-date">${date}</span>
                    <label class="sb-filter">
                        <input type="checkbox" class="sb-only-reg"${onlyRegistered() ? ' checked' : ''}>
                        인게임 스케줄러 등록 항목만
                    </label>
                    <button type="button" class="sb-refresh">새로고침</button>
                </div>`;
        }

        // 맨 위 요약: 각 섹션의 게이지를 그대로 표시
        function summaryHtml(models) {
            const cards = SECTIONS.map((s) => {
                const gauges = BoardUI.worldGaugesHtml(models[s.key].gauges) || '<p class="sum-empty">표시할 항목 없음</p>';
                return `
                    <div class="sum-card">
                        <div class="sum-card-head"><strong>${s.title}</strong>${s.reset ? BoardUI.resetHtml(s.reset) : ''}</div>
                        ${gauges}
                    </div>`;
            }).join('');
            return `<section class="sum-panel panel" aria-label="진행도 요약">${cards}</section>`;
        }

        function render() {
            const entries = entriesSorted();
            if (!entries.length) {
                container.innerHTML = `
                    <section class="panel">
                        <h2>스케줄</h2>
                        <p class="empty">위에서 [캐릭터 등록/해제] 후 [완료]를 누르면 스케줄이 표시됩니다.</p>
                    </section>`;
                return;
            }
            const first = entries.find((e) => e.st.status === 'ok') || entries[0];
            const models = {};
            SECTIONS.forEach((s) => { models[s.key] = sections[s.key].compute(entries); });
            container.innerHTML = toolbarHtml(first.st)
                + summaryHtml(models)
                + SECTIONS.map((s) => sections[s.key].html(models[s.key], entries)).join('');
        }

        // ── 이벤트 ──
        const eachSection = (fn) => SECTIONS.some((s) => fn(sections[s.key]));

        container.addEventListener('click', (e) => {
            if (eachSection((sec) => sec.onClick && sec.onClick(e))) {
                render();
                return;
            }
            const foldBtn = e.target.closest('.sb-fold');
            if (foldBtn) {
                const sec = sections[foldBtn.dataset.section];
                // 접으면 편집 모드도 종료
                if (BoardUI.toggleFold(foldBtn.dataset.section) && sec && 'editing' in sec) sec.editing = false;
                render();
                return;
            }
            const resetBtn = e.target.closest('.sb-settings-reset');
            if (resetBtn) {
                const r = sections[resetBtn.dataset.section] && sections[resetBtn.dataset.section].reset;
                if (r && confirm(r.message)) {
                    r.keys.forEach((k) => Store.remove(k));
                    render();
                }
                return;
            }
            const editBtn = e.target.closest('.sb-edit');
            if (editBtn) {
                const sec = sections[editBtn.dataset.section];
                if (sec) sec.editing = !sec.editing;
                render();
                return;
            }
            if (e.target.closest('.sb-refresh')) loadAll();
        });

        container.addEventListener('change', (e) => {
            if (e.target.closest('.sb-only-reg')) {
                Store.save(ONLY_REG_KEY, e.target.checked);
                render();
                return;
            }
            if (eachSection((sec) => sec.onChange && sec.onChange(e))) render();
        });

        sections.weekly.bindDrag(container, render);

        Characters.onChange(loadAll);
        ApiKey.onChange(() => { if (ApiKey.has()) loadAll(); });

        // 초기화 남은 시간 갱신 (1분마다, 화면만 다시 그림. 입력·드래그 중에는 건너뜀)
        setInterval(() => {
            if (sections.weekly.isDragging()) return;
            if (!container.contains(document.activeElement)) render();
        }, 60000);

        loadAll();
    }

    window.ScheduleBoard = { mount };
})();
