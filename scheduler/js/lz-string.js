/* ── LZ-string (compressToUTF16 / decompressFromUTF16 만 포함) ──
 * pieroxy/lz-string (MIT License, Copyright (c) 2013 Pieroxy) 알고리즘을 옮겨 적은 축소판.
 * localStorage에 문자열을 압축 저장할 때 사용 (UTF-16 안전 문자만 생성).
 * 사용: LZString.compressToUTF16(str), LZString.decompressFromUTF16(compressed)
 */
(function (root) {
    const f = String.fromCharCode;

    function compress(uncompressed, bitsPerChar, getCharFromInt) {
        if (uncompressed == null) return '';
        const dictionary = {};
        const dictionaryToCreate = {};
        let c = '';
        let wc = '';
        let w = '';
        let enlargeIn = 2;
        let dictSize = 3;
        let numBits = 2;
        const data = [];
        let dataVal = 0;
        let dataPosition = 0;
        let value;
        let i;

        function writeBit(bit) {
            dataVal = (dataVal << 1) | bit;
            if (dataPosition === bitsPerChar - 1) {
                dataPosition = 0;
                data.push(getCharFromInt(dataVal));
                dataVal = 0;
            } else {
                dataPosition++;
            }
        }

        function writeBits(count, val) {
            for (let k = 0; k < count; k++) {
                writeBit(val & 1);
                val >>= 1;
            }
        }

        function emitW() {
            if (Object.prototype.hasOwnProperty.call(dictionaryToCreate, w)) {
                const code = w.charCodeAt(0);
                if (code < 256) {
                    writeBits(numBits, 0);
                    writeBits(8, code);
                } else {
                    writeBits(numBits, 1);
                    writeBits(16, code);
                }
                enlargeIn--;
                if (enlargeIn === 0) {
                    enlargeIn = Math.pow(2, numBits);
                    numBits++;
                }
                delete dictionaryToCreate[w];
            } else {
                writeBits(numBits, dictionary[w]);
            }
            enlargeIn--;
            if (enlargeIn === 0) {
                enlargeIn = Math.pow(2, numBits);
                numBits++;
            }
        }

        for (i = 0; i < uncompressed.length; i++) {
            c = uncompressed.charAt(i);
            if (!Object.prototype.hasOwnProperty.call(dictionary, c)) {
                dictionary[c] = dictSize++;
                dictionaryToCreate[c] = true;
            }
            wc = w + c;
            if (Object.prototype.hasOwnProperty.call(dictionary, wc)) {
                w = wc;
            } else {
                emitW();
                dictionary[wc] = dictSize++;
                w = String(c);
            }
        }

        if (w !== '') emitW();

        // 끝 표시
        value = 2;
        writeBits(numBits, value);

        // 남은 비트 밀어내기
        while (true) {
            dataVal = dataVal << 1;
            if (dataPosition === bitsPerChar - 1) {
                data.push(getCharFromInt(dataVal));
                break;
            } else {
                dataPosition++;
            }
        }
        return data.join('');
    }

    function decompress(length, resetValue, getNextValue) {
        const dictionary = [];
        let enlargeIn = 4;
        let dictSize = 4;
        let numBits = 3;
        let entry = '';
        const result = [];
        let w;
        let c;
        const data = { val: getNextValue(0), position: resetValue, index: 1 };

        function readBits(count) {
            let bits = 0;
            let power = 1;
            const maxpower = Math.pow(2, count);
            while (power !== maxpower) {
                const resb = data.val & data.position;
                data.position >>= 1;
                if (data.position === 0) {
                    data.position = resetValue;
                    data.val = getNextValue(data.index++);
                }
                bits |= (resb > 0 ? 1 : 0) * power;
                power <<= 1;
            }
            return bits;
        }

        for (let i = 0; i < 3; i++) dictionary[i] = i;

        switch (readBits(2)) {
            case 0: c = f(readBits(8)); break;
            case 1: c = f(readBits(16)); break;
            case 2: return '';
        }
        dictionary[3] = c;
        w = c;
        result.push(c);

        while (true) {
            if (data.index > length) return '';

            let cc = readBits(numBits);
            switch (cc) {
                case 0:
                    dictionary[dictSize++] = f(readBits(8));
                    cc = dictSize - 1;
                    enlargeIn--;
                    break;
                case 1:
                    dictionary[dictSize++] = f(readBits(16));
                    cc = dictSize - 1;
                    enlargeIn--;
                    break;
                case 2:
                    return result.join('');
            }

            if (enlargeIn === 0) {
                enlargeIn = Math.pow(2, numBits);
                numBits++;
            }

            if (dictionary[cc]) {
                entry = dictionary[cc];
            } else if (cc === dictSize) {
                entry = w + w.charAt(0);
            } else {
                return null;
            }
            result.push(entry);

            dictionary[dictSize++] = w + entry.charAt(0);
            enlargeIn--;
            w = entry;

            if (enlargeIn === 0) {
                enlargeIn = Math.pow(2, numBits);
                numBits++;
            }
        }
    }

    const LZString = {
        compressToUTF16(input) {
            if (input == null) return '';
            return compress(input, 15, (a) => f(a + 32)) + ' ';
        },
        decompressFromUTF16(compressed) {
            if (compressed == null) return '';
            if (compressed === '') return null;
            return decompress(compressed.length, 16384, (index) => compressed.charCodeAt(index) - 32);
        },
    };

    root.LZString = LZString;
    if (typeof module !== 'undefined' && module.exports) module.exports = LZString;
})(typeof window !== 'undefined' ? window : globalThis);
