/* ── 공통 도우미 ── */
(function () {
    // innerHTML에 넣는 문자열 이스케이프
    function esc(s) {
        return String(s).replace(/[&<>"']/g, (ch) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
        }[ch]));
    }

    // 월드(서버) 이름별 고정 색상: 같은 이름은 항상 같은 색
    const WORLD_COLORS = ['#4a9eff', '#f0b429', '#2ecc71', '#e86b2b', '#b28cff', '#ff5c9a', '#4fd2ec', '#e74c3c', '#a3d977', '#d9a066'];

    function worldColor(name) {
        let h = 0;
        for (const ch of String(name || '')) h = (h * 31 + ch.codePointAt(0)) >>> 0;
        return WORLD_COLORS[h % WORLD_COLORS.length];
    }

    // 월드(서버) 아이콘: img/world/서버이름.png
    //  - 챌린저스2·3·4 등은 챌린저스 아이콘 사용
    const ICON_DIR = 'img/world/';

    function worldIconSrc(name) {
        const n = String(name || '').trim();
        if (!n) return '';
        const file = /^챌린저스/.test(n) ? '챌린저스' : n;
        return ICON_DIR + encodeURIComponent(file) + '.png';
    }

    // 서버 라벨: [아이콘 칸][이름 칸] — 두 칸 모두 글자 크기(em) 기준 고정 크기
    //  - 글자 크기만 바뀌면(clamp) 아이콘·이름 칸이 같은 비율로 커지고 줄어듦
    //  - 이름 길이·아이콘 유무와 관계없이 차지하는 너비가 같음
    //  - text: 서버 이름 대신 표시할 글자 (예: '계정 공유'), 이때 아이콘 칸은 비워 둠
    //  - opts.noIcon: 아이콘 칸 없이 이름만 (섹션 안에서 두 번째 이후 표시)
    function worldLabel(name, text, opts) {
        const label = text || name || '';
        const nameHtml = `<span class="world-name" title="${esc(label)}">${esc(label)}</span>`;
        if (opts && opts.noIcon) return `<span class="world-label">${nameHtml}</span>`;
        const src = text ? '' : worldIconSrc(name);
        const img = src
            ? `<img class="world-icon" src="${src}" alt="" aria-hidden="true" onerror="this.style.visibility='hidden'">`
            : '';
        return `<span class="world-label"><span class="world-icon-box">${img}</span>${nameHtml}</span>`;
    }

    window.Util = { esc, worldColor, worldIconSrc, worldLabel };
})();
