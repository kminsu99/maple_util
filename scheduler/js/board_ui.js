/* ── 스케줄 보드: 공용 화면 조각 ──
 * 여러 섹션(주간 컨텐츠·보스·일일 컨텐츠·맨 위 요약)이 같이 쓰는 HTML 조각
 * 모두 "데이터 → HTML 문자열" 함수 (계산·저장은 하지 않음, 접기 상태 저장만 예외)
 * 의존: util.js, store.js, reset.js
 */
(function () {
    const esc = Util.esc;

    // ── 서버(월드) 묶음 ──
    // 같은 서버 캐릭터끼리 묶음 (서버 순서: 가장 높은 레벨 캐릭터가 있는 서버부터)
    // 불러오는 중/오류(서버 미확인)는 맨 뒤
    function groupByWorld(entries) {
        const groups = [];
        entries.forEach((e) => {
            const world = e.st.data ? e.st.data.world_name : '';
            let g = groups.find((x) => x.world === world);
            if (!g) groups.push(g = { world, entries: [] });
            g.entries.push(e);
        });
        return groups.sort((a, b) => (a.world ? 0 : 1) - (b.world ? 0 : 1));
    }

    // 서버별 색 테두리 박스, inner(g): 박스 안 HTML
    // 서버 아이콘은 섹션 위쪽 게이지 박스에만 표시하고 여기서는 이름만
    function worldBoxes(entries, inner) {
        return `<div class="world-boxes">${groupByWorld(entries).map((g) => {
            const color = g.world ? Util.worldColor(g.world) : 'var(--border)';
            return `
                <div class="world-box" style="--world-color:${color}">
                    <div class="world-box-head">
                        <strong>${Util.worldLabel(g.world, g.world ? '' : '월드 확인 중', { noIcon: true })}</strong>
                        <span>${g.entries.length}명</span>
                    </div>
                    ${inner(g)}
                </div>`;
        }).join('')}</div>`;
    }

    // ── 캐릭터 칸 ──
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

    // 완료 체크 항목. badge: 이름 앞 HTML, extra: 맨 뒤 HTML (둘 다 이미 이스케이프된 값)
    function itemHtml(name, sub, done, badge, extra) {
        return `
            <li class="sb-item${done ? ' is-done' : ''}">
                <span class="sb-mark" aria-hidden="true">${done ? '✓' : ''}</span>
                ${badge || ''}
                <span class="sb-name">${esc(name)}</span>
                ${sub ? `<span class="sb-sub">${esc(sub)}</span>` : ''}
                ${extra || ''}
                <span class="sr-only">${done ? '완료' : '미완료'}</span>
            </li>`;
    }

    // ── 게이지 ──
    // 게이지 하나 = [라벨, 클래스, 완료, 전체, extra, opts]
    //  - label: 이미 이스케이프된 값
    //  - extra: 숫자 옆 HTML (예: 보스 D-day)
    //  - opts.name: 툴팁·접근성용 원래 이름
    function gaugeHtml(label, cls, done, total, extra, opts) {
        const o = opts || {};
        const name = esc(o.name || label);
        const pct = total ? Math.round((done / total) * 100) : 0;
        return `
            <div class="wk-gauge ${cls}${total && done >= total ? ' is-complete' : ''}"${o.name ? ` title="${name}"` : ''}>
                <span class="wk-gauge-label">${label}</span>
                <span class="wk-gauge-bar" role="progressbar" aria-label="${name} 진행도" aria-valuemin="0" aria-valuemax="${total}" aria-valuenow="${done}"><i style="width:${pct}%"></i></span>
                <span class="wk-gauge-num"><span class="wk-gauge-count">${done}/${total}</span>${extra || ''}</span>
            </div>`;
    }

    function gaugesHtml(list) {
        return list && list.length
            ? `<div class="wk-gauges">${list.map((g) => gaugeHtml(...g)).join('')}</div>`
            : '';
    }

    // 서버별 게이지 박스: groups = [{ world, account?, list: [게이지...] }] (게이지 없는 서버는 생략)
    //  - account: 계정 공유 박스 (서버 구분 없음, 점선 테두리)
    function worldGaugesHtml(groups) {
        const shown = (groups || []).filter((g) => g.list && g.list.length);
        if (!shown.length) return '';
        return `<div class="gauge-worlds">${shown.map((g) => {
            const color = g.account ? 'var(--accent)' : (g.world ? Util.worldColor(g.world) : 'var(--border)');
            const head = g.account ? Util.worldLabel('', '계정 공유') : Util.worldLabel(g.world, g.world ? '' : '월드 확인 중');
            return `
                <div class="gauge-world${g.account ? ' is-account' : ''}" style="--world-color:${color}">
                    <div class="gauge-world-head">${head}</div>
                    ${gaugesHtml(g.list)}
                </div>`;
        }).join('')}</div>`;
    }

    // ── 섹션 머리 버튼 ──
    function resetHtml(kind) {
        return `<span class="sb-reset">초기화 ${Reset.untilText(Reset.nextReset(kind))}</span>`;
    }

    // 편집 중일 때는 [초기화] 버튼을 함께 표시 (해당 섹션 설정만 초기화)
    function editBtnHtml(section, on) {
        const reset = on
            ? `<button type="button" class="sb-settings-reset" data-section="${section}" title="이 메뉴의 편집 설정만 처음 상태로 되돌립니다">초기화</button>`
            : '';
        return `${reset}<button type="button" class="sb-edit${on ? ' is-on' : ''}" data-section="${section}" aria-pressed="${on}">${on ? '편집 완료' : '편집'}</button>`;
    }

    // ── 섹션 접기/펴기 (접어도 제목과 게이지는 그대로 표시, 상태는 저장) ──
    const FOLD_KEY = 'section_folded';   // { weekly: true, boss: true, daily: true }

    function isFolded(section) {
        const v = Store.load(FOLD_KEY, {});
        return !!(v && v[section]);
    }

    // → 접힌 상태가 되었는지
    function toggleFold(section) {
        const v = Store.load(FOLD_KEY, {}) || {};
        if (v[section]) delete v[section];
        else v[section] = true;
        Store.save(FOLD_KEY, v);
        return !!v[section];
    }

    function foldBtnHtml(section) {
        const folded = isFolded(section);
        return `<button type="button" class="sb-fold" data-section="${section}" aria-expanded="${!folded}" title="${folded ? '펼치기' : '접기'}">${folded ? '펼치기 ▾' : '접기 ▴'}</button>`;
    }

    // 섹션 틀: 제목 + 오른쪽 버튼들 → 게이지(항상 표시) → 접기 버튼 → 본문(접히는 부분)
    //  - title: 제목 HTML, actions: 버튼 HTML, gauges: 게이지 HTML, body: 본문 HTML
    //  - 접기/펼치기 버튼은 실제로 접히는 본문 바로 위에 둔다
    function sectionHtml({ key, title, actions, gauges, body, editing }) {
        return `
            <section class="sb-cat panel${editing ? ' is-editing' : ''}${isFolded(key) ? ' is-folded' : ''}">
                <div class="sb-cat-head">
                    <h2>${title}</h2>
                    <div class="sb-cat-actions">${actions}</div>
                </div>
                ${gauges || ''}
                <div class="sb-fold-row">${foldBtnHtml(key)}</div>
                ${body}
            </section>`;
    }

    window.BoardUI = {
        esc, groupByWorld, worldBoxes, nameCellHtml, statusCellHtml, itemHtml,
        gaugeHtml, gaugesHtml, worldGaugesHtml,
        resetHtml, editBtnHtml, isFolded, toggleFold, sectionHtml,
    };
})();
