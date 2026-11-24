/* ── 스케줄 보드: 주간 컨텐츠 섹션 ──
 * 서버 박스마다 캐릭터별 주간 컨텐츠를 항목 단위로 합산 (같은 이름은 한 줄)
 * 게이지: 계정 박스(에픽 던전, 전체 서버 주 3회) + 서버 박스마다 항목별 게이지
 * 편집: 서버 박스마다 [편집] 버튼, 서버별로 따로 편집·저장·초기화
 *  - 메뉴 순서: 서버별 (저장: { 서버: [항목 이름...] }), ▲▼ 버튼 또는 ⠿ 끌어 놓기
 *    이전 버전의 서버 공통 순서(배열)는 서버별 순서가 없을 때 기본값으로 사용
 *  - 에픽 던전 표시 여부·담당 캐릭터: 서버별 (저장: { '서버|던전명': { hidden, ocid } })
 *    이전 버전의 { 던전명: {...} } 값은 서버별 값이 없을 때 기본값으로 사용
 * 의존: store.js, scheduler_state.js, board_rules.js, board_ui.js
 */
(function () {
    const { esc } = BoardUI;
    const R = BoardRules;
    const EPIC_KEY = 'epic_settings';
    const ORDER_KEY = 'weekly_order';

    // ── 에픽 던전 설정 ──
    function epicSettings() {
        const v = Store.load(EPIC_KEY, {});
        return v && typeof v === 'object' ? v : {};
    }

    const epicKey = (world, name) => `${world}|${name}`;

    function epicSetting(all, world, name) {
        return Object.assign({}, all[name], all[epicKey(world, name)]);
    }

    // key: epicKey(서버, 던전명)
    function setEpicSetting(key, patch) {
        const all = epicSettings();
        const name = key.slice(key.indexOf('|') + 1);
        all[key] = Object.assign({}, all[name], all[key], patch);
        Store.save(EPIC_KEY, all);
    }

    // ── 메뉴 순서 (서버별) ──
    // 저장값: { 서버: [항목 이름...], '*': 이전 버전의 서버 공통 순서 }
    function orderMap() {
        const v = Store.load(ORDER_KEY, {});
        if (Array.isArray(v)) return { '*': v };
        return v && typeof v === 'object' ? v : {};
    }

    function savedOrder(world) {
        const m = orderMap();
        const v = m[world] || m['*'];
        return Array.isArray(v) ? v : [];
    }

    // 저장된 순서대로 정렬, 저장 순서에 없는 새 항목은 원래 순서대로 뒤에 붙임
    function applyOrder(world, rows) {
        const order = savedOrder(world);
        const pos = (r, i) => {
            const k = order.indexOf(r.name);
            return k >= 0 ? k : order.length + i;
        };
        return rows.map((r, i) => ({ r, p: pos(r, i) })).sort((a, b) => a.p - b.p).map((x) => x.r);
    }

    // 지금 화면에 없는 항목의 기존 순서도 보존해서 저장
    function saveOrder(world, names) {
        const rest = savedOrder(world).filter((n) => !names.includes(n));
        const m = orderMap();
        m[world] = names.concat(rest);
        Store.save(ORDER_KEY, m);
    }

    // names에서 name을 한 칸 이동 (dir: -1 위, +1 아래)
    function moveItem(world, names, name, dir) {
        const i = names.indexOf(name);
        const j = i + dir;
        if (i < 0 || j < 0 || j >= names.length) return;
        const next = names.slice();
        [next[i], next[j]] = [next[j], next[i]];
        saveOrder(world, next);
    }

    // name을 target 앞(after=false) 또는 뒤(after=true)로 이동
    function moveItemTo(world, names, name, target, after) {
        if (name === target) return;
        const next = names.filter((n) => n !== name);
        const t = next.indexOf(target);
        if (t < 0) return;
        next.splice(after ? t + 1 : t, 0, name);
        saveOrder(world, next);
    }

    // 서버 편집 초기화: 이 서버의 메뉴 순서·에픽 던전 설정만 지움
    // (이전 버전의 서버 공통 에픽 설정은 다른 서버에 남기고, 이 서버에서는 기본값으로 덮어씀)
    function resetWorld(world) {
        const orders = orderMap();
        delete orders[world];
        Store.save(ORDER_KEY, orders);
        const all = epicSettings();
        Object.keys(all).forEach((k) => {
            if (k.startsWith(world + '|')) delete all[k];
        });
        Object.keys(all).filter((k) => !k.includes('|')).forEach((k) => {
            all[epicKey(world, k)] = { hidden: false, ocid: '' };
        });
        Store.save(EPIC_KEY, all);
    }

    // ── 행 계산 ──
    // 완료 기준: 월드당 1회 → 한 명이라도 / 월드 공유(에픽 던전 포함) → 이 서버에서 완료 / 에픽 던전 → 한 명이라도 / 그 외 → 등록 캐릭터 모두
    function isRowDone(r) {
        if (r.once) return r.cleared.length > 0;
        if (r.shared) return r.clearedWorlds.length >= r.worlds.length;
        if (r.epic) return r.cleared.length > 0;
        return r.cleared.length >= r.members.length;
    }

    // ctx.visible(items): 등록 필터 적용 (에픽 던전은 필터와 관계없이 모두 포함)
    function create(ctx) {
        const editingWorlds = new Set();   // 편집 중인 서버
        const isEditing = (world) => editingWorlds.has(world);
        const currentNames = new Map();     // 서버 → 화면의 항목 순서 (이동 버튼·드래그 처리용)

        function rowsOf(entries) {
            const rows = [];
            const byKey = new Map();
            entries.forEach(({ st }) => {
                if (st.status !== 'ok') return;
                const d = st.data;
                const list = d.weekly_contents || [];
                const shown = new Set(ctx.visible(list));
                list.filter((it) => shown.has(it) || R.isEpic(it.content_name)).forEach((it) => {
                    const key = String(it.content_name || '').trim();
                    let r = byKey.get(key);
                    if (!r) {
                        r = {
                            name: key,
                            epic: R.isEpic(key),
                            shared: SchedulerState.isWorldShared(key),
                            once: R.isWorldOnce(key),   // 월드당 1회
                            members: [], cleared: [], worlds: [], clearedWorlds: [],
                        };
                        byKey.set(key, r);
                        rows.push(r);
                    }
                    const add = (arr, v) => { if (!arr.includes(v)) arr.push(v); };
                    add(r.members, d.character_name);
                    add(r.worlds, d.world_name);
                    if (SchedulerState.contentDone(it)) {
                        add(r.cleared, d.character_name);
                        add(r.clearedWorlds, d.world_name);
                    }
                });
            });
            return rows;
        }

        // 익몬 진행 횟수: API가 서버 내 모든 캐릭터에 같은 값을 보내므로 서버의 최대값 사용
        //  - quest: quest_state 0 → 0회, 1 → 1회, 2 → 2회 / 횟수형: now_count
        // 익몬 항목이 없으면 null
        function xmparkCount(worldEntries) {
            let found = false;
            let n = 0;
            worldEntries.forEach(({ st }) => {
                if (st.status !== 'ok') return;
                (st.data.weekly_contents || []).filter((it) => R.isXmpark(it.content_name)).forEach((it) => {
                    found = true;
                    const v = it.type === 'quest' ? Number(it.quest_state) || 0 : Number(it.now_count) || 0;
                    n = Math.max(n, v);
                });
            });
            return found ? Math.min(R.XMPARK_LIMIT, n) : null;
        }

        // 서버 박스의 항목별 게이지 (편집의 메뉴 순서대로)
        //  - 일반: 클리어한 캐릭터 수 / 해당 캐릭터 수, 월드 공유: 0/1 또는 1/1
        //  - 익몬: 서버 주 2회 (목록에 없어도 진행 정보가 있으면 맨 뒤에 표시)
        function itemGauges(v) {
            const xm = xmparkCount(v.entries);
            const xmGauge = (name) => [esc(R.shortName(name)), 'is-item is-xmpark', xm, R.XMPARK_LIMIT, '', { name: `${name} (서버 주 ${R.XMPARK_LIMIT}회)` }];
            let xmShown = false;
            const list = v.counted.filter((r) => !r.epic).map((r) => {
                if (R.isXmpark(r.name)) {
                    xmShown = true;
                    return xmGauge(r.name);
                }
                // 월드 공유·월드당 1회: 서버 단위라 캐릭터 줄 없음
                if (r.shared || r.once) return [esc(R.shortName(r.name)), 'is-item', isRowDone(r) ? 1 : 0, 1, '', { name: r.name }];
                const children = r.members.map((n) => [esc(n), 'is-item', r.cleared.includes(n) ? 1 : 0, 1, '', { name: n }]);
                return [esc(R.shortName(r.name)), 'is-item', r.cleared.length, r.members.length, '', { name: r.name, children }];
            });
            if (xm !== null && !xmShown) list.push(xmGauge('익스트림 몬스터파크'));
            return list;
        }

        // → { worlds: Map(서버 → { all, rows, counted, entries }), settings, counted, done, pending, gauges }
        //  - all: 전체 행, rows: 화면에 보일 행 (편집 중에는 숨긴 에픽 던전 포함), counted: 진행도에 셀 행
        function compute(entries) {
            const settings = epicSettings();
            const isHidden = (world, r) => r.epic && !!epicSetting(settings, world, r.name).hidden;

            const worlds = new Map();
            currentNames.clear();
            BoardUI.groupByWorld(entries).forEach((g) => {
                const all = applyOrder(g.world, rowsOf(g.entries)).map((r) => Object.assign(r, { key: epicKey(g.world, r.name) }));
                const rows = isEditing(g.world) ? all : all.filter((r) => !isHidden(g.world, r));
                worlds.set(g.world, { all, rows, counted: rows.filter((r) => !isHidden(g.world, r)), entries: g.entries, xm: xmparkCount(g.entries) });
                currentNames.set(g.world, rows.map((r) => r.name));
            });
            const values = Array.from(worlds.values());
            const counted = [].concat(...values.map((v) => v.counted));

            // 에픽 던전: 계정 공유 → 모든 서버의 클리어한 던전 수 (최대 3)
            const epics = [].concat(...values.map((v) => v.all.filter((r) => r.epic)));
            const epicGauge = epics.length
                ? [{ account: true, kind: 'weekly', list: [['에픽던전', 'is-epic', Math.min(R.EPIC_LIMIT, epics.filter(isRowDone).length), R.EPIC_LIMIT, '', { name: `에픽 던전 (계정 공유, 전체 서버 주 ${R.EPIC_LIMIT}회)` }]] }]
                : [];
            const gauges = epicGauge.concat(Array.from(worlds.entries()).map(([world, v]) => ({ world, kind: 'weekly', list: itemGauges(v) })));

            return {
                worlds, settings, counted,
                done: counted.filter(isRowDone).length,
                pending: entries.filter((e) => e.st.status === 'loading').length,
                gauges,
            };
        }

        // ── 그리기 ──
        function orderBtnsHtml(world, r, i, total) {
            const attrs = `data-world="${esc(world)}" data-name="${esc(r.name)}"`;
            return `
                <span class="ord-btns">
                    <span class="ord-handle" title="끌어서 순서 변경" aria-hidden="true">⠿</span>
                    <button type="button" class="ord-btn" data-move="-1" ${attrs}${i === 0 ? ' disabled' : ''} aria-label="${esc(r.name)} 위로">▲</button>
                    <button type="button" class="ord-btn" data-move="1" ${attrs}${i === total - 1 ? ' disabled' : ''} aria-label="${esc(r.name)} 아래로">▼</button>
                </span>`;
        }

        // 에픽 던전 편집: 표시 여부 + 담당 캐릭터 (이 서버 캐릭터 중에서)
        function epicEditHtml(r, setting, worldEntries) {
            const options = worldEntries.filter((e) => e.st.status === 'ok').map(({ id, st }) =>
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

        // 담당 캐릭터 태그
        function epicOwnerHtml(setting, entries) {
            if (!setting.ocid) return '';
            const e = entries.find((x) => x.id === setting.ocid);
            const name = e && e.st.data ? e.st.data.character_name : (e ? '불러오는 중…' : '등록 해제된 캐릭터');
            return `<span class="ep-owner" title="담당 캐릭터">${esc(name)}</span>`;
        }

        // 항목 이름: 줄임말로 표시, 원래 이름은 마우스를 올리면 표시
        const nameHtml = (name) => {
            const short = R.shortName(name);
            return short === name
                ? `<span class="sb-name">${esc(name)}</span>`
                : `<span class="sb-name" title="${esc(name)}">${esc(short)}</span>`;
        };
        const namesHtml = (list) => (list.length ? `<span class="sb-agg-names">${list}</span>` : '');
        // 월드당 1회 항목은 0/1·1/1, 그 외는 클리어한 캐릭터 수 / 등록 캐릭터 수
        const countHtml = (r) => `<span class="sb-agg-count">${r.once ? `${isRowDone(r) ? 1 : 0}/1` : `${r.cleared.length}/${r.members.length}`}</span>`;

        function rowHtml(model, entries, g, r, idx, total) {
            const setting = r.epic ? epicSetting(model.settings, g.world, r.name) : {};
            // 익몬: 서버 주 2회 → 진행 횟수 n/2, 2회면 완료
            const xm = R.isXmpark(r.name) ? ((model.worlds.get(g.world) || {}).xm || 0) : null;
            const rowDone = xm !== null ? xm >= R.XMPARK_LIMIT : isRowDone(r);
            let count = '';
            let names = '';
            if (xm !== null) {
                count = `<span class="sb-agg-count">${xm}/${R.XMPARK_LIMIT}</span>`;
            } else if (r.shared) {
                // 월드 공유(에픽 던전): 캐릭터별 구분이 안 되므로 완료 표시(✓)만
            } else if (/무릉/.test(r.name)) {
                // 무릉도장: 등록 캐릭터 모두 표시, 클리어한 캐릭터는 초록
                count = countHtml(r);
                names = namesHtml(r.members.map((n) => `<span class="${r.cleared.includes(n) ? 'sb-agg-name' : 'sb-agg-member'}">${esc(n)}</span>`).join(''));
            } else {
                if (!r.epic) count = countHtml(r);
                names = namesHtml(r.cleared.map((n) => `<span class="sb-agg-name">${esc(n)}</span>`).join(''));
            }
            // 담당 캐릭터: 다른 서버 캐릭터로 지정돼 있으면 이 서버에서는 지정 없음으로 취급
            const owned = setting.ocid && entries.some((x) => x.id === setting.ocid) && !g.entries.some((x) => x.id === setting.ocid)
                ? {} : setting;
            const editing = isEditing(g.world);
            const extra = r.epic
                ? (editing ? epicEditHtml(r, owned, g.entries) : epicOwnerHtml(owned, entries))
                : '';
            return `
                <li class="sb-agg-item${rowDone ? ' is-done' : ''}${setting.hidden ? ' is-hidden' : ''}"${editing ? ` data-world="${esc(g.world)}" data-name="${esc(r.name)}"` : ''}>
                    ${editing ? orderBtnsHtml(g.world, r, idx, total) : ''}
                    <span class="sb-mark" aria-hidden="true">${rowDone ? '✓' : ''}</span>
                    ${nameHtml(r.name)}
                    <span class="sb-agg-clear">클리어 ${count}</span>
                    ${names}
                    ${extra}
                </li>`;
        }

        // 서버 박스 머리 버튼: 편집 중이면 [초기화][편집 완료], 아니면 [편집] (서버 확인 전에는 없음)
        function worldActionsHtml(g) {
            if (!g.world) return '';
            const on = isEditing(g.world);
            const w = esc(g.world);
            const reset = on
                ? `<button type="button" class="sb-settings-reset wk-world-reset" data-world="${w}" title="이 서버의 편집 설정(메뉴 순서, 에픽 던전 표시·담당)만 처음 상태로 되돌립니다">초기화</button>`
                : '';
            return `${reset}<button type="button" class="sb-edit wk-world-edit${on ? ' is-on' : ''}" data-world="${w}" aria-pressed="${on}">${on ? '편집 완료' : '편집'}</button>`;
        }

        function html(model, entries) {
            const editNote = `<p class="sb-agg-note ep-note">
                    ⠿를 끌어 놓거나 ▲▼로 메뉴 순서(게이지 순서)를 바꾸고, 에픽 던전의 표시 여부와 담당 캐릭터를 지정할 수 있습니다. 이 서버에만 적용됩니다.
                </p>`;
            const boxes = BoardUI.worldBoxes(entries, (g) => {
                const { rows } = model.worlds.get(g.world) || { rows: [] };
                if (!rows.length) {
                    const loading = g.entries.some((e) => e.st.status === 'loading');
                    return `<p class="empty">${loading ? '불러오는 중…' : '표시할 항목이 없습니다.'}</p>`;
                }
                return (isEditing(g.world) ? editNote : '')
                    + `<ul class="sb-agg">${rows.map((r, idx) => rowHtml(model, entries, g, r, idx, rows.length)).join('')}</ul>`;
            }, { actions: worldActionsHtml, editing: (g) => isEditing(g.world) });
            const note = model.pending ? `<p class="sb-agg-note">불러오는 중인 캐릭터 ${model.pending}명 (표시가 늘어날 수 있음)</p>` : '';
            return BoardUI.sectionHtml({
                key: 'weekly',
                title: `주간 컨텐츠 <span class="sb-count">${model.counted.length ? `${model.done}/${model.counted.length}` : ''}</span>`,
                actions: BoardUI.resetHtml('mon'),
                gauges: BoardUI.worldGaugesHtml(model.gauges),
                body: `${boxes}${note}`,
            });
        }

        // ── 이벤트 (처리했으면 true → 다시 그림) ──
        function onClick(e) {
            const ord = e.target.closest('.ord-btn');
            if (ord) {
                const w = ord.dataset.world;
                moveItem(w, currentNames.get(w) || [], ord.dataset.name, Number(ord.dataset.move));
                return true;
            }
            const edit = e.target.closest('.wk-world-edit');
            if (edit) {
                const w = edit.dataset.world;
                if (editingWorlds.has(w)) editingWorlds.delete(w);
                else editingWorlds.add(w);
                return true;
            }
            const reset = e.target.closest('.wk-world-reset');
            if (reset) {
                const w = reset.dataset.world;
                if (confirm(`${w} 서버의 주간 컨텐츠 편집 설정(메뉴 순서, 에픽 던전 표시·담당 캐릭터)을 초기화할까요?`)) resetWorld(w);
                return true;   // 취소해도 섹션 [초기화] 처리로 넘어가지 않게
            }
            return false;
        }

        function onChange(e) {
            if (e.target.closest('.ep-show-input')) {
                setEpicSetting(e.target.dataset.name, { hidden: !e.target.checked });
                return true;
            }
            if (e.target.closest('.ep-assign-select')) {
                setEpicSetting(e.target.dataset.name, { ocid: e.target.value });
                return true;
            }
            return false;
        }

        // ── 끌어 놓기 (편집 모드, ⠿ 손잡이를 잡았을 때만) ──
        // 마우스 전용: 터치 화면에서는 ▲▼ 버튼 사용
        let dragName = null;
        let dragWorld = null;   // 같은 서버 안에서만 옮길 수 있음

        function bindDrag(container, render) {
            const itemOf = (e) => e.target.closest && e.target.closest('li[data-name]');

            const clearDropMarks = () => container.querySelectorAll('.drop-before, .drop-after').forEach((el) => {
                el.classList.remove('drop-before', 'drop-after');
            });

            // 2열에서는 좌우 절반, 1열(좁은 화면)에서는 위아래 절반으로 앞/뒤 판단
            const dropAfter = (li, e) => {
                const rect = li.getBoundingClientRect();
                const list = li.parentElement.getBoundingClientRect();
                const oneColumn = rect.width > list.width * 0.75;
                return oneColumn ? e.clientY > rect.top + rect.height / 2 : e.clientX > rect.left + rect.width / 2;
            };

            container.addEventListener('mousedown', (e) => {
                const handle = e.target.closest('.ord-handle');
                const li = handle && handle.closest('li[data-name]');
                if (li) li.draggable = true;
            });

            container.addEventListener('dragstart', (e) => {
                const li = itemOf(e);
                if (!li || !li.draggable) return;
                dragName = li.dataset.name;
                dragWorld = li.dataset.world;
                li.classList.add('is-dragging');
                e.dataTransfer.effectAllowed = 'move';
                try { e.dataTransfer.setData('text/plain', dragName); } catch (err) { /* 일부 브라우저 */ }
            });

            container.addEventListener('dragover', (e) => {
                const li = dragName && itemOf(e);
                if (!li || li.dataset.world !== dragWorld) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                clearDropMarks();
                if (li.dataset.name !== dragName) li.classList.add(dropAfter(li, e) ? 'drop-after' : 'drop-before');
            });

            container.addEventListener('drop', (e) => {
                const li = dragName && itemOf(e);
                if (!li || li.dataset.world !== dragWorld) return;
                e.preventDefault();
                const name = dragName;
                dragName = null;
                moveItemTo(dragWorld, currentNames.get(dragWorld) || [], name, li.dataset.name, dropAfter(li, e));
                render();
            });

            container.addEventListener('dragend', (e) => {
                dragName = null;
                dragWorld = null;
                clearDropMarks();
                const li = itemOf(e);
                if (li) {
                    li.draggable = false;
                    li.classList.remove('is-dragging');
                }
            });
        }

        return {
            compute, html, onClick, onChange, bindDrag,
            isDragging: () => !!dragName,
            // 섹션을 접으면 모든 서버의 편집 종료 (편집 시작은 서버 박스의 [편집]에서만)
            get editing() { return editingWorlds.size > 0; },
            set editing(v) { if (!v) editingWorlds.clear(); },
        };
    }

    window.BoardWeekly = { create };
})();
