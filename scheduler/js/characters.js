/* ── 캐릭터 데이터 ──
 * - fetchAll(): 넥슨 API에서 계정의 전체 캐릭터 목록 조회 ('캐릭터 등록/해제' 버튼에서만 호출, 저장 안 함)
 * - 등록 캐릭터: ocid 목록만 localStorage에 저장 ('완료' 버튼에서 저장)
 * 의존: store.js, nexon_api.js
 */
(function () {
    const REG_KEY = 'registered_ocids';
    const CHANGE_EVENT = 'characterschange';

    function byLevelDesc(a, b) {
        return b.level - a.level || a.name.localeCompare(b.name, 'ko');
    }

    function normalize(c) {
        return {
            ocid: c.ocid,
            name: c.character_name,
            world: c.world_name,
            job: c.character_class,
            level: Number(c.character_level) || 0,
        };
    }

    // ── 전체 캐릭터 목록 (API) ──
    async function fetchAll() {
        const body = await NexonApi.get('/maplestory/v1/character/list');
        const list = [];
        ((body && body.account_list) || []).forEach((acc) => {
            (acc.character_list || []).forEach((c) => list.push(normalize(c)));
        });
        return list.sort(byLevelDesc);
    }

    // 서버 목록: 캐릭터 수 많은 순
    function worlds(list) {
        const count = {};
        list.forEach((c) => { count[c.world] = (count[c.world] || 0) + 1; });
        return Object.keys(count)
            .sort((a, b) => count[b] - count[a] || a.localeCompare(b, 'ko'))
            .map((name) => ({ name, count: count[name] }));
    }

    function inWorld(list, world) {
        return list.filter((c) => c.world === world).sort(byLevelDesc);
    }

    // ── 등록 캐릭터 (ocid 목록) ──
    function registeredIds() {
        const ids = Store.load(REG_KEY, []);
        return Array.isArray(ids) ? ids : [];
    }

    function saveRegisteredIds(ids) {
        Store.save(REG_KEY, Array.from(new Set(ids)));
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT));
    }

    function onChange(callback) {
        window.addEventListener(CHANGE_EVENT, callback);
    }

    // 이전 버전 저장 데이터 정리 (캐릭터 정보/목록 캐시/수동 체크 → ocid만 남김)
    (function migrate() {
        const old = Store.load('characters', null);
        if (Array.isArray(old)) {
            if (!Store.load(REG_KEY, null)) Store.save(REG_KEY, old.map((c) => c.ocid).filter(Boolean));
            Store.remove('characters');
        }
        Store.remove('character_list_cache');
        Store.remove('checks');
        Store.remove('boss_tags'); // 보스 메인/서브 기능 삭제 (이전 저장값 정리)
    })();

    window.Characters = {
        fetchAll, worlds, inWorld,
        registeredIds, saveRegisteredIds, onChange,
    };
})();
