/* ── 보스 난이도 배지 ──
 * API의 difficulty 값(한글/영문 모두)을 익스트림·카오스·하드·노멀·이지 이미지(img/difficulty)로 표시
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

    // 난이도 이미지: img/difficulty/영문대문자.png (60×18)
    const IMG_DIR = 'img/difficulty/';

    function badge(value) {
        // 값이 없어도 같은 폭의 빈 자리를 남겨 보스명 위치를 맞춘다
        if (!value) return '<span class="dif-badge dif-none" aria-hidden="true"></span>';
        const k = key(value);
        // 알 수 없는 난이도: 원문 글자 배지
        if (!k) return `<span class="dif-badge" title="${Util.esc(value)}">${Util.esc(value)}</span>`;
        const label = LEVELS[k].label;
        // 이미지가 없으면 글자 배지로 대체
        return `<span class="dif-badge dif-img dif-${k}" title="${label}">`
            + `<img src="${IMG_DIR}${k.toUpperCase()}.png" alt="${label}" onerror="this.parentNode.classList.remove('dif-img');this.replaceWith('${label}')">`
            + `</span>`;
    }

    window.Difficulty = { key, badge };
})();
