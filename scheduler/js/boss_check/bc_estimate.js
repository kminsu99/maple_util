/* ── 보스 체크: 배율 → 예상시간 계산 · 표기 ──
 * 적용 배율 = 내 배율 + 인원 × 배율 (빈칸은 0)
 * 예상시간 = 기준 시간 ÷ (적용 배율 ÷ 100)  (환산시간.user.js 계산식), MIN_RATE 미만이면 불가
 * 합계(총 예상시간 · 남은 시간)는 시간 직접입력(분)이 있는 행이면 예상시간 대신 그 값
 * 순수 함수만 (상태 없음)
 * 의존: boss_check/bc_data.js, boss_check/bc_store.js
 */
(function () {
    'use strict';

    const { LIMITS } = BcData;

    // 모두 비면 null
    function adjustedRate(myRate, party, rate) {
        const add = (party || 0) * (rate || 0);
        if (myRate == null && !add) return null;
        return (myRate || 0) + add;
    }

    function estimateSeconds(rate, baseMinutes) {
        return (baseMinutes * 60) / (rate / 100);
    }

    function csvRateOf(profile, key) {
        const b = key && profile.bosses[key];
        return b ? b.csvRate : null;
    }

    // 행 설정 (저장된 값이 없으면 기본값)
    function rowConfOf(profile, row) {
        return profile.rows[row.rowKey] || BcStore.normalizeRow(null);
    }

    // 내 배율 키 = 고른 난이도 ?? 행의 보스컷 키
    function myKeyOf(profile, row, conf) {
        return conf.myKey && profile.bosses[conf.myKey] ? conf.myKey : row.csvKey;
    }

    // → { adj: 적용 배율, seconds: 예상 초 (불가면 null) }
    function rowEstimate(profile, row, conf, baseMinutes) {
        const adj = adjustedRate(csvRateOf(profile, myKeyOf(profile, row, conf)), conf.addParty, conf.addRate);
        if (adj == null || adj < LIMITS.MIN_RATE) return { adj, seconds: null };
        return { adj, seconds: estimateSeconds(adj, baseMinutes) };
    }

    // 합계에 쓰는 행 시간(초): 시간 직접입력(분)이 있으면 그 값, 없으면 예상시간 (불가면 null)
    function rowSeconds(profile, row, conf, baseMinutes) {
        if (conf.manualMin) return conf.manualMin * 60;
        return rowEstimate(profile, row, conf, baseMinutes).seconds;
    }

    // 보스 스케줄 행 목록 → { cleared, count, total, remain, impossible } (초 단위, 불가 보스는 합계 제외)
    function stats(profile, rows, baseMinutes) {
        return rows.reduce((s, row) => {
            const seconds = rowSeconds(profile, row, rowConfOf(profile, row), baseMinutes);
            return {
                cleared: s.cleared + (row.done ? 1 : 0),
                count: s.count,
                total: s.total + (seconds || 0),
                remain: s.remain + (seconds != null && !row.done ? seconds : 0),
                impossible: s.impossible + (seconds == null ? 1 : 0),
            };
        }, { cleared: 0, count: rows.length, total: 0, remain: 0, impossible: 0 });
    }

    // 환산시간.user.js와 같은 표기: "1시간 40분" / "55분 33초"
    function formatTime(totalSeconds) {
        const s = Math.round(totalSeconds);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (h > 0) return `${h}시간 ${m}분`;
        return `${m}분 ${String(sec).padStart(2, '0')}초`;
    }

    // 소수 둘째 자리까지, 끝의 0은 생략 (12.5 → "12.5"), 없으면 '-'
    function fmtRate(value) {
        if (value == null) return '-';
        return String(Math.round(value * 100) / 100);
    }

    // 소수 둘째 자리까지 항상 (10.2 → "10.20"), 없으면 '-'
    function fmtRate2(rate) {
        return Number.isFinite(rate) ? rate.toFixed(2) : '-';
    }

    window.BcEstimate = Object.freeze({
        csvRateOf, rowConfOf, myKeyOf, rowEstimate, stats, formatTime, fmtRate, fmtRate2,
    });
})();
