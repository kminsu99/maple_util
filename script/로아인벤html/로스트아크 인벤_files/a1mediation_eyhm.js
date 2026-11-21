function truncateStr(_str, _max) {
    return _str.length > _max ? _str.substr(0, _max - 1) : _str;
}

function getMaxBP() {
    try {
        return document.querySelector('meta[name="fluct-cookie"]').content;
    } catch {
        return '0';
    }
}

async function fetchTimeout(_target, _timeoutMs, _url, _replaceUrl, _width, _height) {
    try {
        const controller = new AbortController();
        setTimeout(() => { controller.abort(); }, _timeoutMs);

        var a1BP = getMaxBP();
        if (_url.indexOf('?') != -1) {
            _url = _url + '&a1bp=' + a1BP;
        } else {
            _url = _url + '?a1bp=' + a1BP;
        }
        // console.log("Ad URL:", _url);

        const res = await fetch(_url, { signal: controller.signal });
        const result = await res.text();

        let isMaxmo = false;
        var lines = result.split("\n");
        var lines2read = lines.length >= 4 ? 4 : lines.length;
        for (var i = 0; i < lines2read; i++) {
            var str2chk = truncateStr(lines[i], 10);
            if (str2chk.match('MAXMO')) {
                isMaxmo = true;
                break;
            }
        }

        var div = document.getElementById(_target);
        if (div) {
            if (isMaxmo) {
                const range = document.createRange();
                range.selectNode(document.getElementsByTagName("div").item(0));
                const documentFragment = range.createContextualFragment(result);
                div.appendChild(documentFragment);
            } else {
                var ifr = document.createElement('iframe');
                ifr.setAttribute("id", _target + "_iframe");
                ifr.setAttribute("frameborder", "0");
                ifr.setAttribute("allowtransparency", "true");
                ifr.setAttribute("hspace", "0");
                ifr.setAttribute("marginwidth", "0");
                ifr.setAttribute("marginheight", "0");
                ifr.setAttribute("scrolling", "no");
                ifr.setAttribute("vspace", "0");
                ifr.setAttribute("width", _width);
                ifr.setAttribute("height", _height);
                ifr.dataset.src = _url;
                ifr.dataset.ipos = _target;
                div.appendChild(ifr);

                var ifrd = ifr.contentWindow.document;
                ifrd.open();
                ifrd.write(result);
                ifrd.close();
            }
        }

    } catch (err) {
        var div = document.getElementById(_target);
        if (!div) return;

        if (_replaceUrl.length == 0) {
            div.remove();
        } else if (_replaceUrl.match('htm')) {
            const res = await fetch(_replaceUrl);
            div.innerHTML = await res.text();
        } else {
            const imgFrag = document.createElement('img');
            imgFrag.src = _replaceUrl;
            div.appendChild(imgFrag);
        }
    }
}

const isgpt = document.querySelector('script[src="https://securepubads.g.doubleclick.net/tag/js/gpt.js"]');
if (!isgpt) {
    var s = document.createElement('script');
    s.type = 'text/javascript';
    s.src = 'https://securepubads.g.doubleclick.net/tag/js/gpt.js';
    s.setAttribute('async', '');
    document.getElementsByTagName('head')[0].appendChild(s);
}

window.addEventListener("message", function(e) {
    if (!e.data || e.data.action !== "refreshMe") return;

    var frame = null;

    if (e.data.ipos) {
        frame = document.querySelector("iframe[data-ipos='" + e.data.ipos + "']");
    }

    if (!frame) {
        var iframes = document.getElementsByTagName('iframe');
        for (var i = 0; i < iframes.length; i++) {
            try {
                if (iframes[i].contentWindow === e.source) {
                    frame = iframes[i];
                    break;
                }
            } catch (err) {}
        }
    }

    if (!frame) return;

    var origUrl = frame.getAttribute("data-src") || frame.dataset.src;
    if (!origUrl) return;

    var sep = origUrl.indexOf("?") === -1 ? "?" : "&";
    var newUrl = origUrl + sep + "rnd=" + Date.now();

    var newFrame = document.createElement("iframe");
    newFrame.setAttribute("width", frame.getAttribute("width") || frame.width || "");
    newFrame.setAttribute("height", frame.getAttribute("height") || frame.height || "");
    newFrame.setAttribute("frameborder", frame.getAttribute("frameborder") || "0");
    newFrame.setAttribute("allowtransparency", frame.getAttribute("allowtransparency") || "true");
    newFrame.setAttribute("scrolling", frame.getAttribute("scrolling") || "no");

    newFrame.dataset.src = origUrl;
    newFrame.dataset.ipos = e.data.ipos || frame.dataset.ipos || "";

    newFrame.src = newUrl;

    frame.parentNode.replaceChild(newFrame, frame);
});