import test from 'node:test';
import assert from 'node:assert/strict';
import { cameraStreamType, resolveCameraUrl, importMoonrakerCameras } from '../src/lib/cameras.js';
import { validateConfig } from '../src/lib/config.js';

test('iframe service and explicit stream types resolve without changing existing players', () => {
    assert.equal(cameraStreamType({service:'iframe'}),'iframe');
    assert.equal(cameraStreamType({streamType:'iframe'}),'iframe');
    assert.equal(cameraStreamType({service:'iframe',streamType:'mjpeg'}),'mjpeg');
    assert.equal(cameraStreamType({service:'webrtc-go2rtc'}),'go2rtc');
    assert.equal(cameraStreamType({service:'webrtc-camerastreamer'}),'camera-streamer');
    assert.equal(cameraStreamType({}),'mjpeg');
});
test('embedded camera URLs use the printer host or local proxy and preserve explicit URLs', () => {
    assert.equal(resolveCameraUrl('/webcam/player?autoplay=1','http://printer:7125','http://desktop:5173'),'http://printer/webcam/player?autoplay=1');
    assert.equal(resolveCameraUrl('/webcam/player','http://printer:7125','http://printer:1337'),'http://printer:1337/webcam/player');
    assert.equal(resolveCameraUrl('/screen','http://printer:7125','http://printer:1337','iframe'),'http://printer/screen');
    assert.equal(resolveCameraUrl('https://camera/player#view','http://printer:7125','http://desktop:5173'),'https://camera/player#view');
    assert.equal(resolveCameraUrl('/player','https://[::1]:7125','http://desktop:5173'),'https://[::1]/player');
    for(const value of ['javascript:alert(1)','data:text/html,hello','file:///camera.html','']) assert.equal(resolveCameraUrl(value,'http://printer:7125','http://desktop:5173'),'');
});
test('Moonraker iframe import keeps page URL, visibility, geometry and optional snapshot', () => {
    const [camera]=importMoonrakerCameras([],[{uid:'screen',name:'Screen',service:'iframe',stream_url:'/webcam/player',enabled:false,aspect_ratio:'4 / 3',flip_horizontal:true,flip_vertical:true,rotation:90}]);
    assert.equal(camera.streamType,'iframe');assert.equal(camera.streamUrl,'/webcam/player');assert.equal(camera.snapshotUrl,'');
    assert.equal(camera.enabled,false);assert.equal(camera.aspectRatio,'4:3');assert.equal(camera.flipH,true);assert.equal(camera.flipV,true);assert.equal(camera.rotation,90);
    assert.equal(camera.showFps,false);assert.doesNotThrow(()=>validateConfig({cameras:[camera]}));
    const copy=JSON.parse(JSON.stringify({cameras:[camera]}));assert.equal(cameraStreamType(copy.cameras[0]),'iframe');
});
test('camera imports preserve user settings, avoid duplicates and skip unsupported services', () => {
    const native={uid:'screen',name:'Screen',service:'iframe',stream_url:'/player'};
    const existing=importMoonrakerCameras([],[native]);existing[0].name='User name';existing[0].scanlines=true;
    const next=importMoonrakerCameras(existing,[{...native,name:'Changed remotely'},native,{...native,uid:'hls',service:'hls'}]);
    assert.equal(next.length,1);assert.equal(next[0].name,'User name');assert.equal(next[0].scanlines,true);
    assert.equal(importMoonrakerCameras([{id:'manual',name:'Manual',streamType:'iframe',streamUrl:'/player'}],[native]).length,1);
    const cameras=importMoonrakerCameras([],[{...native,uid:'mjpeg',service:'mjpegstreamer'},{...native,uid:'webrtc',service:'webrtc-go2rtc'}]);
    assert.deepEqual(cameras.map(c=>c.streamType),['mjpeg','go2rtc']);
});
