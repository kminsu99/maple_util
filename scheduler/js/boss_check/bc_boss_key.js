/* ── 보스 체크: 보스 키 · API ↔ 보스컷(환산) 보스 매칭 ──
 * 보스 키 = '이름|난이도' (예: '검은마법사|하드'), 환산 붙여넣기에서 만든 이름 기준
 * 순수 함수만 (상태 없음)
 * 의존: difficulty.js, boss_check/bc_data.js
 */
(function () {
    'use strict';

    const { BOSS_ORDER, BOSS_MAPPING, DIFFICULTY_ORDER } = BcData;

    const noSpace = (s) => String(s || '').replace(/\s/g, '');

    function makeKey(name, difficulty) {
        return name + '|' + difficulty;
    }

    function splitKey(key) {
        const i = key.lastIndexOf('|');
        return { name: key.slice(0, i), difficulty: key.slice(i + 1) };
    }

    // 비교용 난이도 키: 한글·영문, 노멀·노말 모두 같은 값 (js/difficulty.js) / 모르는 값은 공백 제거 소문자
    function diffKey(difficulty) {
        return Difficulty.key(difficulty) || noSpace(difficulty).toLowerCase();
    }

    // 비교용 보스 이름: 공백 제거 + 앞에 붙은 난이도 글자 제거 (예: "하드 스우" → "스우")
    function nameKey(name) {
        const words = String(name || '').trim().split(/\s+/);
        while (words.length > 1 && Difficulty.key(words[0])) words.shift();
        return noSpace(words.join(''));
    }

    // 이름 · 난이도를 비교용으로 맞춘 키
    const matchKey = (name, difficulty) => makeKey(nameKey(name), diffKey(difficulty));
    const matchKeyOf = (key) => {
        const k = splitKey(key);
        return matchKey(k.name, k.difficulty);
    };

    // 매핑표: { 비교용 API 키: 보스컷 키 또는 null(보스컷에 없는 보스) }
    const BOSS_MAP = new Map(BOSS_MAPPING.map(([apiName, apiDiff, cutName, cutDiff]) =>
        [matchKey(apiName, apiDiff), cutName ? makeKey(cutName, cutDiff) : null]));

    // API 이름 → 보스컷 이름 (예: 선택받은 세렌 → 세렌), 매핑표에 없으면 null
    const CUT_NAME = new Map();
    BOSS_MAPPING.forEach(([apiName, , cutName]) => {
        if (cutName && !CUT_NAME.has(nameKey(apiName))) CUT_NAME.set(nameKey(apiName), nameKey(cutName));
    });

    // API 보스 → 보스컷 키 (배율 기본값을 가져올 행), 못 찾으면 null
    //  1) 매핑표: API 이름·난이도로 찾은 보스컷 보스가 bosses에 있으면 그것 (매핑표에 null이면 null)
    //  2) 매핑표에 없으면: 난이도가 같고 API 이름에 보스컷 이름이 들어 있는(또는 반대) 것 중 가장 긴 이름
    //     예) API "찬란한 흉성" ↔ "흉성", API "검은 마법사" ↔ "검은마법사"
    function cutKeyOf(bosses, apiBoss) {
        const keys = Object.keys(bosses);
        const apiKey = matchKey(apiBoss.content_name, apiBoss.difficulty);
        if (BOSS_MAP.has(apiKey)) {
            const mapped = BOSS_MAP.get(apiKey);
            if (!mapped) return null;
            const target = matchKeyOf(mapped);
            const found = keys.find((key) => matchKeyOf(key) === target);
            if (found) return found;
        }
        const apiName = nameKey(apiBoss.content_name);
        const diff = diffKey(apiBoss.difficulty);
        const candidates = keys
            .map((key) => ({ key, name: nameKey(splitKey(key).name), diff: diffKey(splitKey(key).difficulty) }))
            .filter((c) => c.diff === diff && c.name && (apiName.includes(c.name) || c.name.includes(apiName)));
        // 같은 길이면 앞의 것 (원래 순서 유지)
        return candidates.reduce((best, c) => (!best || c.name.length > best.name.length ? c : best), null)?.key ?? null;
    }

    function diffRank(difficulty) {
        const i = DIFFICULTY_ORDER.indexOf(difficulty);
        return i < 0 ? DIFFICULTY_ORDER.length : i;
    }

    // 같은 보스의 난이도 목록 (어려운 순): [{ difficulty, key, rate }]
    //  name: 보스컷 이름 또는 API 이름 (API 이름이면 매핑표의 보스컷 이름으로도 찾음)
    function bossDiffs(bosses, name) {
        const n = nameKey(name);
        const alt = CUT_NAME.get(n) || n;
        return Object.entries(bosses)
            .map(([key, b]) => ({ key, ...splitKey(key), rate: b.csvRate }))
            .filter((d) => nameKey(d.name) === n || nameKey(d.name) === alt)
            .map(({ difficulty, key, rate }) => ({ difficulty, key, rate }))
            .sort((a, b) => diffRank(a.difficulty) - diffRank(b.difficulty));
    }

    // 보스 표시 순서 (BOSS_ORDER 위치, 없으면 맨 뒤)
    const ORDER_INDEX = new Map(BOSS_ORDER.map((n, i) => [nameKey(n), i]));
    function orderIndex(name) {
        const i = ORDER_INDEX.get(nameKey(name));
        return i === undefined ? BOSS_ORDER.length : i;
    }

    window.BcBossKey = Object.freeze({
        makeKey, splitKey, diffKey, nameKey, cutKeyOf, bossDiffs, orderIndex,
    });
})();
