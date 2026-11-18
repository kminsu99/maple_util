/* ── 스케줄 보드 UI ──
 * 등록된 캐릭터(ocid)의 스케줄러 정보만 API로 불러와 표시
 * 순서: 주간 컨텐츠(전체 합산, 같은 항목은 1줄) → 보스(캐릭터 × 일일/주간/월간 표) → 일일 컨텐츠(캐릭터별 표)
 * 불러오는 시점: 페이지 진입, 등록 캐릭터 변경([완료]), API 키 저장, [새로고침]
 * 의존: util.js, store.js, reset.js, characters.js, scheduler_state.js, difficulty.js, css/schedule_board.css
 */
(function () {
    const ONLY_REG_KEY = 'only_registered';    // 인게임 스케줄러 등록 항목만 보기
    const esc = Util.esc;

    function mount(container) {
        if (!container) return;
        container.classList.add('sb');

        // ocid → { status: 'loading' | 'ok' | 'error', data, error }
        const states = new Map();
        let loadSeq = 0;

        function onlyRegistered() {
            return Store.load(ONLY_REG_KEY, true);
        }

        function visible(items) {
            if (!onlyRegistered()) return items;
            return items.filter((it) => SchedulerState.flag(it.registration_flag));
        }

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

        // ── 등록 캐릭터 목록 (레벨 높은 순) ──
        function entriesSorted() {
            return Characters.registeredIds().map((id) => ({ id, st: states.get(id) || { status: 'loading' } }))
                .sort((a, b) => {
                    const la = a.st.data ? Number(a.st.data.character_level) : -1;
                    const lb = b.st.data ? Number(b.st.data.character_level) : -1;
                    return lb - la;
                });
        }

        // 왼쪽 캐릭터 이름 칸 (보스 표·일일 표 공용)
        function nameCellHtml(st) {
            const d = st.data;
            return `
                <div class="bm-name">
                    <strong>${d ? esc(d.character_name) : (st.status === 'error' ? '불러오기 실패' : '불러오는 중…')}</strong>
                    ${d ? `<span>Lv.${esc(d.character_level)}</span>` : ''}
                </div>`;
        }

        function statusCellHtml(st, cls) {
            const msg = st.status === 'error'
                ? `<span class="sb-error">${esc(st.error)}</span>`
                : '<span class="bm-none">불러오는 중…</span>';
            return `<div class="bm-cell ${cls}">${msg}</div>`;
        }

        function renderToolbar(st) {
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

        // ── 항목 ──
        // badge: 이름 앞에 붙는 HTML (보스 난이도 배지 등, 이미 이스케이프된 값)
        function itemHtml(name, sub, done, badge) {
            return `
                <li class="sb-item${done ? ' is-done' : ''}">
                    <span class="sb-mark" aria-hidden="true">${done ? '✓' : ''}</span>
                    ${badge || ''}
                    <span class="sb-name">${esc(name)}</span>
                    ${sub ? `<span class="sb-sub">${esc(sub)}</span>` : ''}
                    <span class="sr-only">${done ? '완료' : '미완료'}</span>
                </li>`;
        }

        // ── 보스 (등록 캐릭터 전체, 캐릭터 × 일일/주간/월간 표) ──
        const BOSS_COLS = ['bossDaily', 'bossWeekly', 'bossMonthly'];
        // 펼침 상태는 저장하지 않음 → 페이지를 열 때마다 모두 접힌 상태로 시작
        const colOpenState = {};               // 열 단위 '전체 펼치기' 상태 (메모리)
        const cellOverride = new Map();        // 칸 단위 펼침 상태 (열 상태와 반대일 때만, 메모리)
        Store.remove('boss_open');             // 이전 버전에서 저장한 펼침 상태 정리

        function colOpen(col) {
            return !!colOpenState[col];
        }

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

        // 보스 표시 순서: 아래 목록의 역순 (유피테르가 맨 위, 자쿰이 맨 아래)
        // 목록에 없는 보스는 그 뒤에 API 순서(list_order_no)대로 표시
        const BOSS_ORDER = [
            '자쿰', '파풀라투스', '반반', '블러디퀸', '벨룸', '피에르', '매그너스', '스우', '데미안',
            '가디언 엔젤 슬라임', '윌', '더스크', '루시드', '진 힐라', '듄켈', '검은 마법사', '선택받은 세렌',
            '감시자 칼로스', '카링', '벨로나', '림보', '발드릭스', '최초의 대적자', '찬란한 흉성', '유피테르',
        ].reverse().map((n) => n.replace(/\s+/g, ''));

        function bossRank(name) {
            const n = String(name || '').replace(/\s+/g, '');
            const exact = BOSS_ORDER.indexOf(n);
            if (exact >= 0) return exact;
            const part = BOSS_ORDER.findIndex((k) => n.includes(k));
            return part >= 0 ? part : BOSS_ORDER.length;
        }

        function bossesOf(d, col) {
            return visible(d.boss_contents || [])
                .filter((b) => b.cycle === col)
                .sort((a, b) => bossRank(a.content_name) - bossRank(b.content_name)
                    || Number(a.list_order_no) - Number(b.list_order_no));
        }

        function bossCell(id, d, col) {
            const bosses = bossesOf(d, col);
            if (!bosses.length) return '<div class="bm-cell is-empty"><span class="bm-none">-</span></div>';
            const done = bosses.filter((b) => SchedulerState.flag(b.complete_flag)).length;
            const pct = Math.round((done / bosses.length) * 100);
            const open = cellOpen(id, col);
            const complete = done === bosses.length;
            const limit = col === 'bossWeekly' && d.weekly_boss_clear_limit_count
                ? `<span class="bm-limit" title="주간 보스 처치 횟수 / 제한">처치 ${esc(d.weekly_boss_clear_count ?? 0)}/${esc(d.weekly_boss_clear_limit_count)}</span>`
                : '';
            const list = open
                ? `<ul class="bm-list">${bosses.map((b) => {
                    const ok = SchedulerState.flag(b.complete_flag);
                    return `
                        <li class="bm-item${ok ? ' is-done' : ''}">
                            <span class="sb-mark" aria-hidden="true">${ok ? '✓' : ''}</span>
                            ${Difficulty.badge(b.difficulty)}
                            <span class="sb-name">${esc(b.content_name)}</span>
                            <span class="sr-only">${ok ? '완료' : '미완료'}</span>
                        </li>`;
                }).join('')}</ul>`
                : '';
            return `
                <div class="bm-cell bm-cell-${col}${complete ? ' is-complete' : ''}${open ? ' is-open' : ''}">
                    <button type="button" class="bm-toggle" data-ocid="${esc(id)}" data-col="${col}" aria-expanded="${open}">
                        <span class="bm-prog">${done}/${bosses.length}</span>
                        <span class="bm-bar" aria-hidden="true"><i style="width:${pct}%"></i></span>
                        <span class="bm-caret" aria-hidden="true">${open ? '▴' : '▾'}</span>
                    </button>
                    ${limit}
                    ${list}
                </div>`;
        }

        // 초기화까지 남은 일수 D-n (주간·월간보스 항상 표시)
        //  - 남은 일수는 올림 (예: 20시간 남음 → D1)
        //  - 진행도 100%: 초록색
        //  - 진행도 100% 미만: 주황색, 주간보스 2일 이하·월간보스 7일 이하면 빨간색
        const BOSS_DDAY_RED = { bossWeekly: 2, bossMonthly: 7 };

        function bossDdayHtml(col, done, total) {
            const red = BOSS_DDAY_RED[col];
            // 일일보스: D-day는 없지만 같은 너비를 비워 둬 게이지·n/n 위치를 통일
            if (!red) return '<b class="dday is-empty" aria-hidden="true"></b>';
            const info = SchedulerState.bossCycle(col);
            const next = Reset.nextReset(info.reset);
            const days = Math.max(1, Math.ceil((next.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
            const complete = total > 0 && done >= total;
            const cls = complete ? 'is-done' : (days <= red ? 'is-urgent' : 'is-pending');
            return `<b class="dday ${cls}" title="${esc(info.title)} 초기화 ${Reset.untilText(next)}">D${days}</b>`;
        }

        function bossMatrix(entries) {
            const head = BOSS_COLS.map((col) => {
                const info = SchedulerState.bossCycle(col);
                let done = 0;
                let total = 0;
                entries.forEach(({ st }) => {
                    if (st.status !== 'ok') return;
                    const bs = bossesOf(st.data, col);
                    total += bs.length;
                    done += bs.filter((b) => SchedulerState.flag(b.complete_flag)).length;
                });
                const open = colOpen(col);
                return `
                    <div class="bm-head">
                        <div class="bm-head-top">
                            <strong>${esc(info.title)}</strong>
                            <span class="sb-count">${total ? `${done}/${total}` : ''}</span>
                            ${total ? bossDdayHtml(col, done, total) : ''}
                        </div>
                        <span class="sb-reset">초기화 ${Reset.untilText(Reset.nextReset(info.reset))}</span>
                        <button type="button" class="bm-col-toggle" data-col="${col}" aria-pressed="${open}">
                            ${open ? '전체 접기' : '전체 펼치기'}
                        </button>
                    </div>`;
            }).join('');

            const rowHtml = ({ id, st }) => {
                if (st.status !== 'ok') return nameCellHtml(st) + statusCellHtml(st, 'bm-span');
                return nameCellHtml(st) + BOSS_COLS.map((col) => bossCell(id, st.data, col)).join('');
            };

            // 게이지: 일일·주간·월간 보스별 전체 캐릭터 합산 (보스가 없는 주기는 생략)
            summary.boss = BOSS_COLS.map((col) => {
                let done = 0;
                let total = 0;
                entries.forEach(({ st }) => {
                    if (st.status !== 'ok') return;
                    const bs = bossesOf(st.data, col);
                    total += bs.length;
                    done += bs.filter((b) => SchedulerState.flag(b.complete_flag)).length;
                });
                return [SchedulerState.bossCycle(col).title.replace('보스', ''), ({ bossDaily: 'is-daily', bossWeekly: 'is-weekly', bossMonthly: 'is-monthly' })[col] || 'is-main', done, total,
                    bossDdayHtml(col, done, total)];
            }).filter((g) => g[3] > 0).reverse();   // 게이지는 월간 → 주간 → 일일 순서 (위에서부터)
            const gauges = gaugesHtml(summary.boss);

            return `
                <section class="sb-cat panel${foldClass('boss')}">
                    <div class="sb-cat-head">
                        <h2>보스</h2>
                        <div class="sb-cat-actions">${foldBtnHtml('boss')}</div>
                    </div>
                    ${gauges}
                    <div class="bm-scroll">
                        <div class="bm-wrap">
                            <div class="bm bm-head-row">
                                <div class="bm-head bm-head-name">캐릭터</div>
                                ${head}
                            </div>
                            ${worldBoxes(entries, (g) => `<div class="bm">${g.entries.map(rowHtml).join('')}</div>`)}
                        </div>
                    </div>
                </section>`;
        }

        // ── 일일 컨텐츠 (등록 캐릭터 전체, 왼쪽 이름 · 오른쪽 해당 캐릭터의 일일 컨텐츠) ──
        // 같은 월드(서버) 캐릭터끼리 묶음 (월드 순서: 가장 높은 레벨 캐릭터가 있는 월드부터)
        function groupByWorld(entries) {
            const groups = [];
            entries.forEach((e) => {
                const world = e.st.data ? e.st.data.world_name : '';
                let g = groups.find((x) => x.world === world);
                if (!g) groups.push(g = { world, entries: [] });
                g.entries.push(e);
            });
            // 불러오는 중/오류(월드 미확인)는 맨 뒤
            return groups.sort((a, b) => (a.world ? 0 : 1) - (b.world ? 0 : 1));
        }

        // 월드별 색 테두리 박스 (보스 표·일일 표 공용), inner(g): 박스 안 HTML
        function worldBoxes(entries, inner) {
            return `<div class="world-boxes">${groupByWorld(entries).map((g) => {
                const color = g.world ? Util.worldColor(g.world) : 'var(--border)';
                return `
                    <div class="world-box" style="--world-color:${color}">
                        <div class="world-box-head">
                            <strong>${g.world ? Util.worldIcon(g.world) + esc(g.world) : '월드 확인 중'}</strong>
                            <span>${g.entries.length}명</span>
                        </div>
                        ${inner(g)}
                    </div>`;
            }).join('')}</div>`;
        }

        function dailyMatrix(entries) {
            let allDone = 0;
            let allTotal = 0;
            const isShared = (it) => SchedulerState.isWorldShared(it.content_name);

            // 월드 공유 항목(몬스터파크 등): 월드마다 한 번만, 캐릭터 목록 위에 표시
            const sharedHtml = (g) => {
                const byName = new Map();
                g.entries.forEach(({ st }) => {
                    if (st.status !== 'ok') return;
                    visible(st.data.daily_contents || []).filter(isShared).forEach((it) => {
                        const prev = byName.get(it.content_name);
                        // 값이 다르면 더 많이 진행된 쪽을 사용
                        if (!prev || Number(it.now_count) > Number(prev.now_count)) byName.set(it.content_name, it);
                    });
                });
                const items = Array.from(byName.values());
                if (!items.length) return '';
                allDone += items.filter(SchedulerState.contentDone).length;
                allTotal += items.length;
                return `
                    <div class="world-shared">
                        <span class="world-shared-label">월드 공유</span>
                        <ul class="sb-items">
                            ${items.map((it) => itemHtml(it.content_name, SchedulerState.contentProgress(it), SchedulerState.contentDone(it))).join('')}
                        </ul>
                    </div>`;
            };

            const rowHtml = ({ st }) => {
                if (st.status !== 'ok') return nameCellHtml(st) + statusCellHtml(st, 'dm-cell');
                const items = visible(st.data.daily_contents || []).filter((it) => !isShared(it));
                if (!items.length) {
                    return nameCellHtml(st) + '<div class="bm-cell dm-cell is-empty"><span class="bm-none">등록된 일일 컨텐츠 없음</span></div>';
                }
                const done = items.filter(SchedulerState.contentDone).length;
                allDone += done;
                allTotal += items.length;
                const complete = done === items.length;
                // 진행도는 캐릭터별로 표시하지 않고 섹션 상단의 전체 게이지 하나로만 표시
                return nameCellHtml(st) + `
                    <div class="bm-cell dm-cell${complete ? ' is-complete' : ''}">
                        <ul class="sb-items">
                            ${items.map((it) => itemHtml(it.content_name, SchedulerState.contentProgress(it), SchedulerState.contentDone(it))).join('')}
                        </ul>
                    </div>`;
            };
            const boxes = worldBoxes(entries, (g) => sharedHtml(g) + `<div class="dm">${g.entries.map(rowHtml).join('')}</div>`);
            summary.daily = allTotal ? [['전체', 'is-main', allDone, allTotal]] : [];
            return `
                <section class="sb-cat panel${foldClass('daily')}">
                    <div class="sb-cat-head">
                        <h2>일일 컨텐츠</h2>
                        <div class="sb-cat-actions">
                            <span class="sb-reset">초기화 ${Reset.untilText(Reset.nextReset('daily'))}</span>
                            ${foldBtnHtml('daily')}
                        </div>
                    </div>
                    ${gaugesHtml(summary.daily)}
                    ${boxes}
                </section>`;
        }

        // ── 주간 컨텐츠 (등록 캐릭터 전체 합산) ──
        // 캐릭터별로 등록된 항목을 모두 모아 한 줄씩 표시하고, 클리어한 캐릭터 이름을 옆에 표시
        // 같은 이름의 항목은 한 줄로 합침
        // 에픽 던전: 인게임 등록 여부와 관계없이 전부 표시, [편집]에서 노출 여부·담당 캐릭터 지정
        // 서버별 저장: { '월드|던전명': { hidden: bool, ocid: '담당 캐릭터' } }
        // 이전 버전의 { 던전명: {...} } 값은 서버별 값이 없을 때 기본값으로 사용
        const EPIC_KEY = 'epic_settings';
        let weeklyEditing = false;

        function isEpic(name) {
            return /에픽\s*던전/.test(String(name || ''));
        }

        function epicSettings() {
            const v = Store.load(EPIC_KEY, {});
            return v && typeof v === 'object' ? v : {};
        }

        function epicKey(world, name) {
            return `${world}|${name}`;
        }

        function epicSetting(all, world, name) {
            return Object.assign({}, all[name], all[epicKey(world, name)]);
        }

        // key: epicKey(월드, 던전명)
        function setEpicSetting(key, patch) {
            const all = epicSettings();
            const name = key.slice(key.indexOf('|') + 1);
            all[key] = Object.assign({}, all[name], all[key], patch);
            Store.save(EPIC_KEY, all);
        }

        function weeklyRows(entries) {
            const rows = [];
            const byKey = new Map();
            entries.forEach(({ st }) => {
                if (st.status !== 'ok') return;
                const d = st.data;
                const list = d.weekly_contents || [];
                // 에픽 던전은 등록 필터와 관계없이 모두 포함
                const shown = new Set(visible(list));
                list.filter((it) => shown.has(it) || isEpic(it.content_name)).forEach((it) => {
                    const key = String(it.content_name || '').trim();
                    let r = byKey.get(key);
                    if (!r) {
                        r = {
                            name: key,
                            epic: isEpic(key),
                            shared: SchedulerState.isWorldShared(key),
                            members: [], cleared: [], worlds: [], clearedWorlds: [],
                        };
                        byKey.set(key, r);
                        rows.push(r);
                    }
                    if (!r.members.includes(d.character_name)) r.members.push(d.character_name);
                    if (!r.worlds.includes(d.world_name)) r.worlds.push(d.world_name);
                    if (SchedulerState.contentDone(it)) {
                        if (!r.cleared.includes(d.character_name)) r.cleared.push(d.character_name);
                        if (!r.clearedWorlds.includes(d.world_name)) r.clearedWorlds.push(d.world_name);
                    }
                });
            });
            return rows;
        }

        // 에픽 던전 편집 컨트롤: 노출 여부 + 담당 캐릭터
        function epicEditHtml(r, setting, entries) {
            const options = entries.filter((e) => e.st.status === 'ok').map(({ id, st }) =>
                `<option value="${esc(id)}"${setting.ocid === id ? ' selected' : ''}>${esc(st.data.character_name)} (${esc(st.data.world_name)})</option>`
            ).join('');
            return `
                <span class="ep-edit">
                    <label class="ep-show">
                        <input type="checkbox" class="ep-show-input" data-name="${esc(r.key || r.name)}"${setting.hidden ? '' : ' checked'}>
                        표시
                    </label>
                    <label class="ep-assign">
                        담당
                        <select class="ep-assign-select" data-name="${esc(r.key || r.name)}">
                            <option value="">지정 안 함</option>
                            ${options}
                        </select>
                    </label>
                </span>`;
        }

        // 담당 캐릭터 표시 태그
        function epicOwnerHtml(setting, entries) {
            if (!setting.ocid) return '';
            const e = entries.find((x) => x.id === setting.ocid);
            const name = e && e.st.data ? e.st.data.character_name : (e ? '불러오는 중…' : '등록 해제된 캐릭터');
            return `<span class="ep-owner" title="담당 캐릭터">${esc(name)}</span>`;
        }

        // ── 주간 컨텐츠 메뉴 순서 (편집에서 변경, 항목 이름 배열로 저장) ──
        const ORDER_KEY = 'weekly_order';

        function savedOrder() {
            const v = Store.load(ORDER_KEY, []);
            return Array.isArray(v) ? v : [];
        }

        // 저장된 순서대로 정렬, 저장 순서에 없는 새 항목은 원래 순서대로 뒤에 붙임
        function applyOrder(rows) {
            const order = savedOrder();
            const pos = (r, i) => {
                const k = order.indexOf(r.name);
                return k >= 0 ? k : order.length + i;
            };
            return rows.map((r, i) => ({ r, p: pos(r, i) })).sort((a, b) => a.p - b.p).map((x) => x.r);
        }

        // 현재 표시 순서(names)에서 name을 한 칸 이동(dir: -1 위, +1 아래) 후 저장
        function moveItem(names, name, dir) {
            const i = names.indexOf(name);
            const j = i + dir;
            if (i < 0 || j < 0 || j >= names.length) return;
            const next = names.slice();
            [next[i], next[j]] = [next[j], next[i]];
            // 지금 화면에 없는 항목의 기존 순서도 보존
            const rest = savedOrder().filter((n) => !next.includes(n));
            Store.save(ORDER_KEY, next.concat(rest));
        }

        // 드래그 앤 드롭: name을 target 앞(after=false) 또는 뒤(after=true)로 옮긴 후 저장
        function moveItemTo(names, name, target, after) {
            if (name === target) return;
            const next = names.filter((n) => n !== name);
            const t = next.indexOf(target);
            if (t < 0) return;
            next.splice(after ? t + 1 : t, 0, name);
            const rest = savedOrder().filter((n) => !next.includes(n));
            Store.save(ORDER_KEY, next.concat(rest));
        }

        let currentWeeklyNames = [];   // 편집 중 화면의 항목 순서 (이동 버튼·드래그 처리용)

        function orderBtnsHtml(r, i, total) {
            return `
                <span class="ord-btns">
                    <span class="ord-handle" title="끌어서 순서 변경" aria-hidden="true">⠿</span>
                    <button type="button" class="ord-btn" data-move="-1" data-name="${esc(r.name)}"${i === 0 ? ' disabled' : ''} aria-label="${esc(r.name)} 위로">▲</button>
                    <button type="button" class="ord-btn" data-move="1" data-name="${esc(r.name)}"${i === total - 1 ? ' disabled' : ''} aria-label="${esc(r.name)} 아래로">▼</button>
                </span>`;
        }

        // ── 메인/서브 태그 (주간 컨텐츠 편집에서 지정, 항목명 기준) ──
        // def: 기본값 ('main' | 'sub', 생략 시 메인)
        // 저장: { 이름: 'main' | 'sub' } — 기본값과 다를 때만 저장
        const TAG_KEYS = { weekly: 'weekly_tags' };
        Store.remove('boss_char_tags');   // 보스 메인/서브 기능 삭제 → 이전 저장값 정리

        function itemTag(name, kind, def) {
            const v = Store.load(TAG_KEYS[kind || 'weekly'], {}) || {};
            if (v[name] === 'sub' || v[name] === 'main') return v[name];
            return def === 'sub' ? 'sub' : 'main';
        }

        function toggleTag(name, kind, def) {
            const key = TAG_KEYS[kind || 'weekly'];
            const v = Store.load(key, {}) || {};
            const next = itemTag(name, kind, def) === 'sub' ? 'main' : 'sub';
            if (next === (def === 'sub' ? 'sub' : 'main')) delete v[name];
            else v[name] = next;
            Store.save(key, v);
        }

        function tagBtnHtml(name, kind, def) {
            const tag = itemTag(name, kind, def);
            return `<button type="button" class="tag-btn is-${tag}" data-name="${esc(name)}" data-kind="${kind || 'weekly'}" data-def="${def === 'sub' ? 'sub' : 'main'}" title="눌러서 메인/서브 전환"><b>${tag === 'sub' ? '서브' : '메인'}</b></button>`;
        }

        // ── 큰 박스(주간 컨텐츠/보스/일일 컨텐츠) 접기/펴기 ──
        // 접어도 제목과 게이지는 그대로 표시, 상태는 저장
        const FOLD_KEY = 'section_folded';   // { weekly: true, boss: true, daily: true }

        function isFolded(section) {
            const v = Store.load(FOLD_KEY, {});
            return !!(v && v[section]);
        }

        function toggleFold(section) {
            const v = Store.load(FOLD_KEY, {}) || {};
            if (v[section]) delete v[section];
            else v[section] = true;
            Store.save(FOLD_KEY, v);
            // 접으면 편집 모드도 종료
            if (v[section] && section === 'weekly') weeklyEditing = false;
        }

        function foldClass(section) {
            return isFolded(section) ? ' is-folded' : '';
        }

        function foldBtnHtml(section) {
            const folded = isFolded(section);
            return `<button type="button" class="sb-fold" data-section="${section}" aria-expanded="${!folded}" title="${folded ? '펼치기' : '접기'}">${folded ? '펼치기 ▾' : '접기 ▴'}</button>`;
        }

        // 편집 중일 때는 [초기화] 버튼을 함께 표시 (해당 섹션 설정만 초기화)
        function editBtnHtml(section, on) {
            const reset = on
                ? `<button type="button" class="sb-settings-reset" data-section="${section}" title="이 메뉴의 편집 설정만 처음 상태로 되돌립니다">초기화</button>`
                : '';
            return `${reset}<button type="button" class="sb-edit${on ? ' is-on' : ''}" data-section="${section}" aria-pressed="${on}">${on ? '편집 완료' : '편집'}</button>`;
        }

        // 섹션별 편집 설정 초기화
        //  - weekly: 메뉴 순서, 메인/서브, 에픽 던전 표시 여부·담당 캐릭터
        const SECTION_RESET = {
            weekly: {
                message: '주간 컨텐츠의 편집 설정(메뉴 순서, 메인/서브, 에픽 던전 표시·담당 캐릭터)을 모두 초기화할까요?',
                keys: () => [ORDER_KEY, TAG_KEYS.weekly, EPIC_KEY],
            },
        };

        function resetSection(section) {
            const r = SECTION_RESET[section];
            if (!r || !confirm(r.message)) return false;
            r.keys().forEach((k) => Store.remove(k));
            return true;
        }

        // 게이지 묶음: list = [[라벨, 클래스, 완료, 전체], ...]
        function gaugesHtml(list) {
            return list && list.length
                ? `<div class="wk-gauges">${list.map((g) => gaugeHtml(...g)).join('')}</div>`
                : '';
        }

        // 진행도 게이지
        // extra: 숫자 옆에 붙일 HTML (예: 초기화 임박 D-n)
        function gaugeHtml(label, cls, done, total, extra) {
            const pct = total ? Math.round((done / total) * 100) : 0;
            return `
                <div class="wk-gauge ${cls}${total && done === total ? ' is-complete' : ''}">
                    <span class="wk-gauge-label">${label}</span>
                    <span class="wk-gauge-bar" role="progressbar" aria-label="${label} 진행도" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${pct}%"></i></span>
                    <span class="wk-gauge-num"><span class="wk-gauge-count">${done}/${total}</span>${extra || ''}</span>
                </div>`;
        }

        // 서버별 박스로 표시: 각 서버 안에서 캐릭터별 항목을 합산
        // 메뉴 순서·메인/서브는 서버 공통(항목명 기준), 에픽 던전 표시·담당은 서버별
        function weeklyAllSection(entries) {
            const settings = epicSettings();
            const pending = entries.filter((e) => e.st.status === 'loading').length;
            const epicOf = (world, r) => (r.epic ? epicSetting(settings, world, r.name) : {});
            const isHidden = (world, r) => r.epic && !!epicOf(world, r).hidden;
            // 완료 기준
            //  - 월드 공유(에픽 던전 포함): 이 서버에서 완료
            //  - 그 외: 등록한 캐릭터 모두 클리어
            const isRowDone = (r) => {
                if (r.shared) return r.clearedWorlds.length >= r.worlds.length;
                if (r.epic) return r.cleared.length > 0;
                return r.cleared.length >= r.members.length;
            };
            const tags = (list, cls) => (list.length
                ? `<span class="sb-agg-names">${list.map((n) => `<span class="${cls}">${esc(n)}</span>`).join('')}</span>`
                : '');

            // 서버별 행 계산
            const byWorld = new Map();
            groupByWorld(entries).forEach((g) => {
                const all = applyOrder(weeklyRows(g.entries)).map((r) => Object.assign(r, { key: epicKey(g.world, r.name) }));
                const rows = weeklyEditing ? all : all.filter((r) => !isHidden(g.world, r));
                byWorld.set(g.world, { rows, counted: rows.filter((r) => !isHidden(g.world, r)) });
            });
            const counted = [].concat(...Array.from(byWorld.values()).map((v) => v.counted));
            const done = counted.filter(isRowDone).length;
            // 메인/서브 게이지 (숨긴 에픽 던전 제외, 전체 서버 합산)
            const mainRows = counted.filter((r) => itemTag(r.name, 'weekly') === 'main');
            const subRows = counted.filter((r) => itemTag(r.name, 'weekly') === 'sub');
            summary.weekly = counted.length
                ? [['메인', 'is-main', mainRows.filter(isRowDone).length, mainRows.length]]
                    .concat(subRows.length ? [['서브', 'is-sub', subRows.filter(isRowDone).length, subRows.length]] : [])
                : [];
            const gauges = gaugesHtml(summary.weekly);
            // 순서 이동용: 모든 서버 항목명의 합 (서버 공통 순서)
            const seen = new Set();
            currentWeeklyNames = applyOrder([].concat(...Array.from(byWorld.values()).map((v) => v.rows))
                .filter((r) => !seen.has(r.name) && seen.add(r.name))).map((r) => r.name);

            const rowHtml = (g, r, idx, total) => {
                const setting = epicOf(g.world, r);
                const rowDone = isRowDone(r);
                let count = '';
                let names;
                if (r.shared) {
                    // 월드 공유 항목(에픽 던전, 익스트림 몬스터파크): 캐릭터별 구분이 안 되므로
                    // 완료 표시(✓)만 하고 '월드 공유'·서버 이름 태그는 표시하지 않음
                    names = '';
                } else if (/무릉/.test(r.name)) {
                    // 무릉도장: 해당(등록) 캐릭터 이름을 모두 표시, 클리어한 캐릭터는 초록
                    count = `<span class="sb-agg-count">${r.cleared.length}/${r.members.length}</span>`;
                    names = r.members.length
                        ? `<span class="sb-agg-names">${r.members.map((n) => `<span class="${r.cleared.includes(n) ? 'sb-agg-name' : 'sb-agg-member'}">${esc(n)}</span>`).join('')}</span>`
                        : '';
                } else {
                    if (!r.epic) count = `<span class="sb-agg-count">${r.cleared.length}/${r.members.length}</span>`;
                    names = tags(r.cleared, 'sb-agg-name');
                }
                // 담당 캐릭터: 이 서버 캐릭터 중에서만 선택·표시
                const owned = setting.ocid && entries.some((x) => x.id === setting.ocid) && !g.entries.some((x) => x.id === setting.ocid)
                    ? {} : setting;
                const extra = r.epic
                    ? (weeklyEditing ? epicEditHtml(r, owned, g.entries) : epicOwnerHtml(owned, entries))
                    : '';
                return `
                    <li class="sb-agg-item${rowDone ? ' is-done' : ''}${setting.hidden ? ' is-hidden' : ''}"${weeklyEditing ? ` data-name="${esc(r.name)}"` : ''}>
                        ${weeklyEditing ? orderBtnsHtml(r, idx, total) + tagBtnHtml(r.name, 'weekly') : ''}
                        <span class="sb-mark" aria-hidden="true">${rowDone ? '✓' : ''}</span>
                        <span class="sb-name">${esc(r.name)}</span>
                        <span class="sb-agg-clear">클리어 ${count}</span>
                        ${names}
                        ${extra}
                    </li>`;
            };
            const boxes = worldBoxes(entries, (g) => {
                const { rows } = byWorld.get(g.world) || { rows: [] };
                if (!rows.length) {
                    const loading = g.entries.some((e) => e.st.status === 'loading');
                    return `<p class="empty">${loading ? '불러오는 중…' : '표시할 항목이 없습니다.'}</p>`;
                }
                return `<ul class="sb-agg">${rows.map((r, idx) => rowHtml(g, r, idx, rows.length)).join('')}</ul>`;
            });

            const note = pending ? `<p class="sb-agg-note">불러오는 중인 캐릭터 ${pending}명 (표시가 늘어날 수 있음)</p>` : '';
            const reset = `<span class="sb-reset">초기화 ${Reset.untilText(Reset.nextReset('mon'))}</span>`;
            const editBtn = editBtnHtml('weekly', weeklyEditing);
            const editNote = weeklyEditing
                ? `<p class="sb-agg-note ep-note">
                        ⠿를 끌어 놓거나 ▲▼로 메뉴 순서를 바꾸고, [메인/서브]로 게이지 구분을, 에픽 던전의 표시 여부와 담당 캐릭터를 지정할 수 있습니다. 순서와 메인/서브는 모든 서버에 같이 적용되고, 에픽 던전 설정은 서버별로 저장됩니다.
                        <button type="button" class="ord-reset">순서 초기화</button>
                    </p>`
                : '';
            return `
                <section class="sb-cat panel${weeklyEditing ? ' is-editing' : ''}${foldClass('weekly')}">
                    <div class="sb-cat-head">
                        <h2>주간 컨텐츠 <span class="sb-count">${counted.length ? `${done}/${counted.length}` : ''}</span></h2>
                        <div class="sb-cat-actions">
                            ${reset}
                            ${editBtn}
                            ${foldBtnHtml('weekly')}
                        </div>
                    </div>
                    ${gauges}
                    ${editNote}
                    ${boxes}
                    ${note}
                </section>`;
        }

        // ── 맨 위 요약: 주간 컨텐츠 / 보스 / 일일 컨텐츠 게이지만 표시 ──
        // 각 섹션을 그리면서 summary에 진행도를 기록 → 같은 숫자를 그대로 사용
        let summary = {};

        function summaryHtml() {
            const cards = [
                { key: 'weekly', title: '주간 컨텐츠', reset: 'mon' },
                { key: 'boss', title: '보스', reset: null },
                { key: 'daily', title: '일일 컨텐츠', reset: 'daily' },
            ].map((c) => {
                const gauges = gaugesHtml(summary[c.key]) || '<p class="sum-empty">표시할 항목 없음</p>';
                const reset = c.reset ? `<span class="sb-reset">초기화 ${Reset.untilText(Reset.nextReset(c.reset))}</span>` : '';
                return `
                    <div class="sum-card">
                        <div class="sum-card-head"><strong>${c.title}</strong>${reset}</div>
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
            // 순서: 요약 게이지 → 툴바 → 주간 컨텐츠(전체) → 보스(표) → 일일 컨텐츠(표)
            // 맨 위 요약은 각 섹션이 기록한 진행도를 쓰므로 섹션을 먼저 그린 뒤 앞에 붙임
            const first = entries.find((e) => e.st.status === 'ok');
            summary = {};
            const body = renderToolbar(first ? first.st : entries[0].st)
                + weeklyAllSection(entries)
                + bossMatrix(entries)
                + dailyMatrix(entries);
            container.innerHTML = summaryHtml() + body;
        }

        container.addEventListener('click', (e) => {
            const cell = e.target.closest('.bm-toggle');
            if (cell) {
                toggleCell(cell.dataset.ocid, cell.dataset.col);
                render();
                return;
            }
            const col = e.target.closest('.bm-col-toggle');
            if (col) {
                setColOpen(col.dataset.col, !colOpen(col.dataset.col));
                render();
                return;
            }
            const tagBtn = e.target.closest('.tag-btn');
            if (tagBtn) {
                toggleTag(tagBtn.dataset.name, tagBtn.dataset.kind, tagBtn.dataset.def);
                render();
                return;
            }
            const ord = e.target.closest('.ord-btn');
            if (ord) {
                moveItem(currentWeeklyNames, ord.dataset.name, Number(ord.dataset.move));
                render();
                return;
            }
            if (e.target.closest('.ord-reset')) {
                if (confirm('주간 컨텐츠 메뉴 순서를 처음 상태로 되돌릴까요?')) {
                    Store.remove(ORDER_KEY);
                    render();
                }
                return;
            }
            const foldBtn = e.target.closest('.sb-fold');
            if (foldBtn) {
                toggleFold(foldBtn.dataset.section);
                render();
                return;
            }
            const resetBtn = e.target.closest('.sb-settings-reset');
            if (resetBtn) {
                if (resetSection(resetBtn.dataset.section)) render();
                return;
            }
            const editBtn = e.target.closest('.sb-edit');
            if (editBtn) {
                weeklyEditing = !weeklyEditing;
                render();
                return;
            }
            if (e.target.closest('.sb-refresh')) loadAll();
        });

        container.addEventListener('change', (e) => {
            if (e.target.closest('.sb-only-reg')) {
                Store.save(ONLY_REG_KEY, e.target.checked);
                render();
            }
            if (e.target.closest('.ep-show-input')) {
                setEpicSetting(e.target.dataset.name, { hidden: !e.target.checked });
                render();
            }
            if (e.target.closest('.ep-assign-select')) {
                setEpicSetting(e.target.dataset.name, { ocid: e.target.value });
                render();
            }
        });

        // ── 드래그 앤 드롭 (편집 모드, ⠿ 손잡이를 잡았을 때만 끌 수 있음) ──
        // 마우스 전용: 터치 화면에서는 ▲▼ 버튼 사용
        let dragName = null;

        function clearDropMarks() {
            container.querySelectorAll('.drop-before, .drop-after').forEach((el) => {
                el.classList.remove('drop-before', 'drop-after');
            });
        }

        // 2열에서는 좌우 절반, 1열(좁은 화면)에서는 위아래 절반으로 앞/뒤 판단
        function dropAfter(li, e) {
            const rect = li.getBoundingClientRect();
            const list = li.parentElement.getBoundingClientRect();
            const oneColumn = rect.width > list.width * 0.75;
            return oneColumn ? e.clientY > rect.top + rect.height / 2 : e.clientX > rect.left + rect.width / 2;
        }

        container.addEventListener('mousedown', (e) => {
            const handle = e.target.closest('.ord-handle');
            const li = handle && handle.closest('li[data-name]');
            if (li) li.draggable = true;
        });

        container.addEventListener('dragstart', (e) => {
            const li = e.target.closest && e.target.closest('li[data-name]');
            if (!li || !li.draggable) return;
            dragName = li.dataset.name;
            li.classList.add('is-dragging');
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', dragName); } catch (err) { }
        });

        container.addEventListener('dragover', (e) => {
            if (!dragName) return;
            const li = e.target.closest && e.target.closest('li[data-name]');
            if (!li) return;
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
            clearDropMarks();
            if (li.dataset.name !== dragName) li.classList.add(dropAfter(li, e) ? 'drop-after' : 'drop-before');
        });

        container.addEventListener('drop', (e) => {
            if (!dragName) return;
            const li = e.target.closest && e.target.closest('li[data-name]');
            if (!li) return;
            e.preventDefault();
            const name = dragName;
            dragName = null;
            moveItemTo(currentWeeklyNames, name, li.dataset.name, dropAfter(li, e));
            render();
        });

        container.addEventListener('dragend', (e) => {
            dragName = null;
            clearDropMarks();
            const li = e.target.closest && e.target.closest('li[data-name]');
            if (li) {
                li.draggable = false;
                li.classList.remove('is-dragging');
            }
        });

        Characters.onChange(loadAll);
        ApiKey.onChange(() => { if (ApiKey.has()) loadAll(); });

        // 초기화 남은 시간 갱신 (1분마다, 화면만 다시 그림. 입력·드래그 중에는 건너뜀)
        setInterval(() => {
            if (dragName) return;
            if (!container.contains(document.activeElement)) render();
        }, 60000);

        loadAll();
    }

    window.ScheduleBoard = { mount };
})();
