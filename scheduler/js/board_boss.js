/* ── 스케줄 보드: 보스 섹션 ──
 * 캐릭터 × 일일/주간/월간 보스 표 + 서버별 게이지
 * 펼침 상태는 저장하지 않음 → 페이지를 열 때마다 모두 접힌 상태로 시작
 * 의존: util.js, reset.js, scheduler_state.js, difficulty.js, board_rules.js, board_ui.js
 */
(function () {
    const { esc } = BoardUI;
    const R = BoardRules;
    const COLS = ['bossDaily', 'bossWeekly', 'bossMonthly'];
    const GAUGE_CLASS = { bossDaily: 'is-daily', bossWeekly: 'is-weekly', bossMonthly: 'is-monthly' };

    // ctx.visible(items): 등록 필터 적용
    function create(ctx) {
        // ── 펼침 상태 (메모리) ──
        const colOpenState = {};          // 열 단위 '전체 펼치기'
        const cellOverride = new Map();   // 칸 단위 (열 상태와 반대일 때만)

        const colOpen = (col) => !!colOpenState[col];

        function setColOpen(col, open) {
            colOpenState[col] = open;
            Array.from(cellOverride.keys()).forEach((k) => { if (k.endsWith('|' + col)) cellOverride.delete(k); });
        }

        function cellOpen(ocid, col) {
            const k = ocid + '|' + col;
            return cellOverride.has(k) ? cellOverride.get(k) : colOpen(col);
        }

        function toggleCell(ocid, col) {
            const k = ocid + '|' + col;
            const next = !cellOpen(ocid, col);
            if (next === colOpen(col)) cellOverride.delete(k);
            else cellOverride.set(k, next);
        }

        // ── 계산 ──
        function bossesOf(d, col) {
            return ctx.visible(d.boss_contents || [])
                .filter((b) => b.cycle === col)
                .sort((a, b) => R.bossRank(a.content_name) - R.bossRank(b.content_name)
                    || Number(a.list_order_no) - Number(b.list_order_no));
        }

        const isDone = (b) => SchedulerState.flag(b.complete_flag);

        // 캐릭터 목록의 주기별 [완료, 전체]
        function countOf(entries, col) {
            let done = 0;
            let total = 0;
            entries.forEach(({ st }) => {
                if (st.status !== 'ok') return;
                const bs = bossesOf(st.data, col);
                total += bs.length;
                done += bs.filter(isDone).length;
            });
            return [done, total];
        }

        // → { cols: { 주기: [완료, 전체] }, gauges: 서버별 게이지 }
        function compute(entries) {
            const cols = {};
            COLS.forEach((col) => { cols[col] = countOf(entries, col); });
            // 서버별 박스, 서버 안에서 주기별 합산 (보스가 없는 주기는 생략, 위에서부터 월간 → 주간 → 일일)
            const gauges = BoardUI.groupByWorld(entries).map((g) => ({
                world: g.world,
                list: COLS.map((col) => {
                    const [done, total] = countOf(g.entries, col);
                    return [SchedulerState.bossCycle(col).title.replace('보스', ''), GAUGE_CLASS[col], done, total, ddayHtml(col, done, total)];
                }).filter((x) => x[3] > 0).reverse(),
            }));
            return { cols, gauges };
        }

        // ── 그리기 ──
        // 초기화까지 남은 일수 D-n (남은 일수는 올림, 예: 20시간 → D1)
        //  - 완료: 초록 / 미완료: 주황, 기준 일수 이하면 빨강
        //  - 일일보스: D-day 없이 같은 너비만 비워 둬 게이지·n/n 위치를 통일
        function ddayHtml(col, done, total) {
            const red = R.BOSS_DDAY_RED[col];
            if (!red) return '<b class="dday is-empty" aria-hidden="true"></b>';
            const info = SchedulerState.bossCycle(col);
            const next = Reset.nextReset(info.reset);
            const days = Math.max(1, Math.ceil((next.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
            const complete = total > 0 && done >= total;
            const cls = complete ? 'is-done' : (days <= red ? 'is-urgent' : 'is-pending');
            return `<b class="dday ${cls}" title="${esc(info.title)} 초기화 ${Reset.untilText(next)}">D${days}</b>`;
        }

        function listHtml(bosses) {
            return `<ul class="bm-list">${bosses.map((b) => {
                const ok = isDone(b);
                return `
                    <li class="bm-item${ok ? ' is-done' : ''}">
                        <span class="sb-mark" aria-hidden="true">${ok ? '✓' : ''}</span>
                        ${Difficulty.badge(b.difficulty)}
                        <span class="sb-name">${esc(b.content_name)}</span>
                        <span class="sr-only">${ok ? '완료' : '미완료'}</span>
                    </li>`;
            }).join('')}</ul>`;
        }

        function cellHtml(id, d, col) {
            const bosses = bossesOf(d, col);
            if (!bosses.length) return '<div class="bm-cell is-empty"><span class="bm-none">-</span></div>';
            const done = bosses.filter(isDone).length;
            const complete = done === bosses.length;
            // 일일·월간 보스가 적으면 게이지·펼치기 없이 목록만
            if (col !== 'bossWeekly' && bosses.length <= R.BOSS_FLAT_MAX) {
                return `
                    <div class="bm-cell bm-cell-${col} is-flat${complete ? ' is-complete' : ''}">
                        ${listHtml(bosses)}
                    </div>`;
            }
            const open = cellOpen(id, col);
            const pct = Math.round((done / bosses.length) * 100);
            const limit = col === 'bossWeekly' && d.weekly_boss_clear_limit_count
                ? `<span class="bm-limit" title="주간 보스 처치 횟수 / 제한">처치 ${esc(d.weekly_boss_clear_count ?? 0)}/${esc(d.weekly_boss_clear_limit_count)}</span>`
                : '';
            return `
                <div class="bm-cell bm-cell-${col}${complete ? ' is-complete' : ''}${open ? ' is-open' : ''}">
                    <button type="button" class="bm-toggle" data-ocid="${esc(id)}" data-col="${col}" aria-expanded="${open}">
                        <span class="bm-prog">${done}/${bosses.length}</span>
                        <span class="bm-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
                        <span class="bm-caret" aria-hidden="true">${open ? '▴' : '▾'}</span>
                    </button>
                    ${limit}
                    ${open ? listHtml(bosses) : ''}
                </div>`;
        }

        function headHtml(col, [done, total]) {
            const info = SchedulerState.bossCycle(col);
            const open = colOpen(col);
            return `
                <div class="bm-head">
                    <div class="bm-head-top">
                        <strong>${esc(info.title)}</strong>
                        <span class="sb-count">${total ? `${done}/${total}` : ''}</span>
                        ${total ? ddayHtml(col, done, total) : ''}
                    </div>
                    ${BoardUI.resetHtml(info.reset)}
                    <button type="button" class="bm-col-toggle" data-col="${col}" aria-pressed="${open}">
                        ${open ? '전체 접기' : '전체 펼치기'}
                    </button>
                </div>`;
        }

        function rowHtml({ id, st }) {
            if (st.status !== 'ok') return BoardUI.nameCellHtml(st) + BoardUI.statusCellHtml(st, 'bm-span');
            return BoardUI.nameCellHtml(st) + COLS.map((col) => cellHtml(id, st.data, col)).join('');
        }

        function html(model, entries) {
            return BoardUI.sectionHtml({
                key: 'boss',
                title: '보스',
                actions: '',
                gauges: BoardUI.worldGaugesHtml(model.gauges),
                body: `
                    <div class="bm-scroll">
                        <div class="bm-wrap">
                            <div class="bm bm-head-row">
                                <div class="bm-head bm-head-name">캐릭터</div>
                                ${COLS.map((col) => headHtml(col, model.cols[col])).join('')}
                            </div>
                            ${BoardUI.worldBoxes(entries, (g) => `<div class="bm">${g.entries.map(rowHtml).join('')}</div>`)}
                        </div>
                    </div>`,
            });
        }

        // ── 이벤트 (처리했으면 true → 다시 그림) ──
        function onClick(e) {
            const cell = e.target.closest('.bm-toggle');
            if (cell) {
                toggleCell(cell.dataset.ocid, cell.dataset.col);
                return true;
            }
            const col = e.target.closest('.bm-col-toggle');
            if (col) {
                setColOpen(col.dataset.col, !colOpen(col.dataset.col));
                return true;
            }
            return false;
        }

        return { compute, html, onClick };
    }

    window.BoardBoss = { create };
})();
