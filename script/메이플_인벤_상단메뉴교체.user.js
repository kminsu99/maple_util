// ==UserScript==
// @name         메이플 인벤 상단 메뉴를 메이플 메뉴로 교체
// @namespace    maple_util
// @version      1.0
// @description  #common-headmenu-full 내용을 지우고 #commu-nav(메이플 커뮤니티 메뉴)로 대체
// @match        https://maple.inven.co.kr/*
// @match        https://www.inven.co.kr/board/maple/*
// @grant        GM_addStyle
// @run-at       document-end
// ==/UserScript==

(() => {
  "use strict";

  const head = document.getElementById("common-headmenu-full");
  const nav = document.getElementById("commu-nav");
  if (!head || !nav) return;

  // 상단 메뉴 스타일(.menu-wrap / .main-menu-list / .sub-menu-wrap)을 그대로 쓰도록 구조 변환
  const menuWrap = document.createElement("nav");
  menuWrap.className = "menu-wrap mnav";
  const list = document.createElement("ul");
  list.className = "main-menu-list";
  menuWrap.appendChild(list);

  for (const item of nav.querySelectorAll(":scope > ul > li")) {
    const top = item.querySelector(":scope > a");
    if (!top) continue;
    const li = document.createElement("li");

    const main = document.createElement("a");
    main.className = "main-menu";
    main.href = top.getAttribute("href") || "#";
    main.target = top.target || "_self";
    const title = document.createElement("span");
    title.className = "link-title";
    title.textContent = top.textContent.trim();
    main.appendChild(title);
    li.appendChild(main);

    const subs = item.querySelectorAll(":scope > ol > li > a");
    if (subs.length) {
      main.addEventListener("click", e => { if (main.getAttribute("href") === "#") e.preventDefault(); });
      const wrap = document.createElement("div");
      wrap.className = "sub-menu-wrap";
      const ul = document.createElement("ul");
      ul.className = "sub-menu-list items-row-1";
      for (const s of subs) {
        const sli = document.createElement("li");
        const a = document.createElement("a");
        a.className = "sub-menu";
        a.href = s.href;
        const t = document.createElement("span");
        t.className = "link-title";
        t.textContent = s.textContent.trim();
        a.appendChild(t);
        sli.appendChild(a);
        ul.appendChild(sli);
      }
      wrap.appendChild(ul);
      li.appendChild(wrap);
    }
    list.appendChild(li);
  }

  // 원래 nav의 배경/글자색 (제거 전에 읽어둠)
  const navStyle = getComputedStyle(nav);
  const navBg = navStyle.backgroundColor || "#d6492f";
  const navColor = navStyle.color || "#fff";

  // 기존 내용 삭제 후 교체, 원래 위치의 commu-nav는 제거
  head.replaceChildren(menuWrap);
  nav.remove();

  GM_addStyle(`
    .headmenu-full .header-nav:has(.mnav) { background-color:${navBg}; border-bottom-color:${navBg}; }
    .headmenu-full #common-headmenu-full .mnav .main-menu-list > li .main-menu > .link-title,
    .headmenu-full #common-headmenu-full .mnav .main-menu-list > li:hover .main-menu > .link-title { color:${navColor}; }
    .headmenu-full #common-headmenu-full .mnav .main-menu-list > li:hover .main-menu > .link-title { opacity:.8; }
    .headmenu-full #common-headmenu-full .mnav .main-menu::after { filter:brightness(0) invert(1); }
    .headmenu-full #common-headmenu-full::before { display:none; }
    .headmenu-full #common-headmenu-full .mnav .sub-menu-wrap:has(.items-row-1) { width:auto; }
    .headmenu-full #common-headmenu-full .mnav .sub-menu-wrap:has(.items-row-1) .items-row-1 li { width:auto; min-width:140px; }
    .headmenu-full #common-headmenu-full .mnav .main-menu-list > li:hover > .sub-menu-wrap { display:flex; }
    .headmenu-full #common-headmenu-full .mnav .main-menu-list > li:hover > .sub-menu-wrap::before {
      content:""; position:absolute; top:-8px; left:0; width:100%; height:8px;
    }
  `);
})();
