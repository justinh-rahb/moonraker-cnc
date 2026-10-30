const encoder = new TextEncoder();
const decoder = new TextDecoder();
const MAX_FRAME = 16 * 1024 * 1024;
function indexOf(bytes, needle, from = 0) {
    outer: for (let i = from; i <= bytes.length - needle.length; i++) {
        for (let j = 0; j < needle.length; j++) if (bytes[i+j] !== needle[j]) continue outer;
        return i;
    }
    return -1;
}
export function multipartBoundary(contentType = '') {
    const match = /boundary\s*=\s*(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
    if (!/multipart\/x-mixed-replace/i.test(contentType) || !match) throw new Error('Camera did not return a multipart MJPEG stream');
    const boundary = match[1] || match[2];
    if (boundary.length > 200 || /[\r\n]/.test(boundary)) throw new Error('Invalid camera stream boundary');
    return boundary;
}
// Streaming multipart parser: network chunks need not align with headers or images.
export class MjpegParser {
    constructor(boundary) {
        this.marker = encoder.encode('--' + boundary);
        this.separator = encoder.encode('\r\n--' + boundary);
        this.headerEnd = encoder.encode('\r\n\r\n');
        this.buffer = new Uint8Array();
        this.body = false;
        this.length = null;
    }
    push(chunk) {
        if (this.buffer.length + chunk.length > MAX_FRAME + 16384) throw new Error('Camera frame exceeds the size limit');
        const next = new Uint8Array(this.buffer.length + chunk.length);
        next.set(this.buffer); next.set(chunk, this.buffer.length); this.buffer = next;
        const frames = [];
        while (this.buffer.length) {
            if (!this.body) {
                const start = indexOf(this.buffer, this.marker);
                if (start < 0) {
                    this.buffer = this.buffer.slice(-this.marker.length);
                    break;
                }
                if (start) this.buffer = this.buffer.slice(start);
                const end = indexOf(this.buffer, this.headerEnd, this.marker.length);
                if (end < 0) {
                    if (this.buffer.length > 16384) throw new Error('Invalid camera frame headers');
                    break;
                }
                const headers = decoder.decode(this.buffer.subarray(this.marker.length, end));
                const length = /(?:^|\r\n)content-length:\s*(\d+)\s*(?:\r\n|$)/i.exec(headers);
                this.length = length ? Number(length[1]) : null;
                if (this.length !== null && (!Number.isSafeInteger(this.length) || this.length < 1 || this.length > MAX_FRAME)) throw new Error('Invalid camera frame length');
                this.buffer = this.buffer.slice(end + 4);
                this.body = true;
            }
            const end = this.length ?? indexOf(this.buffer, this.separator);
            if (end < 0 || this.buffer.length < end) break;
            if (end) frames.push(this.buffer.slice(0, end));
            this.buffer = this.buffer.slice(end);
            this.body = false;
            this.length = null;
        }
        return frames;
    }
}
