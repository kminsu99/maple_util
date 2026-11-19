/* ── 스케줄 보드: 일일 컨텐츠 섹션 ──
 * 서버 박스마다: 월드 공유 항목(몬스터파크 등) → '일일퀘스트' 제목 → 캐릭터 × 일일 컨텐츠 표
 * 게이지(서버별): 일퀘(캐릭터별 일일 컨텐츠 합산) / 몬파(입장 횟수 / 목표)
 * 편집: 서버별 몬스터파크 목표 횟수 (저장: { 서버이름: 목표 })
 * 의존: store.js, scheduler_state.js, board_rules.js, board_ui.js
 */
(function () {
    const { esc } = BoardUI;
    const R = BoardRules;
    const MPARK_KEY = 'mpark_target';

    function clampMpark(n) {
        const v = Math.round(Number(n));
        return Number.isFinite(v) ? Math.min(R.MPARK_MAX, Math.max(1, v)) : null;
    }

    function mparkTarget(world) {
        return clampMpark((Store.load(MPARK_KEY, {}) || {})[world]) || R.MPARK_MAX;
    }

    function setMparkTarget(world, n) {
        const v = Store.load(MPARK_KEY, {}) || {};
        const t = clampMpark(n);
        if (t) v[world] = t;
        else delete v[world];
        Store.save(MPARK_KEY, v);
    }

    const isShared = (it) => SchedulerState.isWorldShared(it.content_name);

    // ctx.visible(items): 등록 필터 적용
    function create(ctx) {
        let editing = false;

        // ── 계산 ──
        // 월드 공유 항목: 서버마다 한 번만 (값이 다르면 더 많이 진행된 쪽)
        //  - 몬스터파크: now / 서버 목표, 목표 이상이면 완료
        //  - 그 외: 일퀘 게이지에 1개로 포함
        function sharedOf(g) {
            const byName = new Map();
            g.entries.forEach(({ st }) => {
                if (st.status !== 'ok') return;
                ctx.visible(st.data.daily_contents || []).filter(isShared).forEach((it) => {
                    const prev = byName.get(it.content_name);
                    if (!prev || Number(it.now_count) > Number(prev.now_count)) byName.set(it.content_name, it);
                });
            });
            return Array.from(byName.values()).map((it) => {
                if (!R.isMpark(it.content_name)) {
                    return { it, mpark: false, done: SchedulerState.contentDone(it), sub: SchedulerState.contentProgress(it) };
                }
                const target = mparkTarget(g.world);
                const now = Number(it.now_count) || 0;
                return { it, mpark: true, now, target, done: now >= target, sub: `${now}/${target}` };
            });
        }

        // 캐릭터 한 줄: 월드 공유 항목을 뺀 일일 컨텐츠 (이름은 지역 이름만)
        function rowOf(e) {
            if (e.st.status !== 'ok') return { e };
            const items = ctx.visible(e.st.data.daily_contents || []).filter((it) => !isShared(it)).map((it) => {
                const q = R.dailyQuestName(it.content_name);
                return { name: q.name, tagged: q.tagged, sub: SchedulerState.contentProgress(it), done: SchedulerState.contentDone(it) };
            });
            return { e, items };
        }

        // → { worlds: [{ world, entries, shared, rows, tagged }], gauges }
        function compute(entries) {
            const worlds = BoardUI.groupByWorld(entries).map((g) => {
                const shared = sharedOf(g);
                const rows = g.entries.map(rowOf);
                const quest = [0, 0];
                const count = (done) => { quest[0] += done ? 1 : 0; quest[1] += 1; };
                rows.forEach((r) => (r.items || []).forEach((it) => count(it.done)));
                shared.filter((s) => !s.mpark).forEach((s) => count(s.done));
                const list = (quest[1] ? [['일퀘', 'is-main', quest[0], quest[1]]] : [])
                    .concat(shared.filter((s) => s.mpark).map((s) => ['몬파', 'is-mpark', Math.min(s.now, s.target), s.target, '',
                        { name: `${g.world || ''} 몬스터파크`.trim() }]));
                const tagged = rows.some((r) => (r.items || []).some((it) => it.tagged));
                return { world: g.world, entries: g.entries, shared, rows, tagged, list };
            });
            return { worlds, gauges: worlds.map(({ world, list }) => ({ world, list })) };
        }

        // ── 그리기 ──
        function sharedHtml(w) {
            if (!w.shared.length) return '';
            const items = w.shared.map((s) => {
                const input = s.mpark && editing && w.world
                    ? `<label class="mp-target">목표
                            <input type="number" class="mp-target-input" data-world="${esc(w.world)}" min="1" max="${R.MPARK_MAX}" step="1" value="${s.target}" aria-label="${esc(w.world)} 몬스터파크 목표 횟수">
                       </label>`
                    : '';
                return BoardUI.itemHtml(s.it.content_name, s.sub, s.done, '', input);
            }).join('');
            return `
                <div class="world-shared">
                    <span class="world-shared-label">월드 공유</span>
                    <ul class="sb-items">${items}</ul>
                </div>`;
        }

        // 진행도는 캐릭터별로 표시하지 않고 섹션 위쪽 서버별 게이지로만 표시
        function rowHtml({ e, items }) {
            const name = BoardUI.nameCellHtml(e.st);
            if (!items) return name + BoardUI.statusCellHtml(e.st, 'dm-cell');
            if (!items.length) return name + '<div class="bm-cell dm-cell is-empty"><span class="bm-none">등록된 일일 컨텐츠 없음</span></div>';
            const complete = items.every((it) => it.done);
            return name + `
                <div class="bm-cell dm-cell${complete ? ' is-complete' : ''}">
                    <ul class="sb-items">
                        ${items.map((it) => BoardUI.itemHtml(it.name, it.sub, it.done)).join('')}
                    </ul>
                </div>`;
        }

        function html(model, entries) {
            const byWorld = new Map(model.worlds.map((w) => [w.world, w]));
            const note = editing
                ? `<p class="sb-agg-note ep-note">서버별 몬스터파크 목표 횟수(1~${R.MPARK_MAX})를 입력하세요. 목표 이상 진행하면 완료(초록)로 표시됩니다. 변경 내용은 바로 저장됩니다.</p>`
                : '';
            return BoardUI.sectionHtml({
                key: 'daily',
                title: '일일 컨텐츠',
                editing,
                actions: BoardUI.resetHtml('daily') + BoardUI.editBtnHtml('daily', editing),
                gauges: BoardUI.worldGaugesHtml(model.gauges),
                body: `
                    ${note}
                    ${BoardUI.worldBoxes(entries, (g) => {
                        const w = byWorld.get(g.world);
                        return sharedHtml(w)
                            + (w.tagged ? '<div class="dm-cat-label">일일퀘스트</div>' : '')
                            + `<div class="dm">${w.rows.map(rowHtml).join('')}</div>`;
                    })}`,
            });
        }

        // ── 이벤트 (처리했으면 true → 다시 그림) ──
        function onChange(e) {
            if (e.target.closest('.mp-target-input')) {
                setMparkTarget(e.target.dataset.world, e.target.value);
                return true;
            }
            return false;
        }

        return {
            compute, html, onChange,
            get editing() { return editing; },
            set editing(v) { editing = !!v; },
            reset: {
                message: '일일 컨텐츠의 편집 설정(서버별 몬스터파크 목표 횟수)을 초기화할까요?',
                keys: [MPARK_KEY],
            },
        };
    }

    window.BoardDaily = { create };
})();
