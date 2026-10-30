import test from 'node:test';
import assert from 'node:assert/strict';
import { absoluteMoveScript, motorEnableState } from '../src/lib/motion.js';
const status = () => ({webhooks:{state:'ready'},print_stats:{state:'standby'},virtual_sdcard:{is_active:false},pause_resume:{is_paused:false},
    toolhead:{homed_axes:'xyz',axis_minimum:[-5,-5,0],axis_maximum:[270,270,280],max_velocity:300},
    gcode_move:{position:[100,110,20,0],gcode_position:[90,110,19.8,0],speed_factor:2}});
test('absolute moves translate machine targets through offsets and preserve G-code modes', () => {
    const script = absoluteMoveScript(status(),'X',125);
    assert.equal(script,'SAVE_GCODE_STATE NAME=retro_absolute_move\nG90\nG1 X115.000000 F1500.000\nRESTORE_GCODE_STATE NAME=retro_absolute_move');
    assert.match(absoluteMoveScript(status(),'z',30,{printer:{max_z_velocity:5}}),/G1 Z29\.800000 F150\.000/);
});
test('absolute moves reject unhomed, active, unknown, invalid and out-of-range state', () => {
    for (const target of ['',null,undefined,NaN,Infinity,-6,271,'125\nG28']) assert.throws(() => absoluteMoveScript(status(),'x',target));
    assert.throws(() => absoluteMoveScript(status(),'e',10));
    for (const modify of [s=>s.toolhead.homed_axes='yz',s=>s.print_stats.state='printing',s=>s.print_stats.state='paused',s=>s.print_stats.state='unknown',s=>s.webhooks.state='shutdown',s=>s.virtual_sdcard.is_active=true,s=>s.pause_resume.is_paused=true,s=>delete s.toolhead.axis_maximum,s=>delete s.gcode_move.gcode_position,s=>s.gcode_move.speed_factor=0]) {
        const s = status(); modify(s); assert.throws(() => absoluteMoveScript(s,'x',100));
    }
});
test('motor feedback distinguishes enabled, disabled, mixed and unknown without inferring homing', () => {
    assert.equal(motorEnableState(null),'unknown');
    assert.equal(motorEnableState({}),'unknown');
    assert.equal(motorEnableState({stepper_x:true,stepper_y:true}),'on');
    assert.equal(motorEnableState({stepper_x:false,stepper_y:false}),'off');
    assert.equal(motorEnableState({stepper_x:true,extruder:false}),'mixed');
    assert.equal(motorEnableState({stepper_x:null}),'unknown');
});
