/* ── 캐릭터 등록 UI ──
 * [캐릭터 등록/해제] 버튼(페이지 상단, options.trigger)을 눌렀을 때만 캐릭터 목록을 API로 가져온다.
 * 패널은 처음엔 숨겨져 있고, 버튼을 누르면 나타난다.
 * 서버 선택 → 서버 내 캐릭터(레벨 높은 순)에서 선택 → [완료]를 누르면 ocid 목록 저장
 * [펼치기/접기]로 목록 영역을 열고 닫는다.
 * 의존: util.js, characters.js, api_key.js, css/character_picker.css
 */
(function () {
    const esc = Util.esc;

    const TEMPLATE = `
        <div class="cp-head">
            <h2>캐릭터 등록 <span class="cp-count"></span></h2>
            <div class="cp-actions">
                <button type="button" class="cp-btn cp-btn-ghost cp-fold" aria-expanded="true" hidden>접기</button>
                <button type="button" class="cp-btn cp-done" hidden>완료</button>
            </div>
        </div>
        <p class="cp-msg" role="status" hidden></p>
        <div class="cp-body" hidden>
            <label class="cp-world-label">
                <span>서버</span>
                <img class="world-icon cp-world-icon" alt="" aria-hidden="true" hidden>
                <select class="cp-world"></select>
            </label>
            <ul class="cp-list"></ul>
        </div>`;

    function mount(container, options) {
        if (!container) return;
        const loadBtn = (options && options.trigger) || null;
        container.classList.add('cp', 'panel');
        container.innerHTML = TEMPLATE;

        const $ = (sel) => container.querySelector(sel);
        const countEl = $('.cp-count');
        const foldBtn = $('.cp-fold');
        const doneBtn = $('.cp-done');
        const msg = $('.cp-msg');
        const body = $('.cp-body');
        const worldSel = $('.cp-world');
        const worldIconEl = $('.cp-world-icon');

        // 선택한 서버 아이콘 표시 (파일이 없으면 숨김)
        worldIconEl.addEventListener('error', () => { worldIconEl.hidden = true; });
        worldIconEl.addEventListener('load', () => { worldIconEl.hidden = false; });
        function renderWorldIcon() {
            const src = Util.worldIconSrc(currentWorld);
            if (!src) { worldIconEl.hidden = true; worldIconEl.removeAttribute('src'); return; }
            if (worldIconEl.getAttribute('src') !== src) worldIconEl.setAttribute('src', src);
        }
        const listEl = $('.cp-list');

        let all = null;          // 불러온 전체 목록 (메모리만)
        let draft = new Set();   // 완료 전 선택 상태
        let expanded = false;
        let currentWorld = '';

        function setMsg(text, isError) {
            if (text) container.hidden = false;
            msg.textContent = text || '';
            msg.classList.toggle('is-error', !!isError);
            msg.hidden = !text;
        }

        function isDirty() {
            const saved = Characters.registeredIds();
            return saved.length !== draft.size || saved.some((id) => !draft.has(id));
        }

        function renderHead() {
            const loaded = !!all;
            countEl.textContent = loaded ? `선택 ${draft.size}명` : `등록 ${Characters.registeredIds().length}명`;
            foldBtn.hidden = !loaded;
            doneBtn.hidden = !loaded;
            doneBtn.classList.toggle('is-dirty', loaded && isDirty());
            foldBtn.textContent = expanded ? '접기' : '펼치기';
            foldBtn.setAttribute('aria-expanded', String(expanded));
            body.hidden = !(loaded && expanded);
        }

        function renderWorlds() {
            const worlds = Characters.worlds(all);
            if (!worlds.some((w) => w.name === currentWorld)) {
                // 선택된 캐릭터가 있는 서버를 우선 선택
                const first = all.find((c) => draft.has(c.ocid));
                currentWorld = first ? first.world : ((worlds[0] || {}).name || '');
            }
            worldSel.innerHTML = worlds.map((w) => {
                const picked = all.filter((c) => c.world === w.name && draft.has(c.ocid)).length;
                return `<option value="${esc(w.name)}">${esc(w.name)} (${w.count}${picked ? ` · 선택 ${picked}` : ''})</option>`;
            }).join('');
            worldSel.value = currentWorld;
            renderWorldIcon();
        }

        function renderList() {
            const chars = Characters.inWorld(all, currentWorld);
            if (!chars.length) {
                listEl.innerHTML = '<li class="cp-empty">이 서버에 캐릭터가 없습니다.</li>';
                return;
            }
            listEl.innerHTML = chars.map((c) => {
                const on = draft.has(c.ocid);
                return `
                    <li class="cp-item${on ? ' is-on' : ''}">
                        <span class="cp-lv">Lv.${c.level}</span>
                        <span class="cp-name">${esc(c.name)}</span>
                        <span class="cp-job">${esc(c.job)}</span>
                        <button type="button" class="cp-toggle" data-ocid="${esc(c.ocid)}" aria-pressed="${on}">
                            ${on ? '선택됨' : '선택'}
                        </button>
                    </li>`;
            }).join('');
        }

        function renderAll() {
            renderHead();
            if (all && all.length) {
                renderWorlds();
                renderList();
            }
        }

        // [캐릭터 등록/해제]: 이때만 API 호출
        async function load() {
            if (!ApiKey.has()) { setMsg('먼저 API 키를 저장하세요.', true); return; }
            container.hidden = false;
            if (loadBtn) loadBtn.disabled = true;
            setMsg('캐릭터 목록을 불러오는 중…');
            try {
                const list = await Characters.fetchAll();
                all = list;
                draft = new Set(Characters.registeredIds());
                expanded = true;
                setMsg(list.length ? '' : '계정에 캐릭터가 없습니다.');
                renderAll();
            } catch (e) {
                setMsg(e.message || '목록을 불러오지 못했습니다.', true);
            } finally {
                if (loadBtn) loadBtn.disabled = false;
            }
        }

        if (loadBtn) loadBtn.addEventListener('click', load);

        foldBtn.addEventListener('click', () => {
            expanded = !expanded;
            renderHead();
        });

        // [완료]: 선택한 ocid 저장 → 스케줄 보드가 해당 캐릭터만 불러옴
        doneBtn.addEventListener('click', () => {
            Characters.saveRegisteredIds(Array.from(draft));
            expanded = false;
            setMsg(`등록 완료: ${draft.size}명`);
            renderAll();
        });

        worldSel.addEventListener('change', () => {
            currentWorld = worldSel.value;
            renderWorldIcon();
            renderList();
        });

        listEl.addEventListener('click', (e) => {
            const btn = e.target.closest('.cp-toggle');
            if (!btn) return;
            const id = btn.dataset.ocid;
            if (draft.has(id)) draft.delete(id);
            else draft.add(id);
            renderAll();
        });

        Characters.onChange(renderHead);
        renderHead();
    }

    window.CharacterPicker = { mount };
})();
