/* ── 보스 체크: 환산 붙여넣기 읽기 ──
 * 환산 효율·보스컷 페이지 [전체 보기]에서 Ctrl+A → Ctrl+C 한 텍스트 (data/copy_%_smaple.txt)
 *  - 캐릭: "Lv.295 뇌사린/렌" 줄 → 레벨 / 이름 / 직업
 *  - 보스: "boss" 줄마다 1개, 그 뒤 첫 "xx%" 또는 "[파티] xx%" 줄이 배율
 *  - n번째 boss = SCOUTER_ORDER n번째 보스 (보스 이름은 텍스트에 없음)
 * 의존: boss_check/bc_data.js, boss_check/bc_boss_key.js
 */
(function () {
    'use strict';

    const { SCOUTER_ORDER } = BcData;
    const BOSS_LINE = 'boss';
    const CHAR_LINE = /^Lv\.(\d+)\s+(.+?)\/(.*)$/;
    const RATE_LINE = /^(?:\[파티\]\s*)?([\d,.]+)\s*%$/;

    function parseCharacter(lines) {
        for (const line of lines) {
            const m = line.match(CHAR_LINE);
            if (m) return { level: Number(m[1]), name: m[2].trim(), job: m[3].trim() };
        }
        return { level: null, name: '', job: '' };
    }

    // boss 줄마다 그다음 boss 줄 전까지의 첫 배율 (없으면 null)
    function parseRates(lines) {
        return lines.reduce((rates, line, i) => {
            if (line !== BOSS_LINE) return rates;
            let rate = null;
            for (let j = i + 1; j < lines.length && lines[j] !== BOSS_LINE; j++) {
                const m = lines[j].match(RATE_LINE);
                if (m) {
                    rate = parseFloat(m[1].replace(/,/g, ''));
                    break;
                }
            }
            rates.push(rate);
            return rates;
        }, []);
    }

    // → { info: { level, name, job }, bosses: { '이름|난이도': { csvRate } } }
    //  보스 목록이 없거나 수가 순서표와 다르면 Error
    function parse(text) {
        const lines = String(text || '').split(/\r?\n/).map((l) => l.trim());
        const rates = parseRates(lines);
        if (!rates.length) throw new Error('보스 목록을 찾지 못했습니다. 효율·보스컷 [전체 보기] 화면에서 복사하세요.');
        if (rates.length !== SCOUTER_ORDER.length) {
            throw new Error(`보스 수가 순서표와 다릅니다 (붙여넣기 ${rates.length}개, 순서표 ${SCOUTER_ORDER.length}개). [전체 보기]에서 복사했는지 확인하세요.`);
        }
        // 구분(데스티니 · 유챔)이 있는 항목과 배율이 없는 항목은 건너뜀
        const bosses = Object.fromEntries(SCOUTER_ORDER
            .map(([kind, difficulty, name], i) => ({ kind, key: BcBossKey.makeKey(name, difficulty), rate: rates[i] }))
            .filter((b) => !b.kind && b.rate != null)
            .map((b) => [b.key, { csvRate: b.rate }]));
        return { info: parseCharacter(lines), bosses };
    }

    window.BcPaste = Object.freeze({ parse, count: SCOUTER_ORDER.length });
})();
