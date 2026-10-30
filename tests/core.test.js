import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeConfig, validateConfig, serverUrl, hostKey } from '../src/lib/config.js';
import { parseRoute, routeHash } from '../src/lib/navigation.js';
import { estimatePrint } from '../src/lib/printEstimates.js';
import { databaseSettings, canonical, reconcileSettings, validateRemote } from '../src/lib/settingsSync.js';

test('partial nested settings keep defaults without sharing references', () => {
    const defaults = { temperature:{showGraph:true,autoscale:true}, cameras:[{id:'a'}] };
    const merged = mergeConfig(defaults,{temperature:{showGraph:false},cameras:[]});
    assert.deepEqual(merged,{temperature:{showGraph:false,autoscale:true},cameras:[]});
    merged.temperature.autoscale = false;
    assert.equal(defaults.temperature.autoscale,true);
});
test('prototype keys never enter configuration', () => {
    const result = mergeConfig({},JSON.parse('{"__proto__":{"polluted":true},"constructor":{}}'));
    assert.equal({}.polluted,undefined);
    assert.equal(Object.hasOwn(result,'__proto__'),false);
});
test('reject malformed imports', () => {
    for(const value of [null,[],{server:null},{server:{ip:''}},{server:{ip:'p',port:99999}},{server:{ip:'http://user:pass@p'}},{panels:{}},{panels:[{id:'p'}]},{cameras:[null]},{dashboard:{wide:'wrong'}}]) assert.throws(() => validateConfig(value));
});
test('host endpoints support secure reverse proxies and IPv6', () => {
    assert.equal(serverUrl({ip:'printer.local',port:'7125'}),'http://printer.local:7125');
    assert.equal(serverUrl({ip:'https://proxy.local/printer/',port:''}),'https://proxy.local/printer');
    assert.equal(serverUrl({ip:'[::1]',port:'7125'}),'http://[::1]:7125');
    assert.equal(hostKey({ip:'PRINTER.local',port:'80'}),hostKey({ip:'http://printer.local',port:''}));
});
test('routes round-trip encoded directories and settings', () => {
    const hash = routeHash({files:true,path:'test + prints/日本語 #'});
    assert.deepEqual(parseRoute(hash),{view:'files',path:'test + prints/日本語 #'});
    assert.deepEqual(parseRoute('#/settings/cameras'),{view:'settings',tab:'Cameras'});
    assert.deepEqual(parseRoute('#/history'),{view:'history'});
});
test('invalid routes and malformed escapes close overlays safely', () => {
    for(const hash of ['','#','#/other','#/files/%E0%A4%A','#/files/../config','#/files/a%2Fb']) assert.deepEqual(parseRoute(hash),{view:'dashboard'});
    assert.deepEqual(parseRoute('#/settings/unknown'),{view:'settings',tab:'General'});
});
test('print estimates distinguish elapsed wall time and active printing', () => {
    const result = estimatePrint({printStatsState:'printing',isReady:true,statusUpdatedAt:1000,printDuration:100,totalDuration:130,printProgress:.25},1000);
    assert.equal(result.elapsed,130); assert.equal(result.remaining,300); assert.equal(result.completion,301000);
});
test('warmup uses slicer estimate and no division at zero progress', () => {
    const result = estimatePrint({printStatsState:'printing',printProgress:0,printDuration:0,estimatedTime:3600});
    assert.equal(result.remaining,3600);
    assert.equal(estimatePrint({printStatsState:'printing'}).remaining,null);
});
test('pause suppresses finish time; completion reaches exactly 100%', () => {
    const result = estimatePrint({printStatsState:'paused',isReady:true,printProgress:.5,printDuration:120,totalDuration:300},100000);
    assert.equal(result.remaining,120); assert.equal(result.completion,null); assert.equal(result.elapsed,300);
    assert.equal(estimatePrint({printStatsState:'complete',printProgress:.999}).progress,1);
});
test('sleep and disconnect never fabricate elapsed time', () => {
    const state = {printStatsState:'printing',printDuration:100,statusUpdatedAt:1000,isReady:true};
    assert.equal(estimatePrint(state,1000000).elapsed,102);
    assert.equal(estimatePrint({...state,isReady:false},1000000).elapsed,100);
});
test('database excludes browser transport and keeps UX settings', () => {
    assert.deepEqual(databaseSettings({server:{ip:'p'},dashboard:{wide:['status']},console:{newestFirst:true}}),{dashboard:{wide:['status']},console:{newestFirst:true}});
});
test('database reconciliation handles new browsers, offline edits, and conflicts', () => {
    const a = {title:'a'}, b = {title:'b'}, c = {title:'c'};
    assert.equal(reconcileSettings(a,null).action,'upload');
    assert.equal(reconcileSettings(a,b).action,'download');
    assert.equal(reconcileSettings(a,a,b).action,'equal');
    assert.equal(reconcileSettings(a,b,a).action,'download');
    assert.equal(reconcileSettings(b,a,a).action,'upload');
    assert.equal(reconcileSettings(b,c,a).action,'conflict');
    assert.equal(canonical({b:1,a:2}),canonical({a:2,b:1}));
    assert.throws(() => validateRemote({version:42,settings:a}));
});

test('rebrand updates generic titles and preserves custom printer names', async () => {
    const { brandingTitle } = await import('../src/lib/config.js');
    assert.equal(brandingTitle('RETRO CNC PANEL'),'RETROGRADE');
    assert.equal(brandingTitle('Retro CNC Panel'),'RETROGRADE');
    assert.equal(brandingTitle('QIDI Q2C'),'QIDI Q2C');
    assert.equal(validateRemote({version:1,settings:{title:'RETRO CNC PANEL'}}).title,'RETROGRADE');
});


test('collapsed sections survive database round trips and reject malformed state', () => {
    const settings = {collapsedPanels:['CONSOLE','macro:maintenance']};
    assert.deepEqual(validateRemote({version:1,settings:databaseSettings(settings)}),settings);
    for (const collapsedPanels of [null,{},'CONSOLE',[false]]) assert.throws(() => validateConfig({collapsedPanels}));
    assert.doesNotThrow(() => validateConfig({title:'Older export'}));
});


test('camera scanline preference round trips and older camera exports remain valid', () => {
    for (const scanlines of [true,false]) {
        const settings = {cameras:[{id:'bed',name:'Bed',scanlines}]};
        assert.deepEqual(validateRemote({version:1,settings}),settings);
    }
    assert.doesNotThrow(() => validateConfig({cameras:[{id:'old',name:'Old'}]}));
    assert.throws(() => validateConfig({cameras:[{id:'bad',name:'Bad',scanlines:'true'}]}));
});
