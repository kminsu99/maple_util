/* ── 보스 체크: 저장 데이터 (localStorage, Store 공용 'maple_util_sched_' 접두어) ──
 * state = { version, settings: { baseMinutes }, activeProfile, profiles: { [이름]: profile } }
 * profile = { level, name, job, csvName(처음 불러온 이름), ocid, bosses, rows }
 *  - bosses: { '이름|난이도': { csvRate } }  환산 붙여넣기 배율 (1인 기준)
 *  - rows: { [행 키]: { myKey, addParty, addRate, buff } }  보스 스케줄 행마다 사용자가 바꾼 값
 *    · 행 키 = 보스컷 키, 보스컷에 없는 보스는 'api:' + API 이름|난이도
 *    · myKey: 내 배율로 고른 보스컷 키 (null = 행의 보스컷 키), addParty · addRate: 인원 × 배율 (빈칸·0 = null)
 *  - 클리어 여부는 저장하지 않음 (매번 API에서 가져옴)
 * 의존: store.js, util.js, boss_check/bc_data.js
 */
(function () {
    'use strict';

    const STORE_NAME = 'boss_check';
    const API_CACHE_NAME = 'boss_check_api';        // 마지막 API 응답 (백업 파일에는 넣지 않음)
    const VERSION = 3;
    const { LIMITS } = BcData;

    const isObject = (v) => !!v && typeof v === 'object';

    function defaultState() {
        return {
            version: VERSION,
            settings: { baseMinutes: LIMITS.DEFAULT_BASE_MINUTES },
            activeProfile: null,
            profiles: {},
        };
    }

    // 숫자 입력칸 값: 숫자만, digits자리까지, 빈칸·0은 null
    function positiveDigits(value, digits) {
        const n = Util.digitsInt(value, digits);
        return n > 0 ? n : null;
    }

    // 유챔: 0 이상 정수
    function champDigits(value) {
        return Util.digitsInt(value, LIMITS.CHAMP_DIGITS) || 0;
    }

    function normalizeBuff(b) {
        const x = isObject(b) ? b : {};
        return {
            spread: !!x.spread,
            champ: champDigits(x.champ || 0),
            collector: !!x.collector,
            seiram: !!x.seiram,
        };
    }

    // 이전 값(manualRate · party)은 버림
    function normalizeRow(r) {
        const x = isObject(r) ? r : {};
        return {
            myKey: typeof x.myKey === 'string' && x.myKey ? x.myKey : null,
            addParty: positiveDigits(x.addParty, LIMITS.PARTY_DIGITS),
            addRate: positiveDigits(x.addRate, LIMITS.RATE_DIGITS),
            buff: normalizeBuff(x.buff),
        };
    }

    const mapValues = (obj, fn) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, fn(v)]));

    function normalizeProfile(key, p) {
        // v1/v2 selected[] (직접 고른 보스) → rows
        const legacyRows = (Array.isArray(p.selected) ? p.selected : [])
            .filter((s) => s && s.key)
            .map((s) => [s.key, normalizeRow(s)]);
        return {
            level: Number.isFinite(p.level) ? p.level : null,
            name: key,
            job: p.job || '',
            csvName: p.csvName || key,
            ocid: typeof p.ocid === 'string' && p.ocid ? p.ocid : null,
            bosses: mapValues(p.bosses || {}, (b) => ({ csvRate: b && Number.isFinite(b.csvRate) ? b.csvRate : null })),
            rows: Object.assign(Object.fromEntries(legacyRows), mapValues(p.rows || {}, normalizeRow)),
        };
    }

    // 저장 데이터 · 백업 파일을 현재 구조로 맞춤 (version 올릴 때 이곳에 변환 추가)
    //  - v1/v2 → v3: selected[]의 값을 rows로 옮김, 클리어 비트는 버림 (API로 판단)
    function normalizeState(data) {
        if (!isObject(data)) return defaultState();
        const minutes = parseFloat(data.settings && data.settings.baseMinutes);
        const profiles = Object.fromEntries(Object.entries(isObject(data.profiles) ? data.profiles : {})
            .filter(([, p]) => isObject(p))
            .map(([key, p]) => [key, normalizeProfile(key, p)]));
        const active = data.activeProfile || null;
        return {
            version: VERSION,
            settings: { baseMinutes: minutes > 0 ? minutes : LIMITS.DEFAULT_BASE_MINUTES },
            activeProfile: profiles[active] ? active : Object.keys(profiles)[0] || null,
            profiles,
        };
    }

    function load() {
        return normalizeState(Store.load(STORE_NAME, null));
    }

    // 성공하면 true (저장 공간 부족 · 사생활 보호 모드면 false)
    function save(state) {
        return Store.save(STORE_NAME, state);
    }

    // API 응답 저장: { [프로파일 이름]: { bosses, level, at } }
    const loadApiCache = () => {
        const c = Store.load(API_CACHE_NAME, {});
        return isObject(c) ? c : {};
    };
    const saveApiCache = (cache) => Store.save(API_CACHE_NAME, cache);

    window.BcStore = Object.freeze({
        defaultState, normalizeState, normalizeRow, positiveDigits, champDigits,
        load, save, loadApiCache, saveApiCache,
    });
})();
