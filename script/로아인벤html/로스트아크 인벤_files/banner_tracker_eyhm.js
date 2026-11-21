(function(w, d) {
    if (!location.host.match(/^([\w\-]+)\.inven\.co\.kr$/)) {
        return;
    }
    if (window.NodeList && !NodeList.prototype.forEach) {
        NodeList.prototype.forEach = Array.prototype.forEach;
    }
    w.INVEN = w.INVEN || {};

    const hostParts = window.location.host.split('.');
    const urlParams = new URLSearchParams(window.location.search);
    const domain = RegExp.$1.toLowerCase();

    // meta tag - inven-site
    const invenSiteMeta = document.querySelector('meta[name="inven-site"]');
    const invenSite = invenSiteMeta ? invenSiteMeta.content : null;

    if (hostParts[0] === 'www' && !urlParams.get('news')) {
        return;
    }

    if (!invenSite) {
        return;
    }

    class ViewTracker {
        constructor(domain) {
            this.domain = domain;
            this.currentSelectors = this.getSelectors(domain);
            this.platform = domain === 'm' ? 'mobile' : 'pc';
            this.page = hostParts[0] === 'www' ? { news: true, site: invenSite } : { news: false, site: hostParts[0] };

            // if (hostParts[0] === 'www') {
            //     this.page = { news: true, site: urlParams.get('site') || 'webzine' };
            // } else {
            //     this.page = { news: false, site: hostParts[0] };
            // }

            this.testQueryString = !!new URLSearchParams(window.location.search).get('swann-test');
        }

        /**
         * 트래킹
         * 웹진 - 뉴스 하단 배너 광고
         * 커뮤니티 - 메인 상단 배너 광고
         */
        init() {
            const selector = this.page.news ? this.currentSelectors.news.selector : this.currentSelectors.main.selector;
            if (document.querySelector(selector)) {
                this.sendDataToServer({
                    page: this.page,
                    key: selector,
                    platform: this.platform,
                });
            } else {
                if(this.testQueryString) {
                    console.log('selector not found', selector);
                }
            }
        }


        /**
         * selector
         * @param domain
         * @returns object
         */
        getSelectors(domain) {
            const selectors = {
                pc: {
                    news: { selector: '#webzineNewsView #news-tracker-banner' }, // 뉴스 하단 배너
                    main: { selector: '#topLinkBanner' } // live
                    // main: { selector: '#imid_b51caa3d6e2dc23'} // test
                },
                mobile: {}
            };
            return domain === 'm' ? selectors.mobile : selectors.pc;
        }


        /**
         * 서버 요청
         * @param data
         * @returns {Promise<void>}
         */
        async sendDataToServer(data) {
            const jsonData = JSON.stringify(data);
            const base64 = btoa(jsonData);
            const timestamp = Date.now();

            const payload = JSON.stringify({
                timestamp: timestamp,
                hash: await this.generateHash(base64, 'e1a8b1f24c5d3a6e7f1a2b3c4d5e6f7a'),
                data: base64,
            });

            const result = this.requestSendBeacon('https://www.inven.co.kr/api/banner_tracking/banner_view.php', payload);

            if (!result.success) {
                console.log(result.message);
            } else if (this.testQueryString) {
                console.log(result);
            }

            // try {
            //     const response = await this.request('https://www.inven.co.kr/api/banner_tracking/banner_view.php', 'POST', payload);
            //     if (!response.success) {
            //         throw new Error(response.message);
            //     } else {
            //         if(this.testQueryString) {
            //             console.log('banner tracking save success.');
            //         }
            //     }
            // } catch (error) {
            //     console.log(error.message);
            // }
        }


        /**
         * sendBeacon
         * @param path
         * @param body
         * @returns {{success: boolean, message: string}|{success: boolean, message: (string)}}
         */
        requestSendBeacon(path, body = null) {
            if (!body) return { success: false, message: 'No data to send' };
            const blob = new Blob([body], { type: 'application/json' });
            const success = navigator.sendBeacon(path, blob);
            return { success: success, message: success ? 'Data sent successfully' : 'Banner tracking Failed to send data' };
        }


        async request(path, method = 'POST', body = null) {
            const options = {
                credentials: 'include',
                mode: 'cors',
                method: method,
            };
            if (body) {
                options.headers = {
                    'Content-Type': 'application/json'
                };
                options.body = body;
            }
            try {
                const response = await fetch(path, options);
                if (!response.ok) {
                    throw new Error('banner tracking failed - request');
                }
                return await response.json();
            } catch (error) {
                return { success: false, message: error.message };
            }
        }

        async generateHash(data, secretKey) {
            const encoder = new TextEncoder();
            const dataBuffer = encoder.encode(data + secretKey);
            const hashBuffer = await crypto.subtle.digest('SHA-256', dataBuffer);
            const hashArray = Array.from(new Uint8Array(hashBuffer));
            return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
        }
    }

    d.addEventListener('DOMContentLoaded', () => {
        const viewTracker = new ViewTracker(domain);
        viewTracker.init();
    });

})(window, document);
