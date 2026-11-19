/* ── 스케줄 보드: 게임 규칙 ──
 * 숫자·이름 규칙을 한곳에 모음. 게임 규칙이 바뀌면 이 파일만 고친다.
 * 화면(HTML)과 저장(localStorage)은 다루지 않는다.
 * 의존: 없음
 */
(function () {
    const str = (v) => String(v || '');

    // ── 보스 ──
    // 표시 순서: 아래 목록의 역순 (유피테르가 맨 위, 자쿰이 맨 아래)
    // 목록에 없는 보스는 그 뒤에 API 순서(list_order_no)대로 표시
    const BOSS_ORDER = [
        '자쿰', '파풀라투스', '반반', '블러디퀸', '벨룸', '피에르', '매그너스', '스우', '데미안',
        '가디언 엔젤 슬라임', '윌', '더스크', '루시드', '진 힐라', '듄켈', '검은 마법사', '선택받은 세렌',
        '감시자 칼로스', '카링', '벨로나', '림보', '발드릭스', '최초의 대적자', '찬란한 흉성', '유피테르',
    ].reverse().map((n) => n.replace(/\s+/g, ''));

    function bossRank(name) {
        const n = str(name).replace(/\s+/g, '');
        const exact = BOSS_ORDER.indexOf(n);
        if (exact >= 0) return exact;
        const part = BOSS_ORDER.findIndex((k) => n.includes(k));
        return part >= 0 ? part : BOSS_ORDER.length;
    }

    // 초기화까지 남은 일수가 이 값 이하이고 미완료면 빨간색 (일일보스는 D-day 없음)
    const BOSS_DDAY_RED = { bossWeekly: 2, bossMonthly: 7 };

    // 일일·월간 보스가 이 개수 이하면 게이지·펼치기 없이 목록을 바로 표시 (주간보스 제외)
    const BOSS_FLAT_MAX = 2;

    // ── 몬스터파크 (일일, 서버 단위) ──
    //  - 하루 최대 14회, 목표 기본값 14 (일일 컨텐츠 [편집]에서 서버별 1~14로 변경)
    //  - 서버끼리 합산하지 않음
    const MPARK_MAX = 14;

    function isMpark(name) {
        return /몬스터\s*파크/.test(str(name)) && !/익스트림/.test(str(name));
    }

    // ── 주간 컨텐츠 ──
    // 에픽 던전: 계정 공유, 전체 서버 통합 주 3회
    const EPIC_LIMIT = 3;

    function isEpic(name) {
        return /에픽\s*던전/.test(str(name));
    }

    // 익몬(익스트림 몬스터파크): 서버 단위 주 2회
    const XMPARK_LIMIT = 2;

    function isXmpark(name) {
        return /익스트림\s*몬스터\s*파[크커]/.test(str(name));
    }

    // 주간 컨텐츠 줄임말: 게이지 라벨과 항목 목록에 사용 (원래 이름은 마우스를 올리면 표시)
    //  - 원래 이름이 들어 있으면 해당 (띄어쓰기 무시), 위에서부터 먼저 맞는 것 사용
    //  - 백업: data/rule.txt
    const WEEKLY_SHORT = [
        ['[메이플 유니온] PC방 주간 드래곤 퇴치', '유니온코인(PC)'],   // 일반 드래곤 퇴치보다 먼저
        ['[메이플 유니온] 주간 드래곤 퇴치', '유니온코인'],
        ['[길드] 지하 수로', '수로'],
        ['[길드] 주간 미션 포인트', '주간 미션'],
        ['[길드] 플래그 레이스', '플래그'],
        ['에르다 스펙트럼', '여로'],
        ['배고픈 무토', '츄츄'],
        ['미드나잇 체이서', '레헬른'],
        ['스피릿 세이비어', '아르카나'],
        ['엔하임 디펜스', '모라스'],
        ['프로텍트 에스페라', '에스페라'],
        ['[주간 퀘스트] 성실한 조사에 대한 보답', '여로(젬)'],
        ['[주간 퀘스트] 크리티아스 주간 임무', '반마석'],
        ['[주간 퀘스트] 타락한 세계수 주간 임무', '앱솔(데)'],
        ['[주간 퀘스트] 타락한 세계수 정화에 대한 보답', '앱솔(데)'],
        ['[주간 퀘스트] 헤이븐 주간 임무', '앱솔(스)'],
        ['[주간 퀘스트] 꾸준한 의뢰에 대한 보답', '앱솔(스)'],
        ['익스트림 몬스터파크', '익몬'],   // '익스트림 몬스터파커' 표기도 해당
        ['무릉도장', '무릉'],
    ].map(([from, to]) => [normName(from), to]);

    // 비교용: [길드]·[주간 퀘스트] 같은 머리말과 띄어쓰기 제거, '몬스터파커' 표기를 '몬스터파크'로 통일
    //  → 머리말이 없거나 다르게 와도 같은 항목으로 인식
    function normName(name) {
        return str(name).replace(/\[[^\]]*\]/g, '').replace(/\s+/g, '').replace(/몬스터파커/g, '몬스터파크');
    }

    function shortName(name) {
        const n = normName(name);
        const hit = WEEKLY_SHORT.find(([from]) => n.includes(from));
        return hit ? hit[1] : name;
    }

    // 월드당 1회 항목 (줄임말 기준): 서버에서 한 캐릭터만 하면 완료 → 게이지 0/1 또는 1/1
    // (익몬은 월드당 2회 → XMPARK_LIMIT)
    const WORLD_ONCE = ['유니온코인', '유니온코인(PC)', '여로', '츄츄', '레헬른', '아르카나', '모라스', '에스페라'];

    function isWorldOnce(name) {
        return WORLD_ONCE.includes(shortName(name));
    }

    // ── 일일퀘스트 이름 ──
    // '[일일퀘스트]' 머리말은 지우고(제목으로 한 번만 표시), 지역 이름만 남긴다
    const DQ_PREFIX = /^\s*\[\s*일일\s*퀘스트\s*\]\s*/;
    // 지역 이름 (이름에 들어 있으면 나머지 글자는 모두 지움, 띄어쓰기 무시)
    const DQ_REGIONS = [
        '소멸의 여로', '츄츄 아일랜드', '얌얌 아일랜드', '레헬른', '아르카나', '모라스', '에스페라',
        '문브릿지', '고통의 미궁', '리멘',
        '세르니움', '호텔 아르크스', '오디움', '도원경', '아르테리아', '카르시온', '탈라하트', '기어드락',
    ].map((name) => ({ name, re: new RegExp(name.split(/\s+/).join('\\s*')) }))
        // '아르크스'만 있어도 호텔 아르크스로 표시
        .concat([{ name: '호텔 아르크스', re: /아르크스/ }]);
    // 목록에 없는 지역: 뒤에 붙는 수식어만 제거  예) '아르카나의 안정을 위해' → '아르카나'
    const DQ_SUFFIX = /\s*(?:의\s*)?(?:조사|최고의\s*요리|평온한\s*밤|평온한\s*바람|안정을\s*위해)\s*$/;

    // → { name: 표시 이름, tagged: '[일일퀘스트]' 머리말이 있었는지 }
    function dailyQuestName(name) {
        let n = str(name);
        const tagged = DQ_PREFIX.test(n);
        if (tagged) n = n.replace(DQ_PREFIX, '') || n;
        const region = DQ_REGIONS.find((r) => r.re.test(n));
        return { name: region ? region.name : (n.replace(DQ_SUFFIX, '') || n), tagged };
    }

    window.BoardRules = {
        bossRank, BOSS_DDAY_RED, BOSS_FLAT_MAX,
        MPARK_MAX, isMpark,
        EPIC_LIMIT, isEpic, XMPARK_LIMIT, isXmpark, shortName, isWorldOnce,
        dailyQuestName,
    };
})();
