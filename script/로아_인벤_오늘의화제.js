// ==UserScript==
// @name         로아 인벤 오늘의 화제 현재 탭 열기
// @match        https://lostark.inven.co.kr/
// @match        https://www.inven.co.kr/board/*
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(() => {
    // 글 주소 정규화: /board/webzine/6271/4321468 (쿼리 무시)
    const key = u => {
        try {
            const m = new URL(u, location.href).pathname.match(/^\/board\/[^/]+\/\d+\/\d+/);
            return m ? m[0] : null;
        } catch { return null; }
    };
    const MAX = 5000;
    const load = () => GM_getValue('seen', []);
    const markSeen = urls => {
        const arr = load(), set = new Set(arr);
        urls.map(key).filter(k => k && !set.has(k)).forEach(k => { arr.push(k); set.add(k); });
        GM_setValue('seen', arr.slice(-MAX));
    };

    // 글 페이지 방문 기록
    if (location.hostname === 'www.inven.co.kr') {
        if (key(location.href)) markSeen([location.href]);
        return;
    }

    // 버튼 / 토스트 스타일
    const style = document.createElement('style');
    style.textContent = `
        button.oa-btn {
            all:unset; box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center;
            height:22px; padding:0 10px; margin-right:6px; border:1px solid #ff7a1a; border-radius:11px;
            background:#ff7a1a; color:#fff; font-family:inherit; font-size:11px; font-weight:500; line-height:1;
            cursor:pointer; white-space:nowrap; vertical-align:middle;
            box-shadow:0 1px 2px rgba(0,0,0,.06); transition:background .15s, border-color .15s, transform .1s;
        }
        button.oa-btn > span { display:inline-block; line-height:1; }
        button.oa-btn:hover { background:#f06a08; border-color:#f06a08; }
        button.oa-btn:active { transform:translateY(1px); }
        button.oa-btn:focus-visible { outline:2px solid #4c8bf5; outline-offset:1px; }
        .oa-toast {
            position:fixed; left:50%; bottom:32px; z-index:2147483647; transform:translate(-50%,8px);
            padding:9px 16px; border-radius:8px; background:rgba(30,34,40,.92); color:#fff;
            font:500 13px/1.3 sans-serif; box-shadow:0 4px 14px rgba(0,0,0,.2);
            opacity:0; transition:opacity .2s, transform .2s; pointer-events:none;
        }
        .oa-toast.oa-show { opacity:1; transform:translate(-50%,0); }
    `;
    document.head.appendChild(style);

    let toastEl, toastTimer;
    const toast = msg => {
        if (!toastEl) { toastEl = document.createElement('div'); toastEl.className = 'oa-toast'; document.body.appendChild(toastEl); }
        toastEl.textContent = msg;
        requestAnimationFrame(() => toastEl.classList.add('oa-show'));
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toastEl.classList.remove('oa-show'), 1800);
    };

    const linksOf = root => [...root.querySelectorAll('ul.site-list li > a[href]')].map(a => a.href);
    const openAll = urls => {
        const seen = new Set(load());
        const todo = [...new Set(urls)].filter(u => !seen.has(key(u)));
        if (!todo.length) { toast('새 글 없음'); return; }
        todo.forEach(u => GM_openInTab(u, { active: false }));
        markSeen(todo);
        toast(`${todo.length}개 글 열림`);
    };

    // 탭 번호 -> 사이트가 쓰는 모듈 주소 (탭 내용이 비었을 때 직접 받아옴)
    const moduleUrl = tab => {
        const [board, period] = ({ 0: ['free', 'daily'], 1: ['free', 'weekly'], 2: ['free', 'monthly'], 3: ['class', 'daily'] })[tab] || ['free', 'daily'];
        return `https://lostark.inven.co.kr/best/module/pc/${board}/${period}/14`;
    };

    // 목록에서 직접 클릭한 글도 기록
    document.addEventListener('click', e => {
        const a = e.target.closest?.('a[href]');
        if (a && key(a.href)) markSeen([a.href]);
    }, true);
    document.addEventListener('auxclick', e => {
        const a = e.target.closest?.('a[href]');
        if (a && e.button === 1 && key(a.href)) markSeen([a.href]);
    }, true);

    const add = mod => {
        if (mod.dataset.openAll) return;
        mod.dataset.openAll = '1';
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'oa-btn';
        const s = document.createElement('span');
        s.textContent = '현재 탭 열기';
        b.appendChild(s);
        b.title = '현재 탭 안 본 글 열기';
        b.onclick = async e => {
            e.preventDefault(); e.stopPropagation();
            // 클릭 시점 선택 탭 조회
            const tab = mod.querySelector('ul.data-list li.selected')?.dataset.tab ?? '0';
            const content = mod.querySelector(`.content-wrap .content[data-tab="${tab}"]`);
            if (!content) return toast('탭 못 찾음');
            let urls = linksOf(content);
            if (!urls.length) {
                try {
                    const res = await fetch(moduleUrl(tab), { credentials: 'include' });
                    urls = linksOf(new DOMParser().parseFromString(await res.text(), 'text/html'));
                } catch (err) { return toast('목록 불러오기 실패: ' + err.message); }
            }
            if (!urls.length) return toast('글 없음');
            openAll(urls);
        };
        const wrap = mod.querySelector('.site-issue-top .head .link-wrap');
        if (wrap) wrap.prepend(b);
        else mod.querySelector('.site-issue-top .head')?.appendChild(b);
    };

    const scan = () => document.querySelectorAll('.site-issue-module.top').forEach(add);
    scan();
    new MutationObserver(scan).observe(document.body, { childList: true, subtree: true });
})();
