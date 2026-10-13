import assert from 'node:assert/strict';
import test from 'node:test';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { MinecraftText, minecraftTextRuns } from '../src/precision/MinecraftText.ts';

test('legacy MOTD codes become spans, preserving two lines and formatting resets', () => {
  const runs = minecraftTextRuns([{text:'§b§lAxora§r Network\n§cSeason 4'}]);
  assert.deepEqual(runs.map(run=>run.text), ['Axora',' Network\n','Season 4']);
  assert.equal(runs[0].color, '#55ffff');
  assert.equal(runs[0].bold, true);
  assert.equal(runs[1].color, undefined);
  assert.equal(runs[1].bold, undefined);
  assert.equal(runs[2].color, '#ff5555');
});

test('native component runs retain their inherited styles and render untrusted text safely', () => {
  const markup = renderToStaticMarkup(createElement(MinecraftText, {
    runs:[{text:'Network',color:'#00aaaa',bold:true},{text:'\n<script>bad()</script>',italic:true}],
  }));
  assert.match(markup,/color:#00aaaa/);
  assert.match(markup,/font-weight:700/);
  assert.match(markup,/font-style:italic/);
  assert.match(markup,/&lt;script&gt;bad\(\)&lt;\/script&gt;/);
  assert.doesNotMatch(markup,/<script/);
});

test('invalid styles and excessive text never become CSS or active markup', () => {
  const runs = minecraftTextRuns([{text:'§xTest\u0000',color:'url(https://example.net)',bold:true}]);
  assert.equal(runs.map(run=>run.text).join(''),'Test');
  assert.equal(runs[0].color,undefined);
  assert.ok(minecraftTextRuns([{text:'x'.repeat(10000)}]).map(run=>run.text).join('').length<=2048);
});
