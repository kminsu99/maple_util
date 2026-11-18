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

    // 월드(서버) 아이콘: maple_server_icon/서버이름.png
    //  - 챌린저스2·3·4 등은 챌린저스 아이콘 사용
    //  - 아이콘 파일이 없으면 이미지를 제거(이름만 표시)
    const ICON_DIR = 'maple_server_icon/';

    function worldIconSrc(name) {
        const n = String(name || '').trim();
        if (!n) return '';
        const file = /^챌린저스/.test(n) ? '챌린저스' : n;
        return ICON_DIR + encodeURIComponent(file) + '.png';
    }

    function worldIcon(name) {
        const src = worldIconSrc(name);
        return src ? `<img class="world-icon" src="${src}" alt="" aria-hidden="true" onerror="this.remove()">` : '';
    }

    window.Util = { esc, worldColor, worldIcon, worldIconSrc };
})();
