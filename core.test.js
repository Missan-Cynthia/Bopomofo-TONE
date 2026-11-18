import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { parseList, candidates, shuffled, recordAnswer } from './public/core.js';
import { computerProgress, modes } from './public/modes.js';

test('six missions and computer race progress support first answers and retries', () => {
  assert.equal(new Set(modes.map(mode => mode.id)).size,6);
  let computer = 0;
  for (let round = 1; round <= 5; round++) computer = computerProgress(round,true,computer,5);
  assert.equal(computer,2);
  computer = 0;
  for (let round = 1; round <= 5; round++) computer = computerProgress(round,false,computer,5);
  assert.equal(computer,5);
});

test('imports exactly the supplied tones and retains source order and stable IDs', () => {
  const { entries, neutral } = parseList('ㄆㄚˋ，ㄅㄚˉ\nㄆㄚˊ ㄆㄚˋ ˙ㄇㄚ');
  assert.deepEqual(entries.map(row => [row.base,row.tone]), [['ㄆㄚ',4],['ㄅㄚ',1],['ㄆㄚ',2]]);
  assert.equal(entries[1].id, parseList('ㄅㄚ').entries[0].id);
  assert.equal(neutral,1);
  assert.throws(() => parseList('ㄅㄚˋ invalid'));
});

test('the bundled reference list preserves all 1,151 non-neutral readings', async () => {
  const list = await readFile(new URL('./public/assets/reference.txt', import.meta.url), 'utf8');
  assert.equal(parseList(list).entries.length, 1151);
});

test('only approved brother audio precedes mother audio', () => {
  const mother = { key:'a' };
  for (const status of ['pending','redo','inactive']) {
    assert.deepEqual(candidates({ mother, brother:{ key:'b',status } }), [['mother',mother]]);
    assert.deepEqual(candidates({ brother:{ key:'b',status } }), []);
  }
  const brother = { key:'b',status:'approved' };
  assert.deepEqual(candidates({ mother,brother }), [['brother',brother],['mother',mother]]);
});

test('initially wrong answers remain wrong after retries and correction', () => {
  let row = { correctTone:3, attempts:[], wrongCount:0, firstCorrect:null, playCount:4 };
  for (const tone of [2,4,3]) row = recordAnswer(row,tone,'2026-11-17T05:00:00Z');
  assert.equal(row.firstCorrect,false);
  assert.equal(row.wrongCount,2);
  assert.equal(row.selectedTone,3);
  assert.equal(row.playCount,4);
  assert.deepEqual(row.attempts.map(attempt => attempt.correct),[false,false,true]);
});

test('answer shuffling returns each tone and preserves the original array', () => {
  const choices = [1,2,3,4];
  assert.deepEqual(shuffled(choices, () => 0),[2,3,4,1]);
  assert.deepEqual(choices,[1,2,3,4]);
});

test('PWA assets exist and the PNG sizes match the manifest', async () => {
  const at = path => new URL('./public/' + path, import.meta.url);
  const manifest = JSON.parse(await readFile(at('manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.scope,manifest.start_url);
  assert.equal(manifest.display,'standalone');
  for (const icon of manifest.icons) {
    const image = await readFile(at(icon.src));
    assert.equal(image.readUInt32BE(16) + 'x' + image.readUInt32BE(20),icon.sizes);
  }
  const worker = await readFile(at('sw.js'), 'utf8');
  const files = [...worker.matchAll(/'\.\/([^']+)'/g)].map(match => match[1]);
  await Promise.all(files.map(file => readFile(at(file))));
});
