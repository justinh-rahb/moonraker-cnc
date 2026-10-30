import test from 'node:test';
import assert from 'node:assert/strict';
import { get } from 'svelte/store';
const storage = new Map();
globalThis.localStorage = {getItem:key => storage.get(key)||null,setItem:(key,value) => storage.set(key,value)};
globalThis.window = {location:{hostname:'localhost',protocol:'http:'},addEventListener(){}};
globalThis.document = {addEventListener(){}};
const config = await import('../src/stores/configStore.js');
const ws = await import('../src/stores/websocket.js');
const machine = await import('../src/stores/machineStore.js');
class FakeSocket {
    static sockets = [];
    constructor(url) {this.url = url;this.readyState = 0;this.sent = [];FakeSocket.sockets.push(this);}
    open() {this.readyState = 1;this.onopen?.();}
    close() {this.readyState = 3;this.onclose?.();}
    send(payload) {this.sent.push(JSON.parse(payload));}
    respond(id,result) {this.onmessage?.({data:JSON.stringify({jsonrpc:'2.0',id,result})});}
}
globalThis.WebSocket = FakeSocket;

test('host configuration isolates macros and layouts; legacy imports route to their own host', () => {
    const initial = get(config.workspaceStore).activeHostId;
    config.configStore.update(c => ({...c,title:'Printer A',dashboard:{wide:['status']}}));
    const second = config.addHost('Printer B',{ip:'printer-b',port:'7125',autoConnect:false});
    assert.notEqual(get(config.configStore).title,'Printer A');
    config.configStore.update(c => ({...c,title:'Printer B'}));
    config.switchHost(initial); assert.equal(get(config.configStore).title,'Printer A');
    assert.deepEqual(get(config.configStore).dashboard.wide,['status']);
    assert.throws(() => config.addHost('Duplicate',{ip:'printer-b',port:'7125'}));
    assert.equal(config.importConfig(JSON.stringify({title:'Imported B',server:{ip:'printer-b',port:'7125'},macros:[{label:'Test',gcode:'M115'}]})).success,true);
    assert.equal(get(config.workspaceStore).activeHostId,second);
    assert.equal(get(config.configStore).panels[0].macros[0].gcode,'M115');
    config.switchHost(initial); assert.equal(get(config.configStore).title,'Printer A');
});
test('workspace exports round-trip and invalid imports leave state untouched', () => {
    const exported = config.exportWorkspace();
    assert.equal(config.importConfig(exported).success,true);
    const before = config.exportWorkspace();
    assert.equal(config.importConfig('{"server":null}').success,false);
    assert.equal(config.exportWorkspace(),before);
});
test('pending RPCs reject on host change, stale sockets cannot change state', async () => {
    ws.connect('http://printer-a:7125');
    const first = FakeSocket.sockets.at(-1); first.open();
    const oldClose = first.onclose, oldMessage = first.onmessage;
    const result = ws.send('server.info');
    ws.connect('https://printer-b/proxy');
    await assert.rejects(result,/closed/);
    assert.equal(FakeSocket.sockets.at(-1).url,'wss://printer-b/proxy/websocket');
    oldClose(); oldMessage({data:'{"method":"notify_klippy_shutdown"}'});
    assert.equal(get(ws.connectionState),'connecting');
    ws.disconnect();
});
test('RPC timeout removes request and command is never replayed', async () => {
    ws.connect('printer-a:7125'); const socket = FakeSocket.sockets.at(-1);socket.open();
    const result = ws.send('printer.gcode.script',{script:'M115'},{timeout:5,silent:true});
    await assert.rejects(result,/timed out/);
    assert.equal(socket.sent.filter(r => r.method === 'printer.gcode.script').length,1);
    ws.disconnect();
});
test('disconnect clears all telemetry before another host connects', () => {
    ws.connect('printer-a:7125');
    machine.machineState.update(s => ({...s,isReady:true,printFilename:'old.gcode',temperatures:{extruder:{current:240}},miscDevices:{fan:{value:1}},printProgress:.9}));
    ws.disconnect();
    assert.equal(get(machine.machineState).isReady,false);
    assert.equal(get(machine.machineState).printFilename,'');
    assert.deepEqual(get(machine.machineState).temperatures,{});
    assert.equal(get(machine.machineState).printProgress,0);
});

test('changing the connection address selects a separate host configuration', () => {
    const previous = get(config.workspaceStore).activeHostId;
    config.configStore.update(c => ({...c,title:'Keep original'}));
    config.updateServerConfig('new-host.local','7125',false);
    assert.notEqual(get(config.workspaceStore).activeHostId,previous);
    assert.notEqual(get(config.configStore).title,'Keep original');
    config.switchHost(previous);
    assert.equal(get(config.configStore).title,'Keep original');
    assert.throws(() => config.updateServerConfig('','7125',true));
});

test('database sync writes application settings only and preserves host transport', async () => {
    const sync = await import('../src/stores/settingsSync.js');
    ws.connect('printer-db:7125');const socket = FakeSocket.sockets.at(-1);socket.open();
    const settle = () => new Promise(resolve => setImmediate(resolve));
    const respond = (method,result) => {
        const request = socket.sent.findLast(r => r.method === method);
        assert.ok(request,`Expected ${method}`);socket.respond(request.id,result);
    };
    respond('server.database.list',{namespaces:[]});await settle();
    const write = socket.sent.find(r => r.method === 'server.database.post_item');
    assert.equal(write.params.namespace,'retro_cnc_panel');
    assert.equal(write.params.key,'settings');
    assert.equal(write.params.value.settings.server,undefined);
    assert.ok(write.params.value.settings.console);
    socket.respond(write.id,{});await settle();
    assert.equal(get(sync.settingsSyncState).status,'synced');
    ws.disconnect();
    const transport = get(config.configStore).server;
    ws.connect('printer-db:7125');const second = FakeSocket.sockets.at(-1);second.open();
    const listing = second.sent.find(r => r.method === 'server.database.list');
    second.respond(listing.id,{namespaces:['retro_cnc_panel']});await settle();
    const read = second.sent.find(r => r.method === 'server.database.get_item');
    second.respond(read.id,{value:{settings:{version:1,settings:{...write.params.value.settings,title:'Changed remotely'}}}});await settle();
    assert.equal(get(config.configStore).title,'Changed remotely');
    assert.deepEqual(get(config.configStore).server,transport);
    ws.disconnect();
});

test('status deltas retain slicer layers and metadata is isolated across reconnects', async () => {
    ws.connect('printer-status:7125'); const socket = FakeSocket.sockets.at(-1);socket.open();
    const settle = () => new Promise(resolve => setImmediate(resolve));
    async function response(method,result) {
        const request=socket.sent.findLast(r => r.method === method);assert.ok(request,method);socket.respond(request.id,result);await settle();
    }
    await response('printer.info',{state:'ready'});
    await response('printer.objects.list',{objects:['toolhead','webhooks','configfile','print_stats','virtual_sdcard','gcode_move','extruder','fan','stepper_enable','output_pin scaled','output_pin light']});
    await response('printer.objects.query',{status:{configfile:{settings:{printer:{max_velocity:300},extruder:{max_temp:280,min_extrude_temp:170},'output_pin scaled':{scale:255,pwm:true},'output_pin light':{pwm:false}}}}});
    await response('printer.objects.subscribe',{});
    await response('printer.objects.query',{status:{stepper_enable:{steppers:{stepper_x:true,stepper_y:true,extruder:false}},webhooks:{state:'ready'},toolhead:{position:[0,0,2,0],homed_axes:'xyz',extruder:'extruder'},extruder:{temperature:200,target:210},print_stats:{state:'printing',filename:'current.gcode',print_duration:100,info:{current_layer:5,total_layer:10}},virtual_sdcard:{progress:.5}}});
    assert.equal(get(machine.machineState).isReady,true);
    assert.deepEqual(get(machine.machineState).stepperStates,{stepper_x:true,stepper_y:true,extruder:false});
    socket.onmessage({data:JSON.stringify({method:'notify_status_update',params:[{stepper_enable:{steppers:{stepper_x:false}}},123]})});
    assert.equal(get(machine.machineState).stepperStates.stepper_x,false);
    assert.equal(get(machine.machineState).stepperStates.stepper_y,true);
    assert.equal(get(machine.machineState).currentLayer,5);
    assert.equal(get(machine.machineState).miscDevices['output_pin scaled'].max,255);
    assert.equal(get(machine.machineState).miscDevices['output_pin light'].pwm,false);
    socket.onmessage({data:JSON.stringify({method:'notify_status_update',params:[{toolhead:{position:[1,1,9,0]}},123]})});
    assert.equal(get(machine.machineState).currentLayer,5);
    assert.equal(get(machine.machineState).totalLayers,10);
    socket.onmessage({data:JSON.stringify({method:'notify_status_update',params:[{webhooks:{state_message:'Ready to print'}},123]})});
    assert.equal(get(machine.machineState).isReady,true);
    const oldMessage = socket.onmessage;
    ws.connect('different-printer:7125');
    assert.equal(get(machine.machineState).stepperStates,null);
    oldMessage({data:JSON.stringify({method:'notify_status_update',params:[{print_stats:{filename:'wrong.gcode'}},124]})});
    assert.equal(get(machine.machineState).printFilename,'');
    ws.disconnect();
});

test('unexpected close reconnects automatically; disconnect cancels retries', async () => {
    ws.connect('printer-reconnect:7125'); const first = FakeSocket.sockets.at(-1);first.open();first.close();
    assert.equal(get(ws.connectionState),'reconnecting');
    await new Promise(resolve => setTimeout(resolve,1350));
    assert.notEqual(FakeSocket.sockets.at(-1),first);
    assert.equal(FakeSocket.sockets.at(-1).url,'ws://printer-reconnect:7125/websocket');
    FakeSocket.sockets.at(-1).close();
    ws.disconnect();
    const count = FakeSocket.sockets.length;
    await new Promise(resolve => setTimeout(resolve,1350));
    assert.equal(FakeSocket.sockets.length,count);
});

test('manual movement preserves coordinate modes and cold extrusion sends nothing', () => {
    ws.connect('printer-controls:7125');const socket = FakeSocket.sockets.at(-1);socket.open();
    machine.machineState.update(s => ({...s,isReady:true,homedAxes:'xyz',printStatsState:'standby',availableExtruders:['extruder','extruder1'],activeExtruder:'extruder',temperatures:{extruder:{current:200}},configured:{extruder:{min_extrude_temp:170}}}));
    machine.jog('x',1);machine.extrude(1);machine.setActiveExtruder('extruder1');
    const scripts = socket.sent.filter(r => r.method === 'printer.gcode.script').map(r=>r.params.script);
    assert.match(scripts[0],/^SAVE_GCODE_STATE[\s\S]*G91[\s\S]*RESTORE_GCODE_STATE/);
    assert.match(scripts[1],/^SAVE_GCODE_STATE[\s\S]*M83[\s\S]*RESTORE_GCODE_STATE/);
    assert.equal(scripts[2],'ACTIVATE_EXTRUDER EXTRUDER=extruder1');
    machine.machineState.update(s => ({...s,temperatures:{extruder:{current:20}}}));
    machine.extrude(1);
    assert.equal(socket.sent.filter(r => r.method === 'printer.gcode.script').length,3);
    ws.disconnect();
});

test('absolute move checks fresh state, waits for acknowledgement, and cancels across hosts', async () => {
    ws.connect('absolute-controls:7125'); const socket = FakeSocket.sockets.at(-1); socket.open();
    machine.machineState.update(s => ({...s,isReady:true,homedAxes:'xyz',printStatsState:'standby'}));
    const state = {webhooks:{state:'ready'},print_stats:{state:'standby'},virtual_sdcard:{is_active:false},pause_resume:{is_paused:false},toolhead:{homed_axes:'xyz',axis_minimum:[0,0,0],axis_maximum:[270,270,280],max_velocity:300},gcode_move:{position:[10,10,10],gcode_position:[10,10,9.8],speed_factor:1}};
    const move = machine.moveAbsolute('z',15);
    const query = socket.sent.findLast(r => r.method === 'printer.objects.query');
    assert.deepEqual(query.params.objects.gcode_move,['position','gcode_position','speed_factor']);
    socket.respond(query.id,{status:state}); await new Promise(resolve => setImmediate(resolve));
    const command = socket.sent.findLast(r => r.method === 'printer.gcode.script');
    assert.match(command.params.script,/G90\nG1 Z14\.800000/);
    socket.respond(command.id,{}); assert.equal(await move,true);
    const cancelled = machine.moveAbsolute('x',20);
    const before = socket.sent.filter(r => r.method === 'printer.gcode.script').length;
    ws.connect('another-absolute-host:7125');
    assert.equal(await cancelled,false);
    assert.equal(socket.sent.filter(r => r.method === 'printer.gcode.script').length,before);
    ws.disconnect();
});
