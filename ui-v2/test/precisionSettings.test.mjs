import test from 'node:test';
import assert from 'node:assert/strict';
import { classifyMinecraftOption, filterMinecraftOptions, shouldBlurWorld } from '../src/precision/settingsModel.ts';

test('real Minecraft sound channels belong only to Music & sounds', () => {
  const option = { key: 'SOUND:music', label: 'Music', type: 'float', value: .3, min: 0, max: 1, step: .01 };
  assert.equal(classifyMinecraftOption(option).page, 'audio');
  assert.deepEqual(filterMinecraftOptions([option], 'display', ''), []);
  assert.equal(filterMinecraftOptions([option], 'audio', '')[0].value, .3);
});

test('OptiFine options retain their owning sections and unknown host controls remain discoverable', () => {
  const options = [{key:'CUSTOM_FONTS', label:'Custom fonts'}, {key:'MOD_CUSTOM',label:'My option'}];
  assert.equal(classifyMinecraftOption(options[0]).page, 'quality');
  assert.equal(filterMinecraftOptions(options, 'quality', 'font').length, 1);
  assert.equal(filterMinecraftOptions(options, 'other', '')[0].key, 'MOD_CUSTOM');
});

test('only game overlays blur the world, including the RShift editor', () => {
  for (const route of ['hud_editor','game_menu','settings','mods_catalog','module_detail']) assert.equal(shouldBlurWorld(route, true), true);
  assert.equal(shouldBlurWorld('hud_editor', false), false);
  assert.equal(shouldBlurWorld('multiplayer', true), false);
});

const { minecraftKeyCode } = await import('../src/precision/keyCapture.ts');
test('key capture maps Minecraft physical bindings without consuming Escape or guessing unknown keys',()=>{
  assert.equal(minecraftKeyCode({code:'KeyW',key:'w',location:0}),17);
  assert.equal(minecraftKeyCode({code:'ShiftRight',key:'Shift',location:2}),54);
  assert.equal(minecraftKeyCode({code:'',key:'ArrowUp',location:0}),200);
  assert.equal(minecraftKeyCode({code:'Escape',key:'Escape',location:0}),null);
  assert.equal(minecraftKeyCode({code:'Unidentified',key:'Unidentified',location:0}),null);
});
