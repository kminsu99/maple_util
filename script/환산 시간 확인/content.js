// 보스 카드 안의 "xx.x%"를 찾아서, 그 아래에 예상 클리어 시간을 붙여요.
// 계산: 퍼센트는 "기준 시간(기본 20분) 동안 보스 체력의 몇 %를 깎는지"를 뜻해요.
//       그래서 클리어 시간 = 기준 시간 ÷ (퍼센트 ÷ 100)

let baselineMinutes = 20;
const PERCENT_RE = /^(\d{1,5}(?:\.\d+)?)\s*%$/;

function formatTime(totalSeconds) {
  const s = Math.round(totalSeconds);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}시간 ${m}분`;
  return `${m}분 ${String(sec).padStart(2, "0")}초`;
}

// 보스 카드(이미지가 들어 있는 상자)인지 확인해요. 다른 곳의 % 숫자는 건드리지 않으려는 안전장치예요.
function isInsideCard(el) {
  let node = el.parentElement;
  for (let i = 0; i < 5 && node; i++) {
    if (node.querySelector("img")) return true;
    node = node.parentElement;
  }
  return false;
}

function process() {
  const all = document.body.querySelectorAll("*");
  all.forEach((el) => {
    if (el.children.length > 0) return;              // 맨 안쪽 요소만
    if (el.classList.contains("mst-time")) return;   // 내가 만든 건 제외
    const match = el.textContent.trim().match(PERCENT_RE);
    if (!match) return;

    const pct = parseFloat(match[1]);
    if (!(pct > 0) || !isInsideCard(el)) return;

    const key = `${pct}|${baselineMinutes}`;
    let box = el.nextElementSibling;
    if (box && box.classList.contains("mst-time")) {
      if (box.dataset.key === key) return;           // 이미 최신이에요
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

// 화면이 바뀔 때마다(데이터 로딩, 필터 변경 등) 다시 실행해요.
let scheduled = false;
function schedule() {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    process();
  });
}

chrome.storage.sync.get(["baselineMinutes"], (saved) => {
  if (saved.baselineMinutes > 0) baselineMinutes = saved.baselineMinutes;
  process();
  new MutationObserver(schedule).observe(document.body, {
    childList: true,
    subtree: true,
    characterData: true,
  });
});

// 팝업에서 기준 시간을 바꾸면 바로 반영해요.
chrome.storage.onChanged.addListener((changes) => {
  if (changes.baselineMinutes && changes.baselineMinutes.newValue > 0) {
    baselineMinutes = changes.baselineMinutes.newValue;
    process();
  }
});
