/* ── API 키 저장소 ──
 * 넥슨 오픈API 키를 각 사용자 브라우저의 localStorage에만 저장한다.
 * 키가 바뀌면 window에 'apikeychange' 이벤트를 보낸다.
 */
(function () {
    const STORAGE_KEY = 'maple_util_nexon_api_key';
    const CHANGE_EVENT = 'apikeychange';

    function get() {
        try { return localStorage.getItem(STORAGE_KEY) || ''; } catch (e) { return ''; }
    }

    // 성공하면 true, 저장소를 쓸 수 없으면 false
    function set(key) {
        key = (key || '').trim();
        try {
            if (key) localStorage.setItem(STORAGE_KEY, key);
            else localStorage.removeItem(STORAGE_KEY);
        } catch (e) {
            return false;
        }
        window.dispatchEvent(new CustomEvent(CHANGE_EVENT, { detail: { hasKey: !!key } }));
        return true;
    }

    function clear() { return set(''); }

    function has() { return !!get(); }

    // 화면 표시용: 앞 6자리·뒤 4자리만 노출
    function mask(key) {
        if (!key) return '';
        if (key.length <= 10) return '•'.repeat(key.length);
        return key.slice(0, 6) + '•'.repeat(8) + key.slice(-4);
    }

    // 키 변경 구독 (다른 탭에서 바뀐 것도 포함)
    function onChange(callback) {
        window.addEventListener(CHANGE_EVENT, callback);
        window.addEventListener('storage', (e) => { if (e.key === STORAGE_KEY) callback(e); });
    }

    window.ApiKey = { get, set, clear, has, mask, onChange };
})();
