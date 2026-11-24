// ==UserScript==
// @name         환산 클리어 시간 추가
// @namespace    maple_util
// @version      2.0
// @description  메이플 스카우터 보스 카드의 % 아래에 예상 클리어 시간을 표시
// @match        https://maplescouter.com/*/result*
// @match        https://maplescouter.com/*/multi-result*
// @grant        GM_getValue
// @grant        GM_setValue
// @grant        GM_addStyle
// @grant        GM_registerMenuCommand
// @run-at       document-idle
// ==/UserScript==

(function () {
    "use strict";
    console.log("[환산시간] 스크립트 실행됨:", location.href);

    // 클리어 시간 = 기준 시간 ÷ (퍼센트 ÷ 100)
    let baselineMinutes = GM_getValue("baselineMinutes", 20);
    // "18.73%" 또는 "[파티] 35%" 형태
    const PERCENT_RE = /^(?:\[[^\]]*\]\s*)?(\d{1,5}(?:\.\d+)?)\s*%$/;
    const SITE_TIME_RE = /적용중인 보스 시간\s*:\s*(\d+(?:\.\d+)?)\s*분/;

    // 사이트의 "적용중인 보스 시간 : N 분"이 있으면 그 값을 우선 사용
    function readSiteMinutes() {
        for (const span of document.querySelectorAll("span")) {
            const m = span.textContent.match(SITE_TIME_RE);
            if (m && parseFloat(m[1]) > 0) return parseFloat(m[1]);
        }
        return null;
    }

    GM_addStyle(`
        /* 배율과 붙여 표시: 카드의 gap-1(4px)을 margin-top:-4px로 상쇄, 여백·구분선 없음 */
        .mst-time { display:block; margin-top:-4px; padding:0;
            font-size:12px; font-weight:600;
            line-height:1.1; text-align:center; white-space:nowrap; color:#7c8594; }
        .mst-time.mst-fast { color:#2e9e5b; }
        .mst-time.mst-slow { color:#d64545; }
    `);

    function formatTime(totalSeconds) {
        const s = Math.round(totalSeconds);
        const h = Math.floor(s / 3600);
        const m = Math.floor((s % 3600) / 60);
        const sec = s % 60;
        if (h > 0) return `${h}시간 ${m}분`;
        return `${m}분 ${String(sec).padStart(2, "0")}초`;
    }

    // 보스 카드(이미지가 있는 상자) 안의 %만 처리
    function isInsideCard(el) {
        let node = el.parentElement;
        for (let i = 0; i < 5 && node; i++) {
            if (node.querySelector("img")) return true;
            node = node.parentElement;
        }
        return false;
    }

    function process() {
        const PAGE_RE = /^\/[a-z]{2}\/(result|multi-result)\/?$/;
        if (!PAGE_RE.test(location.pathname)) return;
        const siteMinutes = readSiteMinutes();
        if (siteMinutes) baselineMinutes = siteMinutes;

        document.body.querySelectorAll("*").forEach((el) => {
            if (el.children.length > 0 || el.classList.contains("mst-time")) return;
            const match = el.textContent.trim().match(PERCENT_RE);
            if (!match) return;

            const pct = parseFloat(match[1]);
            if (!(pct > 0) || !isInsideCard(el)) return;

            const key = `${pct}|${baselineMinutes}`;
            let box = el.nextElementSibling;
            if (box && box.classList.contains("mst-time")) {
                if (box.dataset.key === key) return;
            } else {
                box = document.createElement("div");
                box.className = "mst-time";
                el.insertAdjacentElement("afterend", box);
            }

            const seconds = (baselineMinutes * 60) / (pct / 100);
            box.dataset.key = key;
            box.textContent = `⏱ ${formatTime(seconds)}`;
            box.classList.toggle("mst-fast", seconds <= baselineMinutes * 60);
            box.classList.toggle("mst-slow", seconds > baselineMinutes * 60 * 3);
        });
    }

    // Tampermonkey 메뉴에서 기준 시간(배율 기준) 변경
    GM_registerMenuCommand(`기준 시간 설정 (현재 ${baselineMinutes}분)`, () => {
        const input = prompt("퍼센트가 몇 분 기준인지 입력 (기본 20)", baselineMinutes);
        const value = parseFloat(input);
        if (value > 0) {
            baselineMinutes = value;
            GM_setValue("baselineMinutes", value);
            process();
        }
    });

    // requestAnimationFrame은 백그라운드 탭에서 멈추므로 setTimeout 사용
    let scheduled = false;
    function schedule() {
        if (scheduled) return;
        scheduled = true;
        setTimeout(() => {
            scheduled = false;
            process();
        }, 50);
    }

    process();
    new MutationObserver(schedule).observe(document.body, {
        childList: true,
        subtree: true,
        characterData: true,
    });

    // 다른 탭에서 돌아왔을 때 다시 확인
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible") process();
    });
    window.addEventListener("focus", process);
    window.addEventListener("pageshow", process);
})();
