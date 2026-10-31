import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { compile } from 'svelte/compiler';
import { render } from 'svelte/server';

// Render the actual component to catch template interpolation changing HTML rules.
const storage = new Map();
globalThis.localStorage = {getItem:key=>storage.get(key)||null,setItem:(key,value)=>storage.set(key,value)};
globalThis.window = {location:{hostname:'localhost',protocol:'http:'},addEventListener(){}};
globalThis.document = {addEventListener(){}};

test('the AFC mapping form renders a literal pattern accepting T1 and rejecting invalid tool names', async () => {
    const url = new URL('../src/lib/components/ui/AfcLaneDialog.svelte',import.meta.url);
    const source = await readFile(url,'utf8');
    const compiled = compile(source,{generate:'server',filename:url.pathname}).js.code;
    const moduleSource = compiled.replace(/from (['"])([^'"]+)\1/g,(_,quote,specifier)=>`from ${quote}${specifier.startsWith('.') ? new URL(specifier,url).href : import.meta.resolve(specifier)}${quote}`);
    const component = await import('data:text/javascript;base64,' + Buffer.from(moduleSource).toString('base64'));
    const {body}=render(component.default,{props:{lane:{name:'lane1',color:'#ffffff',tools:['T0']},commands:{SET_MAP:{}},lanes:[],close(){}}});
    const pattern = /pattern="([^"]+)"/.exec(body)?.[1];
    assert.equal(pattern,'T[0-9]{1,3}');
    const rule = new RegExp(`^(?:${pattern})$`,'v');
    for (const value of ['T0','T1','T12','T999']) assert.equal(rule.test(value),true,value);
    for (const value of ['','T-1','T1000','T1\nG28']) assert.equal(rule.test(value),false,value);
});
