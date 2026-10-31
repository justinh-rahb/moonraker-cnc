import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { afcObjectNames, mergeAfcStatus, afcModel, afcPanelVisible, afcControlBlock, afcScript, filamentColor } from '../src/lib/afc.js';
import { validateConfig } from '../src/lib/config.js';
const u1 = JSON.parse(readFileSync(new URL('./fixtures/afc-lite.json',import.meta.url)));
const ready = () => ({...structuredClone(u1),webhooks:{state:'ready'},print_stats:{state:'standby'},virtual_sdcard:{is_active:false},pause_resume:{is_paused:false},idle_timeout:{state:'Idle'},gcode:{commands:Object.fromEntries(['CHANGE_TOOL','TOOL_UNLOAD','LANE_UNLOAD','SET_COLOR','SET_MATERIAL','SET_WEIGHT','SET_SPOOL_ID','SET_MAP','SET_RUNOUT','AFC_CLEAR_MESSAGE'].map(k=>[k,{}]))}});

test('AFC detection requires root object; panel can be disabled without changing telemetry', () => {
    assert.deepEqual(afcObjectNames(['extruder','gcode_macro AFC','AFC_lane E0']),[]);
    assert.deepEqual(afcObjectNames(['extruder','AFC','AFC_lane E0','AFC_unit U1']),['AFC','AFC_lane E0','AFC_unit U1']);
    assert.equal(afcPanelVisible({},{}),false);assert.equal(afcPanelVisible({AFC:{}},{}),false);
    assert.equal(afcPanelVisible(u1,{}),true);assert.equal(afcPanelVisible(u1,{afc:{enabled:false}}),false);
    assert.doesNotThrow(()=>validateConfig({afc:{enabled:false}}));
    for (const afc of [null,[],true,{enabled:'false'}]) assert.throws(()=>validateConfig({afc}));
});
test('live U1 compatibility status resolves unit, tools and sensors without trusting empty status strings', () => {
    const model=afcModel(u1);assert.equal(model.units.length,1);assert.equal(model.units[0].name,'U1');
    assert.equal(model.units[0].lanes.length,4);assert.equal(model.current,'E1');assert.equal(model.lanes[1].active,true);
    assert.deepEqual(model.lanes[0].tools,['T0']);assert.equal(model.lanes[0].material,'ASA');
    assert.equal(model.lanes[0].filamentState,'In tool');assert.equal(model.lanes[3].filamentState,'Empty');
    assert.equal(model.lanes[0].weight,undefined);assert.equal(model.message,'');
});
test('real AFC stepper objects, multi-tool maps, case-insensitive units and unassigned lanes are supported', () => {
    const s={AFC:{units:['BoxTurtle turtle'],lanes:['lane1','lane2'],message:{message:'Check hub',type:'warning'}},'AFC_BoxTurtle Turtle':{lanes:['lane1']},'AFC_stepper lane1':{map:['T0','T4'],prep:true,load:true},'AFC_lane lane2':{map:null},'AFC_hub hub':{state:true},'AFC_buffer buf':{state:'Advancing'},'AFC_extruder extruder':{lane_loaded:'lane1'}};
    const m=afcModel(s);assert.deepEqual(m.lanes[0].tools,['T0','T4']);assert.equal(m.units[0].lanes.length,1);assert.equal(m.units[1].name,'Lanes');
    assert.equal(m.extruders[0].name,'extruder');assert.equal(m.hubs[0].state,true);assert.equal(m.buffers[0].state,'Advancing');assert.equal(m.message,'Check hub');
});
test('delta merging preserves lane data and replaces arrays without resurrecting undiscovered objects', () => {
    const next=mergeAfcStatus(u1,{'AFC_lane E0':{color:'#FF8800'},AFC:{lanes:['E0']},'AFC_lane stale':{prep:true}});
    assert.equal(next['AFC_lane E0'].material,'ASA');assert.equal(next['AFC_lane E0'].color,'#FF8800');
    assert.deepEqual(next.AFC.lanes,['E0']);assert.equal(next['AFC_lane stale'],undefined);assert.equal(u1['AFC_lane E0'].color,'#161616');
    assert.equal(filamentColor('url(bad)'),'#7c8780');assert.equal(filamentColor('ff8800'),'#ff8800');
});
test('all controls fail closed on unknown readiness, jobs, motion, or AFC activity', () => {
    assert.equal(afcControlBlock(ready()),'');
    for (const change of [{webhooks:{}},{print_stats:{}},{print_stats:{state:'printing'}},{print_stats:{state:'paused'}},{virtual_sdcard:{is_active:true}},{pause_resume:{is_paused:true}},{idle_timeout:{state:'Printing'}},{idle_timeout:null},{AFC:{current_state:'ToolSwap'}},{AFC:{current_state:'Error'}},{AFC:{current_state:'Idle',error_state:true}}]) assert.ok(afcControlBlock({...ready(),...change}));
    assert.equal(afcControlBlock({...ready(),AFC:{current_state:'Error',error_state:true}},{allowError:true}),'');
});
test('lane actions use AFC commands and reject unsupported, missing or incompatible targets', () => {
    const s=ready();assert.equal(afcScript(s,'load',{lane:'E0'}),'CHANGE_TOOL LANE=E0');
    assert.equal(afcScript(s,'unload',{lane:'E0'}),'TOOL_UNLOAD LANE=E0');
    assert.equal(afcScript(s,'eject',{lane:'E3'}),'LANE_UNLOAD LANE=E3');
    assert.throws(()=>afcScript(s,'load',{lane:'E1'}),/already active/);
    assert.throws(()=>afcScript(s,'load',{lane:'E3'}),/Prepare/);
    assert.throws(()=>afcScript(s,'eject',{lane:'E0'}),/Unload/);
    assert.throws(()=>afcScript(s,'unload',{lane:'missing'}),/no longer/);
    delete s.gcode.commands.TOOL_UNLOAD;assert.throws(()=>afcScript(s,'unload',{lane:'E0'}),/not available/);
    assert.throws(()=>afcScript(s,'arbitrary',{lane:'E0'}));
});
test('filament edits validate numeric values, clear spool assignment, quote materials and reject injection', () => {
    const s=ready();assert.equal(afcScript(s,'filament',{lane:'E0',changes:{color:'#fF8800',material:'PETG CF',weight:0,spool_id:0}}),'SET_COLOR LANE=E0 COLOR=fF8800\nSET_MATERIAL LANE=E0 MATERIAL="PETG CF"\nSET_WEIGHT LANE=E0 WEIGHT=0\nSET_SPOOL_ID LANE=E0 SPOOL_ID=');
    for(const changes of [{material:'PLA\nG28'},{material:'PLA;G28'},{material:'"PLA"'},{color:'invalid'},{weight:NaN},{weight:-1},{weight:''},{spool_id:1.5},{spool_id:-1},{arbitrary:'G28'},{}]) assert.throws(()=>afcScript(s,'filament',{lane:'E0',changes}));
});
test('mapping and backup lanes validate choices against fresh status', () => {
    const s=ready();assert.equal(afcScript(s,'map',{lane:'E0',tool:'T4'}),'SET_MAP LANE=E0 MAP=T4');
    assert.equal(afcScript(s,'runout',{lane:'E0',runout:'E1'}),'SET_RUNOUT LANE=E0 RUNOUT=E1');
    assert.equal(afcScript(s,'runout',{lane:'E0',runout:'NONE'}),'SET_RUNOUT LANE=E0 RUNOUT=NONE');
    for(const runout of ['E0','E3','unknown','E1\nG28']) assert.throws(()=>afcScript(s,'runout',{lane:'E0',runout}));
    for(const tool of ['T-1','T1\nG28','T1000']) assert.throws(()=>afcScript(s,'map',{lane:'E0',tool}));
});


test('toolchanger selection checks available AFC extruders and mounted state', () => {
    const s=ready();s.gcode.commands.AFC_SELECT_TOOL={};s.gcode.commands.AFC_UNSELECT_TOOL={};
    s['AFC_extruder extruder']={on_shuttle:false};
    assert.equal(afcScript(s,'select',{tool:'extruder'}),'AFC_SELECT_TOOL TOOL=extruder');
    assert.throws(()=>afcScript(s,'select',{tool:'missing'}));
    assert.throws(()=>afcScript(s,'unselect'),/mounted/);
    s['AFC_extruder extruder'].on_shuttle=true;
    assert.equal(afcScript(s,'unselect'),'AFC_UNSELECT_TOOL');
    assert.throws(()=>afcScript(s,'select',{tool:'extruder'}));
});
