// ==UserScript==
// @name         인벤 추천탭 링크 전부 열기
// @match        https://maple.inven.co.kr/*
// @match        https://www.inven.co.kr/board/*
// @grant        GM_openInTab
// @grant        GM_getValue
// @grant        GM_setValue
// ==/UserScript==

(() => {
  // 글 주소 정규화: /board/maple/5974/7430363 (쿼리 무시)
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
    .oa-bar { display:inline-flex; align-items:center; gap:4px; margin-left:10px; vertical-align:middle; }
    button.oa-btn {
      all:unset; box-sizing:border-box; display:inline-flex; align-items:center; justify-content:center;
      height:22px; padding:0 10px; border:1px solid #d5dae1; border-radius:11px;
      background:#fff; color:#4a5260; font-family:inherit; font-size:11px; font-weight:500; line-height:1;
      cursor:pointer; white-space:nowrap;
      box-shadow:0 1px 2px rgba(0,0,0,.06); transition:background .15s, border-color .15s, color .15s, transform .1s;
    }
    button.oa-btn > span { display:inline-block; line-height:1; }
    button.oa-btn:hover { background:#f3f6fa; border-color:#b9c2ce; color:#1f2630; }
    button.oa-btn:active { transform:translateY(1px); }
    button.oa-btn:focus-visible { outline:2px solid #4c8bf5; outline-offset:1px; }
    button.oa-btn.oa-primary { background:#ff7a1a; border-color:#ff7a1a; color:#fff; }
    button.oa-btn.oa-primary:hover { background:#f06a08; border-color:#f06a08; color:#fff; }
    button.oa-btn.oa-icon { width:24px; height:24px; padding:0; border-radius:50%; font-size:15px; }
    button.oa-btn.oa-icon.oa-spin > span { animation:oa-rot .7s linear infinite; }
    button.oa-btn.oa-mini {
      width:16px; height:16px; padding:0; margin-left:3px; border-radius:50%;
      font-size:10px; opacity:.45; box-shadow:none; vertical-align:middle;
    }
    li:hover > button.oa-btn.oa-mini, button.oa-btn.oa-mini:hover { opacity:1; }
    button.oa-btn.oa-mini:hover { background:#ff7a1a; border-color:#ff7a1a; color:#fff; }
    @keyframes oa-rot { to { transform:rotate(360deg); } }
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

  const linksOf = list => [...list.querySelectorAll('li > a[href]')].map(a => a.href);
  const openAll = urls => {
    const seen = new Set(load());
    const todo = [...new Set(urls)].filter(u => !seen.has(key(u)));
    if (!todo.length) { toast('새 글 없음'); return; }
    todo.forEach(u => GM_openInTab(u, { active: false }));
    markSeen(todo);
    toast(`${todo.length}개 글 열림`);
  };
  const mkBtn = (text, title, fn, cls = '') => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = ('oa-btn ' + cls).trim();
    const s = document.createElement('span');
    s.textContent = text;
    b.appendChild(s);
    b.title = title;
    b.onclick = e => { e.preventDefault(); e.stopPropagation(); fn(b); };
    return b;
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

  const run = () => {
    document.querySelectorAll('article.list-common ul.tab-menu').forEach(menu => {
      if (menu.dataset.openAll) return;
      menu.dataset.openAll = '1';
      const art = menu.closest('article') || menu.parentElement;
      // 클릭 시점 최신 요소 조회
      const getMenu = () => art.querySelector('ul.tab-menu') || menu;
      const getLists = () => [...getMenu().parentElement.querySelectorAll(':scope > div.list-bbs')];
      const curIdx = () => {
        const i = [...getMenu().querySelectorAll('li')].findIndex(li => li.querySelector('p.on'));
        return i >= 0 ? i : getLists().findIndex(l => getComputedStyle(l).display !== 'none');
      };

      menu.querySelectorAll('li').forEach((li, i) => {
        li.appendChild(mkBtn('↗', li.textContent.trim() + ' 안 본 글 열기', () => {
          const l = getLists()[i];
          if (l) openAll(linksOf(l));
        }, 'oa-mini'));
      });

      if (art.querySelector('.oa-bar')) return;
      const bar = document.createElement('div');
      bar.className = 'oa-bar';
      bar.appendChild(mkBtn('전체 탭 열기', '모든 탭 안 본 글 (중복 제거)', () =>
        openAll(getLists().flatMap(linksOf)), 'oa-primary'));
      bar.appendChild(mkBtn('현재 탭', '현재 탭 안 본 글', () => {
        const lists = getLists(), i = curIdx();
        if (i >= 0) openAll(linksOf(lists[i]));
      }));
      // 탭 메뉴 목록만 새로고침
      bar.appendChild(mkBtn('⟳', '탭 목록 새로고침', async btn => {
        if (btn.classList.contains('oa-spin')) return;
        btn.classList.add('oa-spin');
        try {
          const res = await fetch(location.href, { cache: 'no-store', credentials: 'include' });
          const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
          const id = getMenu().id;
          const newMenu = (id && doc.getElementById(id)) || doc.querySelector('article.list-common ul.tab-menu');
          if (!newMenu) return toast('목록 못 찾음');
          const newLists = [...newMenu.parentElement.querySelectorAll(':scope > div.list-bbs')];
          getLists().forEach((l, i) => {
            const src = newLists[i]?.querySelector('ul.list-bbs');
            const dst = l.querySelector('ul.list-bbs');
            if (src && dst) dst.innerHTML = src.innerHTML;
          });
          toast('목록 새로고침 완료');
        } catch (e) { toast('새로고침 실패: ' + e.message); }
        finally { btn.classList.remove('oa-spin'); }
      }, 'oa-icon'));
      const title = art.querySelector('.title .commu-title');
      (title || art).appendChild(bar);
    });
  };
  run();
  new MutationObserver(run).observe(document.body, { childList: true, subtree: true });
})();