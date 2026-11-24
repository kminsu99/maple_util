/* ── 보스 체크 페이지 진입점: 상태 · 동작 · 이벤트 연결 ──
 * 상태(state)는 이 파일만 바꾸고, 바꾼 뒤에는 commit()(저장 + 다시 그리기)
 * 의존: page_header.js, boss_check/bc_*.js
 */
(function () {
    'use strict';

    const { LIMITS } = BcData;

    let state = BcStore.load();
    // 현재 화면: summary | profile | paste | backup | settings
    let view = state.activeProfile ? 'profile' : 'summary';

    const $menu = document.getElementById('menu');
    const $view = document.getElementById('view');
    const $toast = document.getElementById('toast');
    const $backupInput = document.getElementById('backupInput');

    /* ════════════════ 공통 ════════════════ */

    let toastTimer = null;
    function toast(message) {
        $toast.textContent = message;
        $toast.hidden = false;
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => { $toast.hidden = true; }, 3500);
    }

    // 붙여넣은 원본 텍스트는 저장하지 않고 파싱 결과(state)만 저장
    function saveState() {
        if (!BcStore.save(state)) toast('저장에 실패했습니다 (저장 공간 부족 또는 사생활 보호 모드)');
    }

    const live = BcLive.create({ profiles: () => state.profiles, onUpdate: render, onDone: saveState });

    function render() {
        if (view === 'profile' && !state.profiles[state.activeProfile]) view = 'summary';
        if (!BcView.VIEWS[view]) view = 'summary';
        const ctx = { state, view, live };
        $menu.innerHTML = BcView.menuHtml(ctx);
        $view.innerHTML = BcView.VIEWS[view](ctx);
    }

    function commit() {
        saveState();
        render();
    }

    function showView(next) {
        view = next;
        render();
    }

    function openProfile(name) {
        state.activeProfile = name;
        view = 'profile';
        commit();
        window.scrollTo(0, 0);
    }

    // 버튼 · 입력칸이 속한 프로파일 (data-profile 박스 기준)
    function profileOf(el) {
        const box = el.closest('[data-profile]');
        return box ? state.profiles[box.dataset.profile] || null : null;
    }

    // 행의 { p, row 키, conf(없으면 기본값으로 만들어 둠) }
    function rowCtx(el) {
        const tr = el.closest('tr[data-row]');
        const p = profileOf(el);
        if (!tr || !p) return null;
        const rowKey = tr.dataset.row;
        if (!p.rows[rowKey]) p.rows[rowKey] = BcStore.normalizeRow(null);
        return { p, rowKey, conf: p.rows[rowKey] };
    }

    /* ════════════════ 붙여넣기 불러오기 (병합) ════════════════ */

    // 같은 캐릭: 프로파일 키 또는 처음 불러온 이름(csvName)이 같으면 같은 캐릭으로 봄 (이름 변경 후에도 병합)
    function findProfileKey(name) {
        if (state.profiles[name]) return name;
        return Object.keys(state.profiles).find((k) => state.profiles[k].csvName === name) || null;
    }

    // 병합: 배율 · 레벨 · 직업만 갱신 (내 배율 선택 · 인원 · 도핑 유지)
    function mergeProfile(p, info, bosses) {
        if (info.level != null) p.level = info.level;
        if (info.job) p.job = info.job;
        Object.entries(bosses).forEach(([key, b]) => {
            p.bosses[key] = Object.assign({}, p.bosses[key], { csvRate: b.csvRate });
        });
    }

    const newProfile = (info, bosses) => ({
        level: info.level, name: info.name, job: info.job, csvName: info.name, ocid: null, bosses, rows: {},
    });

    // 성공하면 true
    function importPaste(text) {
        let parsed;
        try {
            parsed = BcPaste.parse(text);
        } catch (e) {
            toast('붙여넣기 실패: ' + e.message);
            return false;
        }
        const { info, bosses } = parsed;
        if (!info.name) {
            const input = prompt('캐릭터 이름을 찾지 못했습니다. 프로파일 이름을 입력하세요.', '');
            if (!input || !input.trim()) return false;
            info.name = input.trim();
        }
        const key = findProfileKey(info.name);
        if (key) {
            mergeProfile(state.profiles[key], info, bosses);
        } else {
            state.profiles[info.name] = newProfile(info, bosses);
        }
        state.activeProfile = key || info.name;
        view = 'profile';
        commit();
        if (!key) live.loadAll(); // 새 프로파일의 보스 스케줄 가져오기
        toast(`붙여넣기: ${state.activeProfile} ${key ? '배율 갱신' : '새 프로파일'} (보스 ${Object.keys(bosses).length}개)`);
        return true;
    }

    /* ════════════════ 프로파일 관리 ════════════════ */

    function renameProfile(p) {
        if (!p) return;
        const input = prompt('새 프로파일 이름', p.name);
        if (input == null) return;
        const next = input.trim();
        if (!next || next === p.name) return;
        if (state.profiles[next]) {
            alert(`'${next}' 프로파일이 이미 있습니다.`);
            return;
        }
        // 탭 순서를 유지하며 키 변경
        const old = p.name;
        p.name = next;
        state.profiles = Object.fromEntries(Object.entries(state.profiles).map(([k, v]) => [k === old ? next : k, v]));
        live.rename(old, next);
        if (state.activeProfile === old) state.activeProfile = next;
        commit();
    }

    function deleteProfile(p) {
        if (!p) return;
        if (!confirm(`'${p.name}' 프로파일을 삭제할까요?\nCSV 배율 · 직접입력 배율 · 인원 · 도핑 설정이 모두 지워지며 되돌릴 수 없습니다.`)) return;
        delete state.profiles[p.name];
        live.remove(p.name);
        if (!state.profiles[state.activeProfile]) state.activeProfile = Object.keys(state.profiles)[0] || null;
        if (!state.activeProfile) view = 'summary';
        commit();
    }

    /* ════════════════ 백업 ════════════════ */

    function exportBackup() {
        Util.downloadText(`boss_check_backup_${Util.dateStamp()}.json`, JSON.stringify(state, null, 2), 'application/json');
    }

    async function importBackup(file) {
        let data;
        try {
            data = JSON.parse((await file.text()).replace(/^﻿/, ''));
        } catch (e) {
            alert('JSON 파일을 읽지 못했습니다.');
            return;
        }
        if (!data || typeof data !== 'object' || typeof data.profiles !== 'object') {
            alert('보스 체크 백업 파일이 아닙니다.');
            return;
        }
        const count = Object.keys(data.profiles || {}).length;
        if (!confirm(`백업 데이터(프로파일 ${count}개)로 현재 데이터를 덮어씁니다.\n현재 데이터는 사라집니다. 계속할까요?`)) return;
        state = BcStore.normalizeState(data);
        live.clear();
        view = state.activeProfile ? 'profile' : 'summary';
        commit();
        toast('백업을 불러왔습니다');
        live.loadAll();
    }

    /* ════════════════ 이벤트 ════════════════ */

    function closeRatePops(except) {
        $view.querySelectorAll('.rate-pop:not([hidden])').forEach((pop) => {
            if (pop === except) return;
            pop.hidden = true;
            const btn = pop.parentNode.querySelector('[data-act="detail"]');
            if (btn) btn.setAttribute('aria-expanded', 'false');
        });
    }

    function toggleRatePop(btn) {
        const pop = btn.parentNode.querySelector('.rate-pop');
        if (!pop) return;
        closeRatePops(pop);
        pop.hidden = !pop.hidden;
        btn.setAttribute('aria-expanded', String(!pop.hidden));
    }

    // 내 배율 난이도 선택: 행의 보스컷 키와 같으면 기본값(null)으로 저장
    function pickMyRate(el) {
        const ctx = rowCtx(el);
        if (!ctx) return;
        const row = live.rows(ctx.p).find((r) => r.rowKey === ctx.rowKey);
        ctx.conf.myKey = row && el.dataset.key === row.csvKey ? null : el.dataset.key;
        commit();
    }

    function importPasteInput() {
        const $in = document.getElementById('pasteInput');
        if ($in && importPaste($in.value)) $in.value = '';
    }

    // 클릭 동작: data-act → (el) => void  (메뉴 · 화면 공용)
    const CLICK = {
        tab: (el) => openProfile(el.dataset.name),
        view: (el) => showView(el.dataset.view),
        rename: (el) => renameProfile(profileOf(el)),
        delete: (el) => deleteProfile(profileOf(el)),
        'backup-export': exportBackup,
        'backup-import': () => $backupInput.click(),
        'paste-import': importPasteInput,
        detail: toggleRatePop,
        'my-pick': pickMyRate,
    };

    // 행 입력칸 변경: data-act → (conf, el) => void, 끝나면 commit
    const ROW_CHANGE = {
        'add-party': (conf, el) => { conf.addParty = BcStore.positiveDigits(el.value, LIMITS.PARTY_DIGITS); },
        'add-rate': (conf, el) => { conf.addRate = BcStore.positiveDigits(el.value, LIMITS.RATE_DIGITS); },
        buff: (conf, el) => { conf.buff[el.dataset.buff] = el.checked; },
        'champ-num': (conf, el) => { conf.buff.champ = BcStore.champDigits(el.value); },
    };

    // 숫자만 입력되는 칸: data-act → 최대 자리수
    const DIGIT_INPUTS = {
        'champ-num': LIMITS.CHAMP_DIGITS,
        'add-party': LIMITS.PARTY_DIGITS,
        'add-rate': LIMITS.RATE_DIGITS,
    };

    function onClick(e) {
        const el = e.target.closest('[data-act]');
        const action = el && CLICK[el.dataset.act];
        if (action) action(el);
    }

    $menu.addEventListener('click', onClick);
    $view.addEventListener('click', onClick);

    $view.addEventListener('change', (e) => {
        const el = e.target;
        const act = el.dataset.act;
        if (act === 'base-minutes') {
            const n = parseFloat(el.value);
            if (n > 0) state.settings.baseMinutes = n;
            commit();
            return;
        }
        const update = ROW_CHANGE[act];
        const ctx = update && rowCtx(el);
        if (!ctx) return;
        update(ctx.conf, el);
        commit();
    });

    // 숫자 칸: 입력 중 숫자 외 글자 · 넘치는 자리 제거
    $view.addEventListener('input', (e) => {
        const el = e.target;
        const max = DIGIT_INPUTS[el.dataset.act];
        if (!max) return;
        const digits = el.value.replace(/\D/g, '').slice(0, max);
        if (digits !== el.value) el.value = digits;
    });

    // 엔터 키로 입력 확정
    $view.addEventListener('keydown', (e) => {
        const act = e.target.dataset.act;
        if (e.key === 'Enter' && (act in DIGIT_INPUTS || act === 'base-minutes')) e.target.blur();
    });

    // 바깥 클릭: 내 배율 목록 닫기
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.rate-pop, [data-act="detail"]')) closeRatePops(null);
    });

    $backupInput.addEventListener('change', () => {
        if ($backupInput.files[0]) importBackup($backupInput.files[0]);
        $backupInput.value = '';
    });

    /* ════════════════ 시작 ════════════════ */

    const REFRESH_MS = 5 * 60 * 1000; // 탭을 다시 볼 때 이 시간이 지났으면 API 다시 조회

    PageHeader.mount();
    ApiKey.onChange(() => live.loadAll()); // 키 저장 · 삭제 시 다시 조회 (키 없으면 저장된 응답 표시)
    render();
    live.loadAll();

    // 탭을 오래 열어 둔 뒤 다시 볼 때 클리어 다시 조회
    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && live.sinceLastLoad() > REFRESH_MS) live.loadAll();
    });
})();
