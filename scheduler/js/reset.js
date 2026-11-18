/* ── 초기화 주기 계산 (한국 시간 KST 기준) ──
 * periodKey(reset): 현재 주기를 나타내는 문자열. 저장된 값과 다르면 초기화된 것으로 본다.
 * nextReset(reset): 다음 초기화 시각(Date).
 */
(function () {
    const KST_OFFSET = 9 * 60 * 60 * 1000;
    const DAY = 24 * 60 * 60 * 1000;
    const WEEKDAY = { mon: 1, thu: 4 };

    // KST 기준 '오늘 00:00'을 UTC 필드로 표현한 Date (getUTC*로 읽어야 함)
    function kstToday() {
        const k = new Date(Date.now() + KST_OFFSET);
        return new Date(Date.UTC(k.getUTCFullYear(), k.getUTCMonth(), k.getUTCDate()));
    }

    function fmt(d) {
        return d.toISOString().slice(0, 10);
    }

    // 가장 최근의 해당 요일 00:00 (오늘 포함)
    function lastWeekday(today, weekday) {
        const diff = (today.getUTCDay() - weekday + 7) % 7;
        return new Date(today.getTime() - diff * DAY);
    }

    function periodStart(reset) {
        const today = kstToday();
        if (reset === 'daily') return today;
        if (reset in WEEKDAY) return lastWeekday(today, WEEKDAY[reset]);
        if (reset === 'monthly') return new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
        throw new Error('알 수 없는 reset 종류: ' + reset);
    }

    function periodKey(reset) {
        const start = periodStart(reset);
        return reset === 'monthly' ? fmt(start).slice(0, 7) : fmt(start);
    }

    // 실제 시각(Date)으로 반환
    function nextReset(reset) {
        const start = periodStart(reset);
        let next;
        if (reset === 'daily') next = new Date(start.getTime() + DAY);
        else if (reset in WEEKDAY) next = new Date(start.getTime() + 7 * DAY);
        else next = new Date(Date.UTC(start.getUTCFullYear(), start.getUTCMonth() + 1, 1));
        return new Date(next.getTime() - KST_OFFSET);
    }

    // '3일 4시간 후' 형식
    function untilText(date) {
        let ms = Math.max(0, date.getTime() - Date.now());
        const d = Math.floor(ms / DAY); ms -= d * DAY;
        const h = Math.floor(ms / 3600000); ms -= h * 3600000;
        const m = Math.floor(ms / 60000);
        if (d > 0) return `${d}일 ${h}시간 후`;
        if (h > 0) return `${h}시간 ${m}분 후`;
        return `${m}분 후`;
    }

    window.Reset = { periodKey, nextReset, untilText };
})();
