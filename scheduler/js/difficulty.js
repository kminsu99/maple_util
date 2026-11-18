/* ── 보스 난이도 배지 ──
 * API의 difficulty 값(한글/영문 모두)을 익스트림·카오스·하드·노멀·이지 알약 배지로 변환
 * 알 수 없는 값은 원문 그대로 기본 배지로 표시
 * 의존: util.js, css/difficulty_badge.css
 */
(function () {
    const LEVELS = {
        extreme: { label: '익스트림', names: ['익스트림', 'extreme'] },
        chaos: { label: '카오스', names: ['카오스', 'chaos'] },
        hard: { label: '하드', names: ['하드', 'hard'] },
        normal: { label: '노멀', names: ['노멀', '노말', 'normal'] },
        easy: { label: '이지', names: ['이지', 'easy'] },
    };

    function key(value) {
        const v = String(value || '').trim().toLowerCase();
        return Object.keys(LEVELS).find((k) => LEVELS[k].names.includes(v)) || '';
    }

    function badge(value) {
        // 값이 없어도 같은 폭의 빈 자리를 남겨 보스명 위치를 맞춘다
        if (!value) return '<span class="dif-badge dif-none" aria-hidden="true"></span>';
        const k = key(value);
        const label = k ? LEVELS[k].label : Util.esc(value);
        return `<span class="dif-badge${k ? ' dif-' + k : ''}" title="${Util.esc(value)}">${label}</span>`;
    }

    window.Difficulty = { key, badge };
})();
