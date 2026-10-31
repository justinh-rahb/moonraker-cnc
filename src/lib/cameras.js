const services = {iframe:'iframe',mjpeg:'mjpeg',mjpegstreamer:'mjpeg','mjpegstreamer-adaptive':'mjpeg',go2rtc:'go2rtc','webrtc-go2rtc':'go2rtc','camera-streamer':'camera-streamer','webrtc-camerastreamer':'camera-streamer'};
export const cameraStreamType = camera => camera?.streamType || services[camera?.service] || 'mjpeg';
export function resolveCameraUrl(value, printerUrl, pageUrl, type = 'mjpeg') {
    try {
        if (!value || typeof value !== 'string') return '';
        const printer = new URL(printerUrl);
        // Use this installation's proxy when it shares the printer's hostname.
        if (printer.port === '7125') printer.port = '';
        const page = pageUrl ? new URL(pageUrl) : null;
        // HTML pages can live outside the frontend's webcam proxy (e.g. /screen).
        const origin = type !== 'iframe' && page?.hostname === printer.hostname ? page.origin : printer.origin;
        const url = new URL(value,origin);
        return ['http:','https:'].includes(url.protocol) ? url.href : '';
    } catch {return '';}
}
export function importMoonrakerCameras(existing, cameras) {
    const result = [...existing];
    for (const camera of cameras) {
        const type = services[camera.service];
        const uid = camera.uid || camera.name;
        if (!type || !uid || !camera.stream_url) continue;
        const id = 'moonraker:' + uid;
        if (result.some(c => c.id === id || c.moonrakerUid === uid || (c.streamUrl === camera.stream_url && cameraStreamType(c) === type))) continue;
        result.push({id,moonrakerUid:uid,name:camera.name || 'Camera',enabled:camera.enabled !== false,
            streamType:type,streamUrl:camera.stream_url,snapshotUrl:camera.snapshot_url || '',
            aspectRatio:typeof camera.aspect_ratio === 'string' && /^\d+\s*[:/]\s*\d+$/.test(camera.aspect_ratio) ? camera.aspect_ratio.replace(/\s/g,'').replace('/',':') : '16:9',flipH:camera.flip_horizontal === true,flipV:camera.flip_vertical === true,
            rotation:[0,90,180,270].includes(camera.rotation) ? camera.rotation : 0,showFps:false,scanlines:false,
            targetRefreshRate:Math.max(1,Math.min(60,Number(camera.target_fps) || 30))});
    }
    return result;
}
