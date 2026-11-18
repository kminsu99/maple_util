/* ── 넥슨 오픈API 호출 ──
 * 의존: api_key.js
 *
 * 예) const { ocid } = await NexonApi.get('/maplestory/v1/id', { character_name: '닉네임' });
 */
(function () {
    const BASE_URL = 'https://open.api.nexon.com';

    class NexonApiError extends Error {
        constructor(message, status, code) {
            super(message);
            this.name = 'NexonApiError';
            this.status = status;
            this.code = code;
        }
    }

    function describeError(status, msg) {
        if (status === 400) return '요청 값이 올바르지 않습니다.' + (msg ? ` (${msg})` : '');
        if (status === 401 || status === 403) return 'API 키가 올바르지 않거나 권한이 없습니다.';
        if (status === 429) return '호출 한도를 초과했습니다. 잠시 후 다시 시도하세요.';
        if (status >= 500) return '넥슨 API 서버 오류입니다. 잠시 후 다시 시도하세요.';
        return msg || `API 오류 (${status})`;
    }

    // path: '/maplestory/v1/...' 형식, params: 쿼리 파라미터 객체
    async function get(path, params) {
        const key = ApiKey.get();
        if (!key) throw new NexonApiError('API 키가 없습니다. 먼저 키를 저장하세요.', 0, 'NO_KEY');

        const url = new URL(path, BASE_URL);
        Object.entries(params || {}).forEach(([k, v]) => {
            if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, v);
        });

        let res;
        try {
            res = await fetch(url, { headers: { 'x-nxopen-api-key': key } });
        } catch (e) {
            throw new NexonApiError('네트워크 오류로 API에 연결하지 못했습니다.', 0, 'NETWORK');
        }

        let body = null;
        try { body = await res.json(); } catch (e) { }

        if (!res.ok) {
            const err = (body && body.error) || {};
            throw new NexonApiError(describeError(res.status, err.message), res.status, err.name || '');
        }
        return body;
    }

    window.NexonApi = { get, NexonApiError };
})();
