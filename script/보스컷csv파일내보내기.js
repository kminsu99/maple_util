// ==UserScript==
// @name         보스컷 CSV 파일 내보내기
// @namespace    maple_util
// @version      1.0
// @description  메이플 스카우터 환산 주스탯 결과의 보스 카드(보스, 보스배율, 예상시간)를 CSV로 내보내기
// @match        https://maplescouter.com/*/result*
// @match        https://maplescouter.com/*/multi-result*
// @grant        none
// @run-at       document-idle
// ==/UserScript==

(function () {
  "use strict";

  const BTN_ID = "mst-csv-export";
  const PAGE_RE = /^\/[a-z]{2}\/(result|multi-result)\/?$/;
  // "33.13%" 또는 "[파티] 20%" 형태의 배율
  const RATE_RE = /^(?:\[[^\]]*\]\s*)?(\d+(?:\.\d+)?)\s*%$/;
  const SITE_TIME_RE = /적용중인 보스 시간\s*:\s*(\d+(?:\.\d+)?)\s*분/;
  const DEFAULT_MINUTES = 20;

  // 보스 아이콘 id -> 보스 이름 (보스양식.txt + 보스컷rules.txt의 데스티니/유챔 접두어 반영)
  const BOSS_NAMES = {
    hard_jupiter: "하드 유피테르",
    normal_jupiter: "노말 유피테르",
    extreme_bardrix: "익스트림 발드릭스",
    destiny_bardrix: "데스티니 하드 발드릭스",
    hard_bardrix: "하드 발드릭스",
    normal_bardrix: "노말 발드릭스",
    extreme_adversary: "익스트림 대적자",
    destiny_adversary: "하드 대적자",
    hard_adversary: "하드 대적자",
    normal_adversary: "노말 대적자",
    easy_adversary: "이지 대적자",
    extreme_limbo: "익스트림 림보",
    destiny_limbo: "데스티니 하드 림보",
    hard_limbo: "하드 림보",
    normal_limbo: "노말 림보",
    extreme_kaling: "익스트림 카링",
    destiny_kaling: "데스티니 하드 카링",
    hard_kaling: "하드 카링",
    normal_kaling: "노말 카링",
    easy_kaling: "이지 카링",
    extreme_kalos: "익스트림 칼로스",
    destiny_kalos: "카오스 칼로스",
    chaos_kalos: "카오스 칼로스",
    champion_kalos: "유챔 노말 칼로스",
    normal_kalos: "노말 칼로스",
    easy_kalos: "이지 칼로스",
    extreme_lotus: "익스트림 스우",
    champion_lotus: "유챔 하드 스우",
    hard_lotus: "하드 스우",
    normal_lotus: "노말 스우",
    hard_bellona: "하드 벨로나",
    normal_bellona: "노말 벨로나",
    easy_bellona: "이지 벨로나",
    hard_maleficStar: "하드 흉성",
    normal_maleficStar: "노말 흉성",
    extreme_seren: "익스트림 세렌",
    destiny_seren: "데스티니 하드 세렌",
    champion_seren: "유챔 하드 세렌",
    hard_seren: "하드 세렌",
    normal_seren: "노말 세렌",
    extreme_blackMage: "익스트림 검은마법사",
    champion_blackMage: "유챔 하드 검은마법사",
    hard_blackMage: "하드 검은마법사",
    hard_kai: "하드 카이",
    normal_kai: "노말 카이",
    hard_maerin: "하드 메이린",
    normal_maerin: "노말 메이린",
    hard_darknell: "하드 듄켈",
    normal_darknell: "노말 듄켈",
    chaos_gloom: "카오스 더스크",
    normal_gloom: "노말 더스크",
    champion_verusHilla: "유챔 하드 진힐라",
    hard_verusHilla: "하드 진힐라",
    normal_verusHilla: "노말 진힐라",
    hard_will: "하드 윌",
    normal_will: "노말 윌",
    easy_will: "이지 윌",
    chaos_slime: "카오스 슬라임",
    normal_slime: "노말 슬라임",
    hard_lucid: "하드 루시드",
    normal_lucid: "노말 루시드",
    easy_lucid: "이지 루시드",
    hard_damien: "하드 데미안",
    normal_damien: "노말 데미안",
  };

  // 사이트의 "적용중인 보스 시간 : N 분"이 있으면 그 값, 없으면 20분
  function readBaselineMinutes() {
    for (const span of document.querySelectorAll("span")) {
      const m = span.textContent.match(SITE_TIME_RE);
      if (m && parseFloat(m[1]) > 0) return parseFloat(m[1]);
    }
    return DEFAULT_MINUTES;
  }

  // 환산시간.user.js와 같은 표기
  function formatTime(totalSeconds) {
    const s = Math.round(totalSeconds);
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}시간 ${m}분`;
    return `${m}분 ${String(sec).padStart(2, "0")}초`;
  }

  // 보스 카드 목록: div.flex.flex-wrap.gap-1 중 보스 아이콘이 있는 것
  function findCardList() {
    for (const el of document.querySelectorAll("div.flex.flex-wrap.gap-1")) {
      if (el.querySelector('img[src*="/bossIcon/"]')) return el;
    }
    return null;
  }

  function readCard(card, baselineMinutes) {
    const img = card.querySelector('img[src*="/bossIcon/"]');
    if (!img) return null;
    const icon = (img.getAttribute("src").match(/\/bossIcon\/([^/.]+)\./) || [])[1] || "";
    const name = BOSS_NAMES[icon] || icon;

    // 배율: 자식 없는 div 중 % 텍스트 (상태 뱃지, mst-time 제외)
    let rateText = "";
    let rateValue = null;
    for (const el of card.querySelectorAll("div")) {
      if (el.children.length > 0 || el.classList.contains("mst-time")) continue;
      const m = el.textContent.trim().match(RATE_RE);
      if (m) {
        rateText = `${m[1]}%`;
        rateValue = parseFloat(m[1]);
        break;
      }
    }

    // 예상시간: 배율과 data-key가 같은 mst-time(환산시간.user.js) 우선, 없으면 직접 계산
    let time = "";
    if (rateValue > 0) {
      for (const box of card.querySelectorAll(".mst-time[data-key]")) {
        if (parseFloat(box.dataset.key.split("|")[0]) === rateValue) {
          time = box.textContent.replace("⏱", "").trim();
          break;
        }
      }
      if (!time) time = formatTime((baselineMinutes * 60) / (rateValue / 100));
    }
    return [name, rateText, time];
  }

  // h4.text-base의 유저 정보 (예: "295_뇌사린_렌")
  // 텍스트 조각(레벨, 이름, 직업)을 "_"로 연결, "Lv." 접두어와 파일명 금지 문자 제거
  function readUserName() {
    const h4 = document.querySelector("h4.text-base");
    const parts = [];
    if (h4) {
      const walker = document.createTreeWalker(h4, NodeFilter.SHOW_TEXT);
      while (walker.nextNode()) {
        for (const word of walker.currentNode.textContent.split(/\s+/)) {
          const clean = word.replace(/^Lv\.?/i, "").replace(/[\\/:*?"<>|]+/g, "");
          if (clean) parts.push(clean);
        }
      }
    }
    return parts.join("_") || new URLSearchParams(location.search).get("name") || "유저";
  }

  // 선택된 탭: "내 기준보기" -> 요약, "전체 보기" -> 전체
  function readTabLabel() {
    for (const tab of document.querySelectorAll('[role="tab"][aria-selected="true"]')) {
      const text = tab.textContent.replace(/\s+/g, "");
      if (text === "내기준보기") return "요약";
      if (text === "전체보기") return "전체";
    }
    return "";
  }

  function buildFileName() {
    const tab = readTabLabel();
    return [readUserName(), tab, "보스컷"].filter(Boolean).join("_") + ".csv";
  }

  function csvCell(value) {
    const s = String(value);
    return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  }

  function exportCsv() {
    const list = findCardList();
    if (!list) {
      alert("보스 카드 목록을 찾지 못했습니다. 결과가 표시된 뒤 다시 눌러주세요.");
      return;
    }
    const baselineMinutes = readBaselineMinutes();
    const rows = [["보스", "보스배율", "예상시간"]];
    for (const card of list.children) {
      const row = readCard(card, baselineMinutes);
      if (row) rows.push(row);
    }

    // 엑셀 한글 깨짐 방지용 BOM
    const csv = "﻿" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n") + "\r\n";
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = buildFileName();
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  // "기능 안내" 패널 바로 위에 버튼 삽입
  function ensureButton() {
    if (!PAGE_RE.test(location.pathname)) return;
    if (document.getElementById(BTN_ID)) return;

    const title = [...document.querySelectorAll("span")].find(
      (s) => s.textContent.trim() === "기능 안내"
    );
    const panel = title && title.closest("div.rounded-xl");
    if (!panel || !panel.parentElement) return;

    const btn = document.createElement("button");
    btn.id = BTN_ID;
    btn.type = "button";
    btn.textContent = "csv파일 내보내기";
    btn.className =
      "bg-surface-gray-surface-1 outline-outline-gray-med self-stretch rounded-xl outline-1 outline-offset-[-1px]";
    btn.style.cssText =
      "padding:10px 16px; font-size:14px; font-weight:600; cursor:pointer; text-align:center;";
    btn.addEventListener("click", exportCsv);
    panel.insertAdjacentElement("beforebegin", btn);
  }

  let scheduled = false;
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      ensureButton();
    });
  }

  ensureButton();
  new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
})();
