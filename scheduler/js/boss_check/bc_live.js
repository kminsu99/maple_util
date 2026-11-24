/* ── 보스 체크: 넥슨 API 보스 스케줄 · 클리어 ──
 * API 키 · 호출은 scheduler.html과 공용 (js/api_key.js, js/nexon_api.js, js/scheduler_state.js)
 *  - 캐릭 찾기: 계정 캐릭터 목록에서 프로파일 이름(또는 처음 불러온 이름)과 같은 캐릭 → ocid 저장
 *  - 인게임 스케줄러에 등록된 월간 · 주간 보스 = 보스 스케줄, complete_flag = 클리어
 *  - 응답은 BcStore API 캐시에 저장, 키가 없거나 호출이 실패하면 저장된 응답으로 표시
 * 의존: api_key.js, nexon_api.js, scheduler_state.js, boss_check/bc_data.js, bc_boss_key.js, bc_store.js
 *
 * const live = BcLive.create({ profiles: () => state.profiles, onUpdate: render, onDone: saveState });
 */
(function () {
    'use strict';

    const { CYCLES } = BcData;
    const K = BcBossKey;

    // 보스 스케줄에 쓰는 필드만 저장
    const slimBoss = (b) => ({
        content_name: b.content_name,
        difficulty: b.difficulty,
        cycle: b.cycle,
        registration_flag: b.registration_flag,
        complete_flag: b.complete_flag,
        list_order_no: b.list_order_no,
    });

    function create(opts) {
        // { [프로파일 이름]: { status: loading | ok | error | nokey, msg, bosses, at, stale? } }
        const live = {};
        const cache = BcStore.loadApiCache();
        let loading = false;
        let lastLoad = 0;

        const saveCache = () => BcStore.saveApiCache(cache);

        // 저장된 응답이 있으면 그것으로 표시 (stale = 실패 이유), 없으면 fail 그대로
        function useCache(p, fail) {
            const c = cache[p.name];
            live[p.name] = c && Array.isArray(c.bosses)
                ? { status: 'ok', bosses: c.bosses, at: c.at, stale: fail.msg || '' }
                : fail;
        }

        const fail = (status, msg) => ({ status, msg, bosses: [] });

        async function loadProfile(p, getChars) {
            live[p.name] = { status: 'loading', bosses: [] };
            try {
                if (!p.ocid) {
                    const c = (await getChars()).find((x) => x.character_name === p.name || x.character_name === p.csvName);
                    if (!c) {
                        useCache(p, fail('error', '계정에서 같은 이름의 캐릭터를 찾지 못했습니다'));
                        return;
                    }
                    p.ocid = c.ocid;
                }
                const data = await SchedulerState.fetch(p.ocid);
                if (Number(data.character_level)) p.level = Number(data.character_level);
                const bosses = (data.boss_contents || []).map(slimBoss);
                const at = Date.now();
                live[p.name] = { status: 'ok', bosses, at };
                cache[p.name] = { bosses, level: p.level, at };
                saveCache();
            } catch (e) {
                if (e && e.status === 400) p.ocid = null; // 잘못된 ocid → 다음에 다시 찾기
                useCache(p, fail('error', (e && e.message) || '불러오지 못했습니다'));
            }
        }

        // 모든 프로파일 조회 (순서대로, 끝날 때마다 onUpdate), 끝나면 onDone (ocid · 레벨 저장)
        async function loadAll() {
            const profiles = Object.values(opts.profiles());
            if (loading || !profiles.length) return;
            if (!ApiKey.has()) {
                profiles.forEach((p) => useCache(p, fail('nokey', 'API 키 없음')));
                opts.onUpdate();
                return;
            }
            loading = true;
            lastLoad = Date.now();
            profiles.forEach((p) => { live[p.name] = { status: 'loading', bosses: [] }; });
            opts.onUpdate();
            let chars = null;
            const getChars = async () => (chars = chars || await NexonApi.characterList());
            try {
                for (const p of profiles) {
                    await loadProfile(p, getChars);
                    opts.onUpdate();
                }
            } finally {
                loading = false;
                opts.onDone();
            }
        }

        // 보스 스케줄 행 목록: 미클리어 → 클리어, 각각 BOSS_ORDER 순 (같으면 인게임 스케줄러 순서)
        function rows(profile) {
            const info = live[profile.name];
            if (!info || info.status !== 'ok') return [];
            const done = (b) => (SchedulerState.flag(b.complete_flag) ? 1 : 0);
            return info.bosses
                .filter((b) => CYCLES.includes(b.cycle) && SchedulerState.flag(b.registration_flag))
                .sort((a, b) => done(a) - done(b)
                    || K.orderIndex(a.content_name) - K.orderIndex(b.content_name)
                    || (Number(a.list_order_no) || 0) - (Number(b.list_order_no) || 0))
                .map((b) => {
                    const csvKey = K.cutKeyOf(profile.bosses, b);
                    return {
                        rowKey: csvKey || `api:${K.nameKey(b.content_name)}|${K.diffKey(b.difficulty)}`,
                        csvKey,
                        name: b.content_name,
                        difficulty: b.difficulty,
                        monthly: b.cycle === 'bossMonthly',
                        done: SchedulerState.flag(b.complete_flag),
                    };
                });
        }

        // 프로파일 이름 변경 · 삭제 · 전체 교체(백업 불러오기)에 맞춰 조회 결과 · 저장된 응답 정리
        function rename(old, next) {
            live[next] = live[old];
            delete live[old];
            if (cache[old]) {
                cache[next] = cache[old];
                delete cache[old];
                saveCache();
            }
        }

        function remove(name) {
            delete live[name];
            if (cache[name]) {
                delete cache[name];
                saveCache();
            }
        }

        function clear() {
            Object.keys(live).forEach((k) => delete live[k]);
        }

        return {
            info: (name) => live[name],
            rows,
            loadAll,
            rename,
            remove,
            clear,
            sinceLastLoad: () => Date.now() - lastLoad,
        };
    }

    window.BcLive = Object.freeze({ create });
})();
