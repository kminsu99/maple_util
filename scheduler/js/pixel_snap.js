/* ── 게이지 막대 기기 픽셀 맞춤 ──
 * 브라우저 확대 비율(devicePixelRatio)이 100%가 아니면 CSS px가 기기 픽셀 정수로 떨어지지 않아
 * 캐릭터 줄마다 막대 y 위치가 소수점만큼 달라지고, 안티앨리어싱으로 막대 두께가 줄마다 달라 보인다.
 * → 줄 높이·줄 간격·막대 높이·테두리를 기기 픽셀 정수 값으로 계산해 CSS 변수로 넣는다.
 *    (CSS 쪽은 var(--g-*, 기본값) 형태라 이 스크립트가 없어도 100% 확대에서는 그대로 동작)
 * 확대 비율이 바뀌면 다시 계산한다. head에서 실행 → 첫 그리기 전에 적용 */
(function () {
    const root = document.documentElement;

    // CSS px 값 → 가장 가까운 기기 픽셀 정수 개수
    function dev(cssPx, dpr) {
        return Math.max(1, Math.round(cssPx * dpr));
    }

    function apply() {
        const dpr = window.devicePixelRatio || 1;
        const px = (d) => (d / dpr) + 'px';
        const bw = dev(1, dpr);            // 막대 테두리
        const bar = dev(10, dpr);          // 대분류 막대 (테두리 포함, border-box)
        const barChild = dev(7, dpr);      // 캐릭터 줄 막대
        const gap = dev(3, dpr);           // 대분류 묶음 안 줄 간격
        let row = dev(19, dpr);            // 캐릭터 줄 높이
        // 막대가 줄 가운데 정렬될 때 위 여백도 정수가 되도록 (줄 - 막대)를 짝수로
        if ((row - barChild) % 2) row += 1;

        root.style.setProperty('--g-bw', px(bw));
        root.style.setProperty('--g-bar', px(bar));
        root.style.setProperty('--g-bar-child', px(barChild));
        root.style.setProperty('--g-gap', px(gap));
        root.style.setProperty('--g-row', px(row));
    }

    // 확대 비율 변경 감지: 현재 비율에 대한 media query가 바뀌면 다시 계산하고 새 비율로 다시 등록
    function watch() {
        const mq = window.matchMedia('(resolution: ' + (window.devicePixelRatio || 1) + 'dppx)');
        mq.addEventListener('change', () => {
            apply();
            watch();
        }, { once: true });
    }

    apply();
    watch();
})();
