/* ── 캐릭터 스케줄러 정보 (API) ──
 * GET /maplestory/v1/scheduler/character-state
 * 응답은 저장하지 않고 페이지 메모리에만 둔다.
 * 의존: nexon_api.js
 */
(function () {
    const PATH = '/maplestory/v1/scheduler/character-state';

    function fetchState(ocid) {
        return NexonApi.get(PATH, { ocid });
    }

    // API의 'true'/'false' 문자열과 boolean 모두 처리
    function flag(v) {
        return v === true || String(v).toLowerCase() === 'true';
    }

    // 일일/주간 콘텐츠 완료 여부
    //  - quest: quest_state "2"
    //  - max_count > 0 (횟수형): now >= max   예) 아케인 주간 0/1, 길드 주간 미션 포인트 10/10
    //  - max_count 0 (점수형): now > 0        예) 길드 지하 수로 점수 115351, 에픽 던전 클리어 시 5
    function contentDone(it) {
        if (it.type === 'quest') return String(it.quest_state) === '2';
        const now = Number(it.now_count) || 0;
        const max = Number(it.max_count) || 0;
        return max > 0 ? now >= max : now > 0;
    }

    // 일일/주간 콘텐츠 진행 표시 문자열
    function contentProgress(it) {
        if (it.type === 'quest') {
            return { 0: '', 1: '진행 중', 2: '완료' }[String(it.quest_state)] || '';
        }
        const now = Number(it.now_count) || 0;
        const max = Number(it.max_count) || 0;
        if (max > 0) return `${now}/${max}`;
        // 월드 공유 항목(에픽 던전 등)의 now 값은 점수가 아니므로 표시하지 않음
        return now > 0 && !isWorldShared(it.content_name) ? now.toLocaleString('ko-KR') : '';
    }

    // 보스 cycle 값 → 표시명, 정렬 순서, 초기화 종류(reset.js)
    const BOSS_CYCLE = {
        bossDaily: { title: '일일보스', order: 1, reset: 'daily' },
        bossWeekly: { title: '주간보스', order: 2, reset: 'thu' },
        bossMonthly: { title: '월간보스', order: 3, reset: 'monthly' },
    };

    function bossCycle(cycle) {
        return BOSS_CYCLE[cycle] || { title: cycle || '기타', order: 99, reset: null };
    }

    // 월드 공유 항목: API가 월드 내 모든 캐릭터에 같은 완료 값을 보내 캐릭터별 구분이 안 됨
    //  - 익스트림 몬스터파크 주간 퀘스트: 진행 불가 캐릭터도 quest_state "2"로 옴
    //  - 에픽 던전: 한 캐릭터가 클리어하면 월드 내 모든 캐릭터에 now 5로 옴 (미클리어 0)
    //  - 몬스터파크(일일): 월드 단위 입장 횟수 → 월드마다 한 번만 표시
    const WORLD_SHARED = [/익스트림\s*몬스터\s*파커/, /에픽\s*던전/, /몬스터\s*파크/];

    function isWorldShared(name) {
        return WORLD_SHARED.some((re) => re.test(String(name || '')));
    }

    window.SchedulerState = { fetch: fetchState, flag, contentDone, contentProgress, bossCycle, isWorldShared };
})();
