/* ── 보스 체크: 화면 HTML (데이터 → HTML 문자열, 계산 · 저장 · 이벤트 없음) ──
 * 화면: 메뉴 · 전체 요약 · 프로파일 · 붙여넣기 · 백업 · 설정
 * 보스 스케줄 표: 행을 끌어서 순서 변경 (월간 제외, boss_check.js) / (끌기 아이콘) | (클리어) | 난이도 | 보스 | 내 배율 + 인원 × 배율 = 예상시간 | 도핑메모(뿌리기 | 유챔 | 콜렉터 | 세이람)
 * 의존: util.js, difficulty.js, boss_check/bc_data.js, bc_boss_key.js, bc_estimate.js
 *
 * ctx = { state, view, live }  (live: BcLive.create 결과)
 */
(function () {
    'use strict';

    const esc = Util.esc;
    const { LIMITS, BUFFS, BUFF_DIR } = BcData;
    const E = BcEstimate;
    const badge = (difficulty) => Difficulty.badge(difficulty);
    const join = (list, fn) => list.map(fn).join('');

    /* ── 메뉴: [전체 요약] [프로파일 탭들] ······ [붙여넣기] [백업] [설정] ── */

    function menuHtml(ctx) {
        const { state, view } = ctx;
        const btn = (active, attrs, text, extra) =>
            `<button type="button" class="top-btn${extra || ''}${active ? ' is-active' : ''}" ${attrs}>${text}</button>`;
        const viewBtn = (name, text, extra) => btn(view === name, `data-act="view" data-view="${name}"`, text, extra);
        const tabs = join(Object.keys(state.profiles), (name) =>
            btn(view === 'profile' && name === state.activeProfile, `data-act="tab" data-name="${esc(name)}"`, esc(name)));
        return viewBtn('summary', '전체 요약')
            + `<div class="bc-tabs">${tabs}</div>`
            + '<span class="menu-sep"></span>'
            + viewBtn('paste', '붙여넣기', ' is-primary')
            + viewBtn('backup', '백업')
            + viewBtn('settings', '설정');
    }

    /* ── 프로파일 머리 (캐릭 정보 + 이름 변경 · 삭제) ── */

    function profileHeadHtml(p) {
        return `
            <div class="ph">
                <div class="ph-info">
                    ${p.level != null ? `<span class="ph-level">Lv.${p.level}</span>` : ''}
                    <span class="ph-name">${esc(p.name)}</span>
                    <span class="ph-job">${esc(p.job)}</span>
                </div>
                <div class="ph-actions">
                    <button type="button" class="btn btn-sm" data-act="rename">이름 변경</button>
                    <button type="button" class="btn btn-sm is-danger" data-act="delete">삭제</button>
                </div>
            </div>`;
    }

    /* ── 보스 스케줄 표 ── */

    // 내 배율 목록: 고르면 그 난이도의 배율 사용 (저장)
    function myRatePopHtml(p, row, myKey) {
        const diffs = BcBossKey.bossDiffs(p.bosses, row.csvKey ? BcBossKey.splitKey(row.csvKey).name : row.name);
        const list = diffs.length
            ? `<ul>${join(diffs, (d) => `
                <li class="${d.key === myKey ? 'is-current' : ''}">
                    <button type="button" data-act="my-pick" data-key="${esc(d.key)}">
                        ${badge(d.difficulty)}
                        <span class="pop-rate">${E.fmtRate2(d.rate)}%</span>
                    </button>
                </li>`)}</ul>`
            : '<p class="muted">CSV에서 이 보스를 찾지 못했습니다</p>';
        const unmatched = row.csvKey ? '' : `<p class="muted">CSV와 연결되지 않음 · API 값: ${esc(row.name)} / ${esc(row.difficulty)}</p>`;
        return `
            <div class="rate-pop" hidden>
                <div class="rate-pop-head">${esc(row.name)} 내 배율 선택</div>
                ${list}
                ${unmatched}
            </div>`;
    }

    const digitInput = (cls, act, digits, value, label) =>
        `<input class="${cls}" type="text" inputmode="numeric" maxlength="${digits}" data-act="${act}" value="${value || ''}" aria-label="${label}">`;

    function buffCellsHtml(conf) {
        return join(BUFFS, (f) => (f.kind === 'champ'
            // 유챔: 숫자 직접입력 칸 (0이면 빈칸)
            ? `<td class="col-buff"><input class="champ-input" type="text" inputmode="numeric" maxlength="${LIMITS.CHAMP_DIGITS}" data-act="champ-num"
                value="${conf.buff.champ || ''}" placeholder="0" aria-label="유챔 (숫자 ${LIMITS.CHAMP_DIGITS}자리까지)"></td>`
            : `<td class="col-buff"><input class="buff-check" type="checkbox" data-act="buff" data-buff="${f.id}"
                ${conf.buff[f.id] ? 'checked' : ''} aria-label="${esc(f.label)}"></td>`));
    }

    function buffHeadHtml() {
        return join(BUFFS, (f) => `
            <th class="col-buff">
                <span class="buff-head">
                    <img src="${BUFF_DIR}${esc(f.img)}" alt="" onerror="this.remove()">
                    <span>${esc(f.label)}</span>
                </span>
            </th>`);
    }

    function rowHtml(p, row, baseMinutes) {
        const conf = E.rowConfOf(p, row);
        const myKey = E.myKeyOf(p, row, conf);
        const picked = myKey && myKey !== row.csvKey;
        const est = E.rowEstimate(p, row, conf, baseMinutes);
        const time = est.seconds == null
            ? '<span class="time-impossible">불가</span>'
            : `<span class="time-main">${E.formatTime(est.seconds)}</span>`;
        return `
            <tr data-row="${esc(row.rowKey)}" data-idx="${row.idx}" class="${row.done ? 'is-cleared' : ''}${row.monthly ? '' : ' is-sortable'}"
                ${row.monthly ? '' : 'title="끌어서 순서 변경"'}>
                <td class="col-drag">${row.monthly ? '' : '<span class="drag-icon" aria-hidden="true"></span>'}</td>
                <td class="col-clear">
                    <input class="clear-check" type="checkbox" ${row.done ? 'checked' : ''} disabled tabindex="-1"
                        aria-label="클리어 (API)" title="${row.done ? '클리어' : '미클리어'} (인게임 스케줄러 기준)">
                </td>
                <td class="col-dif">${badge(row.difficulty)}</td>
                <td class="col-boss">
                    <span class="boss-name">${esc(row.name)}</span>${row.monthly ? '<span class="tag-monthly" title="매월 1일 초기화">월간</span>' : ''}
                </td>
                <td class="col-my">
                    <button type="button" class="my-btn${picked ? ' is-picked' : ''}" data-act="detail" aria-expanded="false"
                        title="누르면 난이도별 csv 배율에서 선택">
                        <span class="my-rate"><span class="my-num">${E.fmtRate2(E.csvRateOf(p, myKey))}</span>%</span><span class="caret">▼</span>
                    </button>
                    ${myRatePopHtml(p, row, myKey)}
                </td>
                <td class="col-op" aria-hidden="true">+</td>
                <td class="col-add">
                    <span class="add-box">
                        ${digitInput('add-input is-party', 'add-party', LIMITS.PARTY_DIGITS, conf.addParty, '인원')}
                        <span class="col-op" aria-hidden="true">×</span>
                        ${digitInput('add-input is-rate', 'add-rate', LIMITS.RATE_DIGITS, conf.addRate, '배율')}
                        <span class="unit">%</span>
                    </span>
                </td>
                <td class="col-op" aria-hidden="true">=</td>
                <td class="col-time">${time}<span class="time-sub">적용 ${est.adj == null ? '-' : E.fmtRate(est.adj) + '%'}</span></td>
                ${buffCellsHtml(conf)}
            </tr>`;
    }

    // API 상태별 안내 문구 (표 대신 표시), 표를 그릴 수 있으면 ''
    function liveMessage(info) {
        if (!info || info.status === 'loading') return 'API에서 보스 스케줄을 불러오는 중…';
        if (info.status === 'nokey') return '오른쪽 위 [API 키 등록]에서 넥슨 오픈API 키를 등록하세요.';
        if (info.status === 'error') return `불러오기 실패: ${esc(info.msg || '')}`;
        return '';
    }

    function staleHtml(info) {
        if (!info || info.stale === undefined) return '';
        return `<p class="stale-note">API를 불러오지 못해 저장된 응답(${Util.fmtDateTime(info.at)})을 표시합니다${info.stale ? ` · ${esc(info.stale)}` : ''}</p>`;
    }

    // 보스 스케줄 (제목 + 표): 프로파일 화면 · 전체 요약 공용
    //  표가 있으면 제목 · 합계를 표 맨 윗줄에 (합계 오른쪽 끝 = 예상시간 칸 오른쪽 끝)
    function scheduleHtml(ctx, p) {
        const baseMinutes = ctx.state.settings.baseMinutes;
        const info = ctx.live.info(p.name);
        const rows = ctx.live.rows(p);
        const s = E.stats(p, rows, baseMinutes);
        const msg = liveMessage(info);
        //  below: 제목 줄 아래 (표가 있을 때 순서초기화 버튼)
        const title = (extra, below) => `
            <div class="card-head sub-head">
                <div class="sched-head-left">
                    <div class="sched-head-line">
                        <h2>보스 스케줄</h2>
                        ${msg ? '' : `<span class="counter" title="클리어 / 스케줄 보스">${s.cleared}/${s.count}</span>`}
                    </div>
                    ${below || ''}
                </div>
                ${extra || ''}
            </div>`;

        if (msg || !rows.length) {
            return `
                <div class="sched">
                    ${title()}
                    ${staleHtml(info)}
                    <div class="empty">${msg || '인게임 스케줄러에 등록된 주간 · 월간 보스가 없습니다.'}</div>
                </div>`;
        }
        const resetBtn = '<button type="button" class="btn btn-sm" data-act="order-reset" title="보스 순서를 기본 순서(배율 낮은 순)로 되돌림">순서초기화</button>';
        const totals = `
            <span class="grow"></span>
            <span class="sched-total">
                <span>총 예상시간 <strong>${E.formatTime(s.total)}</strong></span>
                <span><span title="미클리어 보스 합계">남은 시간</span> <strong>${E.formatTime(s.remain)}</strong></span>
            </span>`;
        return `
            <div class="sched">
                ${staleHtml(info)}
                <div class="table-scroll">
                    <table class="boss-table">
                        <thead>
                            <tr class="group-row">
                                <th colspan="9" class="sched-title">${title(totals, resetBtn)}</th>
                                <th colspan="${BUFFS.length}" class="dop-head">도핑메모</th>
                            </tr>
                            <tr>
                                <th class="col-drag"></th><th class="col-clear">클리어</th><th>난이도</th><th>보스</th><th>내 배율</th><th class="col-op"></th><th>인원 × 배율</th><th class="col-op"></th><th>예상시간</th>
                                ${buffHeadHtml()}
                            </tr>
                        </thead>
                        <tbody class="boss-rows">${join(rows, (row) => rowHtml(p, row, baseMinutes))}</tbody>
                    </table>
                </div>
                ${s.impossible ? `<p class="muted" style="margin-top:8px">※ '불가' 보스 ${s.impossible}개는 합계에서 제외</p>` : ''}
            </div>`;
    }

    // 프로파일 박스 (캐릭 정보 · 버튼 · 보스 스케줄)
    function profileBoxHtml(ctx, p) {
        return `
            <section class="bc-card" data-profile="${esc(p.name)}">
                ${profileHeadHtml(p)}
                ${scheduleHtml(ctx, p)}
            </section>`;
    }

    /* ── 화면 ── */

    function summaryHtml(ctx) {
        const profiles = Object.values(ctx.state.profiles);
        if (!profiles.length) {
            return `
                <section class="bc-card">
                    <div class="empty">
                        프로파일이 없습니다.<br>
                        [붙여넣기]에서 환산 효율·보스컷 [전체 보기] 페이지를 전체 복사해 붙여넣으세요.
                    </div>
                </section>`;
        }
        const cards = join(profiles, (p) => {
            const s = E.stats(p, ctx.live.rows(p), ctx.state.settings.baseMinutes);
            const pct = s.count ? Math.round((s.cleared / s.count) * 100) : 0;
            return `
                <button type="button" class="summary-card" data-act="tab" data-name="${esc(p.name)}">
                    <div class="sc-head">
                        ${p.level != null ? `<span class="sc-level">Lv.${p.level}</span>` : ''}
                        <span class="sc-name">${esc(p.name)}</span>
                        <span class="sc-job">${esc(p.job)}</span>
                    </div>
                    <div class="sc-row"><span>클리어</span><strong>${s.cleared}/${s.count}</strong></div>
                    <div class="sc-row"><span>남은 예상시간</span><strong>${s.count ? E.formatTime(s.remain) : '-'}</strong></div>
                    <div class="progress"><span style="width:${pct}%"></span></div>
                </button>`;
        });
        return `
            <section class="bc-card">
                <div class="card-head">
                    <h2>전체 요약</h2><span class="muted">카드를 누르면 해당 프로파일로 이동</span>
                </div>
                <div class="summary-grid">${cards}</div>
            </section>
            ${join(profiles, (p) => profileBoxHtml(ctx, p))}`;
    }

    function profileHtml(ctx) {
        return profileBoxHtml(ctx, ctx.state.profiles[ctx.state.activeProfile]);
    }

    function pasteHtml() {
        return `
            <section class="bc-card">
                <div class="card-head"><h2>붙여넣기</h2></div>
                <p class="set-desc">
                    환산 효율·보스컷 페이지에서 [전체 보기]를 누른 뒤 Ctrl+A → Ctrl+C로 전체 복사해 아래에 붙여넣고 [불러오기]를 누르세요.<br>
                    보스 순서표(${BcPaste.count}개)대로 배율을 읽고, 데스티니 · 유챔 항목은 건너뜁니다. 같은 캐릭터면 배율만 갱신합니다.
                </p>
                <textarea class="paste-input" id="pasteInput" placeholder="여기에 붙여넣기 (Ctrl+V)"></textarea>
                <div class="set-row">
                    <button type="button" class="btn is-primary" data-act="paste-import">불러오기</button>
                </div>
            </section>`;
    }

    function backupHtml() {
        return `
            <section class="bc-card">
                <div class="card-head"><h2>백업</h2></div>
                <div class="set-row">
                    <button type="button" class="btn is-primary" data-act="backup-export">JSON 내보내기</button>
                    <span class="set-desc">모든 프로파일 · CSV 배율 · 직접입력 배율 · 인원 · 도핑 · 설정을 JSON 파일로 내려받습니다.</span>
                </div>
                <div class="set-row">
                    <button type="button" class="btn" data-act="backup-import">JSON 가져오기</button>
                    <span class="set-desc">백업 JSON 파일로 현재 데이터를 덮어씁니다. 덮어쓰기 전에 확인 창이 뜹니다.</span>
                </div>
            </section>`;
    }

    function settingsHtml(ctx) {
        return `
            <section class="bc-card">
                <div class="card-head"><h2>설정</h2></div>
                <div class="set-row">
                    <label>기준 시간 <input class="set-input" type="number" min="1" step="1" data-act="base-minutes" value="${ctx.state.settings.baseMinutes}"> 분</label>
                    <span class="set-desc">배율 100%일 때 걸리는 시간입니다. 예상시간 = 기준 시간 ÷ (적용 배율 ÷ 100)</span>
                </div>
                <div class="set-row">
                    <span class="set-desc">
                        보스 스케줄 · 클리어: 오른쪽 위 넥슨 오픈API 키(스케줄러 페이지와 공용)로 프로파일 이름과 같은 캐릭터를 찾아,
                        인게임 스케줄러에 등록된 월간 · 주간 보스와 클리어 여부를 가져옵니다. 페이지를 열 때마다 새로 가져옵니다.
                    </span>
                </div>
            </section>`;
    }

    // 화면 이름 → HTML (profile은 활성 프로파일이 있을 때만)
    const VIEWS = {
        summary: summaryHtml,
        profile: profileHtml,
        paste: pasteHtml,
        backup: backupHtml,
        settings: settingsHtml,
    };

    window.BcView = Object.freeze({ VIEWS, menuHtml });
})();
