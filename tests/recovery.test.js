import test from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'svelte/store';
import { requestTimeout, READ_TIMEOUT, GCODE_TIMEOUT, RESTART_TIMEOUT, restartMethod } from '../src/lib/rpc.js';
const storage=new Map();
globalThis.localStorage={getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)};
globalThis.window={location:{hostname:'localhost',protocol:'http:'},addEventListener(){}};
globalThis.document={addEventListener(){}};
const ws=await import('../src/stores/websocket.js');
const machine=await import('../src/stores/machineStore.js');
const afc=await import('../src/stores/afcStore.js');
const recovery=await import('../src/stores/recoveryStore.js');
const config=await import('../src/stores/configStore.js');
const {notificationStore}=await import('../src/stores/notificationStore.js');
class Socket {
    constructor(){this.sent=[];this.readyState=0;Socket.last=this;}
    open(){this.readyState=1;this.onopen?.();}
    close(){this.readyState=3;this.onclose?.();}
    send(value){this.sent.push(JSON.parse(value));}
    respond(method,result){const r=this.sent.findLast(r=>r.method===method);assert.ok(r,method);this.onmessage?.({data:JSON.stringify({id:r.id,result})});}
    notify(status){this.onmessage?.({data:JSON.stringify({method:'notify_status_update',params:[status,1]})});}
}
globalThis.WebSocket=Socket;
const turn=()=>new Promise(resolve=>setImmediate(resolve));
const ready=()=>({webhooks:{state:'ready'},print_stats:{state:'standby'},virtual_sdcard:{is_active:false},pause_resume:{is_paused:false},idle_timeout:{state:'Idle'}});
const tool=()=>({...ready(),AFC:{current_state:'Idle',lanes:[]},'AFC_extruder e0':{on_shuttle:false},gcode:{commands:{AFC_SELECT_TOOL:{}}}});
function connect(t){ws.connect('test-recovery:7125');const s=Socket.last;s.open();t.after(()=>ws.disconnect());return s;}
async function initialized(s,status=ready()){
    s.respond('printer.info',{state:'ready'});await turn();
    s.respond('printer.objects.list',{objects:['configfile',...Object.keys(status)]});await turn();
    s.respond('printer.objects.query',{status:{configfile:{settings:{}}}});await turn();
    s.respond('printer.objects.subscribe',{});await turn();
    s.respond('printer.objects.query',{status});await turn();
}
async function stopped(s,state='error') {s.respond('printer.info',{state,state_message:'MCU communication failed'});await turn();}

test('request deadlines distinguish long scripts, restarts and reads; restart routing is exact',()=>{
    assert.equal(requestTimeout('printer.gcode.script'),GCODE_TIMEOUT);
    assert.equal(requestTimeout('printer.restart'),RESTART_TIMEOUT);
    assert.equal(requestTimeout('printer.objects.query'),READ_TIMEOUT);
    assert.equal(restartMethod(' firmware_restart '),'printer.firmware_restart');
    for(const script of ['G28','RESTART\nG28','MY_RESTART',null]) assert.equal(restartMethod(script),null);
});

test('a normal long G-code script survives 15 seconds while read timeouts remain bounded',async t=>{
    t.mock.timers.enable({apis:['setTimeout']});const s=connect(t);await initialized(s);
    let settled=false;const command=ws.send('printer.gcode.script',{script:'TEMPERATURE_WAIT SENSOR=extruder MINIMUM=200'},{silent:true});command.then(()=>settled=true,()=>settled=true);
    t.mock.timers.tick(45000);await turn();assert.equal(settled,false);
    s.respond('printer.gcode.script','ok');await command;
    const read=ws.send('server.info',{}, {silent:true});const rejected=assert.rejects(read,e=>e.code==='RPC_TIMEOUT' && /check the connection/.test(e.message));
    t.mock.timers.tick(READ_TIMEOUT);await rejected;
    assert.equal(s.sent.filter(r=>r.method==='printer.gcode.script').length,1);
});

test('AFC tool changes remain pending past 15 seconds and are not retried after observed state changes',async t=>{
    t.mock.timers.enable({apis:['setTimeout']});const s=connect(t);await initialized(s,tool());
    const action=afc.runAfcAction('select',{tool:'e0'});
    s.respond('printer.objects.query',{status:tool()});await turn();
    t.mock.timers.tick(45000);await turn();assert.ok(get(afc.afcPending));
    s.notify({'AFC_extruder e0':{on_shuttle:true}});assert.equal(get(machine.machineState).afcObjects['AFC_extruder e0'].on_shuttle,true);assert.ok(get(afc.afcPending));
    s.respond('printer.gcode.script','ok');await turn();
    const mounted=tool();mounted['AFC_extruder e0'].on_shuttle=true;s.respond('printer.objects.query',{status:mounted});await action;
    assert.equal(get(afc.afcPending),null);assert.equal(s.sent.filter(r=>r.method==='printer.gcode.script').length,1);
});

test('a genuine AFC timeout refreshes actual tool state and never replays the command',async t=>{
    t.mock.timers.enable({apis:['setTimeout']});const s=connect(t);await initialized(s,tool());
    const action=afc.runAfcAction('select',{tool:'e0'});const rejected=assert.rejects(action,e=>e.code==='RPC_TIMEOUT');
    s.respond('printer.objects.query',{status:tool()});await turn();
    t.mock.timers.tick(afc.AFC_MOTION_TIMEOUT);await turn();
    const mounted=tool();mounted['AFC_extruder e0'].on_shuttle=true;s.respond('printer.objects.query',{status:mounted});await rejected;
    assert.equal(get(machine.machineState).afcObjects['AFC_extruder e0'].on_shuttle,true);assert.equal(get(afc.afcPending),null);
    s.respond('printer.gcode.script','late acknowledgement');await turn();
    assert.equal(s.sent.filter(r=>r.method==='printer.gcode.script').length,1);
});

test('startup errors preserve the message without querying unavailable printer objects',async t=>{
    const s=connect(t);await stopped(s);
    assert.equal(get(machine.machineState).klippyState,'error');assert.equal(get(machine.machineState).stateMessage,'MCU communication failed');
    assert.equal(s.sent.some(r=>r.method==='printer.objects.list'),false);
});

test('an initially disconnected Klipper can be identified through Moonraker when printer.info fails',async t=>{
    const s=connect(t);const info=s.sent.findLast(r=>r.method==='printer.info');
    s.onmessage({data:JSON.stringify({id:info.id,error:{code:503,message:'Klippy not connected'}})});await turn();
    s.respond('server.info',{klippy_connected:false,klippy_state:'disconnected'});await turn();
    assert.equal(get(machine.machineState).klippyState,'disconnected');assert.equal(s.sent.some(r=>r.method==='printer.objects.list'),false);
});

test('firmware restart works while Klipper is stopped and remains pending until readiness is restored',async t=>{
    const s=connect(t);await stopped(s,'shutdown');
    const action=recovery.restartKlipper('FIRMWARE_RESTART');
    s.respond('server.info',{klippy_state:'shutdown'});await turn();
    assert.equal(s.sent.some(r=>r.method==='printer.gcode.script'),false);
    s.respond('printer.firmware_restart','ok');await action;
    assert.equal(get(recovery.recoveryState).pending,true);assert.equal(get(machine.machineState).isReady,false);
    await initialized(s);
    assert.equal(get(machine.machineState).isReady,true);assert.equal(get(recovery.recoveryState).pending,false);
});

test('restart blocks active jobs, duplicates and stale host requests without replay',async t=>{
    const s=connect(t);await initialized(s);
    const action=recovery.restartKlipper('RESTART');s.respond('server.info',{klippy_state:'ready'});await turn();
    s.respond('printer.objects.query',{status:{...ready(),print_stats:{state:'printing'}}});await assert.rejects(action,/current print/);
    assert.equal(s.sent.some(r=>r.method==='printer.restart'),false);
    const stale=recovery.restartKlipper('RESTART');const rejected=assert.rejects(stale);
    await assert.rejects(recovery.restartKlipper('RESTART'),/already pending/);
    ws.connect('other-host:7125');await rejected;
    assert.equal(get(recovery.recoveryState).pending,false);assert.equal(s.sent.some(r=>r.method==='printer.restart'),false);
});

test('slow power polling never overlaps and does not flood timeout notifications',async t=>{
    t.mock.timers.enable({apis:['setTimeout','setInterval']});
    config.configStore.update(c=>({...c,power:{selectedDevice:'AUTO'}}));
    const power=await import('../src/stores/powerStore.js');const s=connect(t);await initialized(s);
    s.respond('machine.device_power.devices',{devices:[{device:'printer',status:'on',type:'test'}]});await turn();
    assert.equal(s.sent.some(r=>r.method==='machine.device_power.status'),false,'initial list already includes status');
    const before=get(notificationStore).length;
    t.mock.timers.tick(5000);await turn();
    t.mock.timers.tick(15001);await turn();
    assert.equal(s.sent.filter(r=>r.method==='machine.device_power.status').length,1);
    assert.equal(get(notificationStore).length,before);assert.equal(get(power.currentPowerDevice).status,'error');
    config.configStore.update(c=>({...c,power:{selectedDevice:'OFF'}}));t.mock.timers.tick(5000);await turn();
    assert.equal(s.sent.filter(r=>r.method==='machine.device_power.status').length,1);
});

test('restart acknowledgement alone does not unlock controls and recovery has a bounded wait',async t=>{
    t.mock.timers.enable({apis:['setTimeout']});const s=connect(t);await stopped(s);
    const action=recovery.restartKlipper('RESTART');s.respond('server.info',{klippy_state:'error'});await turn();
    s.respond('printer.restart','ok');await action;
    s.respond('printer.info',{state:'startup',state_message:'Starting Klipper'});await turn();
    assert.equal(get(recovery.recoveryState).pending,true);assert.equal(get(machine.machineState).isReady,false);
    t.mock.timers.tick(60001);await turn();
    assert.equal(get(recovery.recoveryState).pending,false);assert.match(get(recovery.recoveryState).error,/has not become ready/);
    assert.equal(s.sent.filter(r=>r.method==='printer.restart').length,1);
});

test('a stale initialization response cannot overwrite a newer Klipper shutdown',async t=>{
    const s=connect(t);const old=s.sent.findLast(r=>r.method==='printer.info');
    s.onmessage({data:JSON.stringify({method:'notify_klippy_shutdown',params:[]})});
    await stopped(s,'shutdown');
    s.onmessage({data:JSON.stringify({id:old.id,result:{state:'ready'}})});await turn();
    assert.equal(get(machine.machineState).klippyState,'shutdown');assert.equal(get(machine.machineState).isReady,false);
    assert.equal(s.sent.some(r=>r.method==='printer.objects.list'),false);
});
