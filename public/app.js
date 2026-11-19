import { parseList, candidates, shuffled, recordAnswer, spelling, tones, settings } from './core.js';
import { local } from './local.js';
import { firebaseConfig } from './cloud-config.js';
import { microphone, wav, playable, wakeAudio, chime } from './audio.js';
import { renderScene, extinguish, truck } from './scene.js';
import { modes, characters, computerProgress, decorateScene, updateScene, beginComputerTurn, computerTurnMs } from './modes.js';

const pagesPreview = location.hostname === 'missan-cynthia.github.io';
const cloudConfig = pagesPreview ? null : firebaseConfig;
const $ = id => document.getElementById(id);
const player = $('player');
$('preview-mode').hidden = !pagesPreview;
const screens = ['home','missions','material','game','done','history','login'];
let selectedMode = modes[0], selectedCharacter = characters[0];
let screen, store, cloud, catalog = [], meta = {}, groups = new Map();
let role = 'mother', group = 0, recording, draft, busy = false;
let mission, run = 0, objectUrl, mediaVersion = 0, installPrompt;
let sound = localStorage.getItem('rescue-sound') !== 'off';

function show(name) {
  screen = name;
  for (const id of screens) $(id).hidden = id !== name;
  window.scrollTo(0,0);
}
function notice(message = '') {
  $('system-status').textContent = message;
  $('system-status').hidden = !message;
}
function pause() {
  mediaVersion++;
  $('material-play-retry').hidden = true;
  player.pause();
  player.removeAttribute('src');
  player.load();
  if (objectUrl) URL.revokeObjectURL(objectUrl);
  objectUrl = undefined;
}
async function prepare(blob) {
  if (!(blob instanceof Blob) || !blob.size) throw Error('找不到錄音。');
  pause();
  objectUrl = URL.createObjectURL(blob);
  await playable(player, objectUrl);
}
function goHome() {
  if (busy || !store) return;
  run++;
  mission = undefined;
  draft = undefined;
  pause();
  notice();
  show('home');
}
async function refresh() {
  [catalog, meta] = await Promise.all([store.catalog(), store.metadata()]);
  groups = new Map();
  for (const entry of catalog) {
    if (!groups.has(entry.base)) groups.set(entry.base, []);
    groups.get(entry.base).push(entry);
  }
  group = Math.max(0, Math.min(group, groups.size - 1));
}
function report(error) {
  console.error(error);
  notice(error.message || '操作未完成，請重試。');
}
function event(id, type, action) {
  $(id).addEventListener(type, async e => {
    try { await action(e); } catch (error) { report(error); }
  });
}

function material() {
  const rows = catalog.map(entry => meta[entry.id]);
  const count = predicate => rows.filter(predicate).length;
  const counts = [
    ['教材總筆數', rows.length], ['媽媽已錄製', count(row => row?.mother)],
    ['哥哥已錄製', count(row => row?.brother)], ['哥哥已驗收', count(row => row?.brother?.status === 'approved')],
    ['尚未錄製（兩人皆未錄）', count(row => !row?.mother && !row?.brother)],
    ['待驗收', count(row => row?.brother?.status === 'pending')],
    ['需要重錄', count(row => row?.brother?.status === 'redo')]
  ];
  $('stats').innerHTML = counts.map(([label, number]) => '<div><strong>' + number + '</strong><span>' + label + '</span></div>').join('');
  $('lesson').hidden = !groups.size;
  if (!groups.size) { $('import-panel').open = true; return; }
  $('group').replaceChildren(...[...groups.keys()].map((base, index) => new Option(base, index)));
  $('group').selectedIndex = group;
  $('mother').setAttribute('aria-pressed', role === 'mother');
  $('brother').setAttribute('aria-pressed', role === 'brother');
  for (const id of ['mother','brother','group','import','reference','list-file']) $(id).disabled = busy;
  $('previous').disabled = busy || group === 0;
  $('next').disabled = busy || group >= groups.size - 1;

  const [base, entries] = [...groups.entries()][group];
  const button = (action, label) => '<button data-action="' + action + '">' + label + '</button>';
  $('lesson-cards').innerHTML = tones.map(tone => {
    const entry = entries.find(item => item.tone === tone);
    const mark = '<h2>' + spelling(base, tone) + '</h2>';
    if (!entry) return '<article class="tone-card missing">' + mark + '<p>清單未收錄</p></article>';
    const row = meta[entry.id];
    const saved = row?.[role];
    const labels = { ready:'已儲存', pending:'待驗收', approved:'已驗收', redo:'需要重錄', inactive:'已停用' };
    const current = draft?.id === entry.id;
    const active = recording?.id === entry.id;
    let actions = '';
    if (active) actions = button('stop', '■ 結束錄音');
    else if (!busy) {
      actions = button('record', saved || current ? '● 重新錄音' : '● 開始錄音');
      if (current) actions += button('preview', '▶ 試聽草稿') + button('save', '確認儲存');
      if (saved) actions += button('play', '▶ 播放已存錄音');
      if (role === 'brother' && saved) {
        if (saved.status !== 'approved') actions += button('approved', '驗收並使用');
        if (saved.status !== 'redo') actions += button('redo', '退回重錄');
        if (saved.status === 'approved') actions += button('inactive', '切回媽媽音源');
      }
    }
    const source = candidates(row)[0]?.[0];
    return '<article class="tone-card" data-id="' + entry.id + '">' + mark +
      '<p>' + (active ? '錄音中' : current ? '草稿待儲存' : saved ? labels[saved.status] : '尚未錄製') + '</p>' +
      '<small>' + (source === 'brother' ? '預設播放哥哥' : source ? '預設播放媽媽' : '尚無預設音源') + '</small><div>' + actions + '</div></article>';
  }).join('');
}

async function startRecording(id) {
  wakeAudio();
  pause();
  busy = true;
  material();
  $('material-status').textContent = '等待麥克風授權…';
  try {
    const session = await microphone();
    recording = { id, stop: session.stop };
    material();
    $('material-status').textContent = '正在錄音，最長 8 秒。';
    const blob = await session.blob;
    recording = undefined;
    material();
    $('material-status').textContent = '正在處理錄音…';
    const normalized = await wav(blob);
    await prepare(normalized);
    draft = { id, blob: normalized };
    $('material-status').textContent = '請先試聽，再確認儲存。';
  } catch (error) {
    const messages = {
      NotFoundError: '找不到麥克風，請確認已連接錄音裝置。',
      NotAllowedError: '請允許網站使用麥克風後再試一次。',
      NotReadableError: '麥克風目前無法使用，請關閉使用麥克風的其他程式。'
    };
    $('material-status').textContent = '錄音未完成。' + (messages[error.name] || error.message || '');
  } finally {
    recording = undefined;
    busy = false;
    material();
  }
}

event('lesson-cards','click', async e => {
  const button = e.target.closest('button[data-action]');
  if (!button) return;
  const { action } = button.dataset;
  const { id } = button.closest('[data-id]').dataset;
  const status = $('material-status');
  if (action === 'stop') { recording?.stop(); return; }
  if (busy) return;
  if (action === 'record') { await startRecording(id); return; }
  busy = true;
  material();
  try {
    if (action === 'preview' || action === 'play') {
      const blob = action === 'preview' ? draft.blob : await store.audio(meta[id][role].key);
      await prepare(blob);
      await player.play();
    } else if (action === 'save') {
      const key = [id, role, crypto.randomUUID()].join('-') + '.wav';
      await store.saveAudio(id, role, key, draft.blob);
      draft = undefined;
      await refresh();
      status.textContent = '錄音已儲存。';
    } else {
      const { key } = meta[id].brother;
      if (action === 'approved') await prepare(await store.audio(key));
      await store.review(id, key, action);
      await refresh();
      status.textContent = '已更新預設播放音源。';
    }
  } catch (error) {
    if (error.name === 'NotAllowedError' && (action === 'preview' || action === 'play')) {
      $('material-play-retry').hidden = false;
      status.textContent = '錄音已載入，請點一下播放。';
    } else status.textContent = '操作未完成。' + (error.message || '');
  } finally {
    busy = false;
    material();
  }
});
event('material-play-retry','click', async () => {
  player.currentTime = 0;
  await player.play();
  $('material-status').textContent = '';
});
function changeLesson(action) {
  if (busy) return;
  pause();
  draft = undefined;
  $('material-status').textContent = '';
  action();
  material();
}
event('mother','click', () => changeLesson(() => { role = 'mother'; }));
event('brother','click', () => changeLesson(() => { role = 'brother'; }));
event('previous','click', () => changeLesson(() => { group--; }));
event('next','click', () => changeLesson(() => { group++; }));
event('group','change', e => changeLesson(() => { group = Number(e.target.value); }));
event('list-file','change', async e => {
  const file = e.target.files[0];
  if (file) $('list').value = await file.text();
  e.target.value = '';
});
event('reference','click', async () => {
  const response = await fetch('./assets/reference.txt');
  if (!response.ok) throw Error('無法讀取參考清單。');
  $('list').value = await response.text();
});
event('import','click', async () => {
  if (busy) return;
  notice();
  const { entries, neutral } = parseList($('list').value);
  busy = true;
  $('import').disabled = true;
  try {
    await store.setCatalog(entries);
    draft = undefined;
    group = 0;
    await refresh();
    $('import-panel').open = false;
    notice('已匯入 ' + entries.length + ' 筆。' + (neutral ? ' 已略過 ' + neutral + ' 筆輕聲。' : ''));
  } finally {
    busy = false;
    $('import').disabled = false;
    material();
  }
});

const delay = ms => new Promise(resolve => setTimeout(resolve, matchMedia('(prefers-reduced-motion: reduce)').matches ? Math.min(ms,150) : ms));
const gameStatus = message => { $('game-status').textContent = message; };
function progress() {
  $('progress').textContent = mission.completed.length + ' / ' + settings.fires + ' ' + mission.mode.unit;
  $('versus').textContent = (['mud','ladder'].includes(mission.mode.id) ? '電腦隊友　' : '電腦對手　') +
    mission.character.name + (mission.mode.id === 'race' ? '　我方 ' + mission.completed.length + '：' + mission.computer + ' 電腦' : '　一起聽清楚再行動');
}
function chooseMission() {
  run++;
  mission = undefined;
  pause();
  notice();
  $('mission-map').innerHTML = modes.map(mode => '<button data-mode="' + mode.id + '" aria-pressed="' +
    (selectedMode.id === mode.id) + '"><span>' + mode.icon + '</span><strong>' + mode.name + '</strong><small>' + mode.description + '</small></button>').join('');
  $('characters').innerHTML = characters.map(character => '<button data-character="' + character.id + '" aria-pressed="' +
    (selectedCharacter.id === character.id) + '" style="--rival-color:' + character.color + '"><div class="character-truck" aria-hidden="true">' +
    truck() + '</div>' + character.name + '</button>').join('');
  $('character-title').textContent = ['mud','ladder'].includes(selectedMode.id) ? '選一位電腦隊友' : '選一位電腦對手';
  show('missions');
}
function lockAnswers(locked) {
  for (const button of $('choices').children) button.disabled = locked;
}
async function startGame() {
  if (busy || !store || (screen === 'game' && mission)) return;
  wakeAudio();
  notice();
  const token = ++run;
  const data = await store.metadata();
  if (token !== run) return;
  const pool = catalog.filter(entry => candidates(data[entry.id]).length);
  if (!pool.length) {
    show('home');
    notice('題庫還沒有錄音。請先到「教材錄音」儲存媽媽的錄音，或驗收哥哥的錄音。');
    return;
  }
  mission = { id: crypto.randomUUID(), mode:selectedMode, character:selectedCharacter, computer:0, data, pool, queue: [], cache: new Map(), bad: new Set(), completed: [], intro: true };
  $('choices').replaceChildren();
  $('listen').disabled = true;
  $('skip').hidden = false;
  renderScene($('scene'), settings.fires);
  decorateScene($('scene'), selectedMode, selectedCharacter, settings.fires);
  $('scene').className = 'mission-scene intro';
  $('mission-name').textContent = selectedMode.name;
  progress();
  gameStatus('消防局收到救援通報！');
  show('game');
  await delay(settings.introMs);
  if (token === run && mission.intro) await leaveIntro();
}
async function leaveIntro() {
  if (!mission?.intro) return;
  mission.intro = false;
  $('skip').hidden = true;
  $('scene').classList.replace('intro','arrived');
  await nextQuestion();
}
async function getBlob(current, key) {
  if (!current.cache.has(key)) {
    const blob = await store.audio(key);
    if (!(blob instanceof Blob) || !blob.size) throw Error('找不到錄音。');
    current.cache.set(key, blob);
  }
  return current.cache.get(key);
}
async function nextQuestion() {
  const token = run;
  const current = mission;
  current.question = undefined;
  current.locked = true;
  $('choices').replaceChildren();
  $('listen').disabled = true;
  gameStatus('準備題目中…');
  if (!current.queue.length) current.queue = shuffled(current.pool);
  while (current.queue.length) {
    const entry = current.queue.shift();
    for (const [source, { key }] of candidates(current.data[entry.id])) {
      if (current.bad.has(key)) continue;
      try {
        const blob = await getBlob(current, key);
        if (token !== run) return;
        await prepare(blob);
      } catch {
        if (token !== run) return;
        current.bad.add(key);
        continue;
      }
      if (token !== run) return;
      current.question = {
        id: crypto.randomUUID(), questionId: entry.id, base: entry.base, correctTone: entry.tone,
        source, missionId: current.id, mode:current.mode.id, character:current.character.id,
        firstCorrect: null, wrongCount: 0, playCount: 0, attempts: []
      };
      for (const tone of shuffled(tones)) {
        const button = document.createElement('button');
        button.textContent = spelling(entry.base, tone);
        button.dataset.tone = tone;
        button.disabled = true;
        $('choices').append(button);
      }
      current.locked = false;
      gameStatus('聽完後，選出聽到的聲調。');
      await listen();
      return;
    }
  }
  if (current.pool.some(entry => candidates(current.data[entry.id]).some(([, value]) => !current.bad.has(value.key)))) {
    await nextQuestion();
    return;
  }
  goHome();
  notice('目前的教材錄音無法播放。請到教材頁試聽或重新錄製。');
}
async function listen() {
  const current = mission;
  if (!current?.question || current.locked || current.listening) return;
  const version = mediaVersion;
  const question = current.question;
  current.listening = true;
  $('listen').disabled = true;
  try {
    player.currentTime = 0;
    await player.play();
    if (current !== mission || version !== mediaVersion) return;
    current.question = { ...question, playCount: question.playCount + 1 };
    lockAnswers(false);
    if (question.attempts.length) await store.saveAnswer(current.question);
  } catch (error) {
    if (current !== mission || version !== mediaVersion) return;
    if (error.name === 'NotAllowedError') gameStatus('點一下「聽題目」開始播放。');
    else gameStatus('播放未完成，請再點一次「聽題目」。');
  } finally {
    if (current === mission && version === mediaVersion) {
      current.listening = false;
      $('listen').disabled = false;
    }
  }
}

event('choices','click', async event => {
  const button = event.target.closest('button');
  const current = mission;
  if (!button || !current?.question || current.locked || current.listening) return;
  const tone = Number(button.dataset.tone);
  const revised = recordAnswer(current.question, tone);
  const correct = tone === revised.correctTone;
  current.locked = true;
  player.pause();
  lockAnswers(true);
  $('listen').disabled = true;
  try {
    await store.saveAnswer(revised);
  } catch {
    if (current !== mission) return;
    gameStatus('作答儲存失敗，請再選一次。');
    current.locked = false;
    lockAnswers(false);
    $('listen').disabled = false;
    return;
  }
  if (current !== mission) return;
  current.question = revised;
  if (!correct) {
    button.classList.add('wrong');
    gameStatus('再聽一次，試試看！');
    await delay(settings.wrongMs);
    if (current !== mission) return;
    button.classList.remove('wrong');
    current.locked = false;
    await listen();
    return;
  }
  gameStatus('答對了！' + current.mode.action);
  chime(true, sound);
  const scene = $('scene');
  scene.classList.add('player-action');
  const finish = ['race','mud','water','tug'].includes(current.mode.id) ? extinguish(scene, current.completed.length) : () => {};
  await delay(settings.sprayMs);
  if (current !== mission) return;
  finish();
  scene.classList.remove('player-action');
  current.completed.push(revised);
  updateScene(scene, current.completed.length, settings.fires, current.computer);
  const nextComputer = computerProgress(current.completed.length, revised.firstCorrect, current.computer, settings.fires);
  const actions = {
    water:'回噴水柱！', tug:'加大水柱，把浮球推回來！',
    race:nextComputer > current.computer ? '噴水滅火！' : '正在瞄準，這次沒有滅掉火焰！',
    chase:'加速通過彎道！', mud:'接力沖洗泥巴！', ladder:'接住小動物，送回安全區！'
  };
  gameStatus(current.character.name + actions[current.mode.id]);
  const finishComputer = beginComputerTurn(scene, current.mode.id, current.computer, nextComputer, current.completed.length);
  await delay(computerTurnMs);
  finishComputer();
  if (current !== mission) return;
  current.computer = nextComputer;
  updateScene(scene, current.completed.length, settings.fires, current.computer);
  progress();
  if (current.completed.length < settings.fires) await nextQuestion();
  else {
    pause();
    chime(false, sound);
    $('result-title').textContent = current.mode.id === 'race' ?
      (current.computer === settings.fires ? '兩隊一起完成！' : '滅火賽勝利！') : current.mode.ending;
    $('summary').textContent = current.mode.name + '完成 ' + current.completed.length + ' 題，第一次答對 ' +
      current.completed.filter(row => row.firstCorrect).length + ' 題。' +
      (current.mode.id === 'race' ? ' 我方 ' + current.completed.length + '：' + current.computer + ' 電腦。' : '');
    showRecords($('results'), current.completed);
    show('done');
  }
});

function showRecords(target, records, showDate = false) {
  target.replaceChildren();
  if (!records.length) { target.textContent = '目前沒有作答紀錄。'; return; }
  for (const row of records) {
    const item = document.createElement('div');
    item.className = 'record-row';
    const title = document.createElement('strong');
    title.textContent = spelling(row.base, row.correctTone);
    const detail = document.createElement('span');
    detail.textContent = (row.firstCorrect ? '初次答對' : '初次答錯') + ' · 答錯 ' + row.wrongCount + ' 次 · 播放 ' +
      row.playCount + ' 次 · ' + (row.source === 'mother' ? '媽媽' : '哥哥') + '錄音';
    const attempts = document.createElement('small');
    attempts.textContent = '作答順序　' + row.attempts.map(attempt => spelling(row.base, attempt.tone) + (attempt.correct ? ' ✓' : ' ✗')).join('、') +
      (showDate ? ' · ' + new Date(row.answeredAt).toLocaleString('zh-TW') : '');
    item.append(title,detail,attempts);
    target.append(item);
  }
}

event('open-material','click', async () => { notice(); await refresh(); material(); show('material'); });
event('open-history','click', async () => {
  notice();
  const rows = (await store.answers()).sort((a,b) => b.answeredAt.localeCompare(a.answeredAt));
  $('history-list').replaceChildren();
  const grouped = Map.groupBy ? Map.groupBy(rows, row => row.missionId) : rows.reduce((map,row) => {
    if (!map.has(row.missionId)) map.set(row.missionId,[]);
    map.get(row.missionId).push(row);
    return map;
  }, new Map());
  for (const entries of grouped.values()) {
    const panel = document.createElement('article');
    panel.className = 'panel history-mission';
    const title = document.createElement('h2');
    const first = entries.at(-1);
    title.textContent = (modes.find(mode => mode.id === first.mode)?.name || '救援紀錄') + ' · ' +
      (characters.find(character => character.id === first.character)?.name || '') + '　' + new Date(first.answeredAt).toLocaleString('zh-TW');
    const list = document.createElement('div');
    showRecords(list, entries.reverse(), true);
    panel.append(title,list);
    $('history-list').append(panel);
  }
  if (!rows.length) $('history-list').textContent = '目前沒有作答紀錄。';
  show('history');
});
event('start','click',chooseMission);
event('change-mission','click',chooseMission);
event('launch','click',startGame);
event('mission-map','click', e => {
  const id = e.target.closest('[data-mode]')?.dataset.mode;
  if (id) { selectedMode = modes.find(mode => mode.id === id); chooseMission(); }
});
event('characters','click', e => {
  const id = e.target.closest('[data-character]')?.dataset.character;
  if (id) { selectedCharacter = characters.find(character => character.id === id); chooseMission(); }
});
event('again','click',startGame);
event('skip','click',leaveIntro);
event('listen','click',listen);
event('brand','click',goHome);
for (const button of document.querySelectorAll('[data-home]')) button.onclick = goHome;
function soundLabel() {
  $('sound').setAttribute('aria-pressed', sound);
  $('sound').textContent = sound ? '♫ 音效開啟' : '♫ 音效關閉';
}
event('sound','click', () => { sound = !sound; localStorage.setItem('rescue-sound', sound ? 'on' : 'off'); soundLabel(); });
soundLabel();

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
  $('install').hidden = false;
});
window.addEventListener('appinstalled', () => { installPrompt = undefined; $('install').hidden = true; });
event('install','click', async () => {
  if (!installPrompt) return;
  await installPrompt.prompt();
  installPrompt = undefined;
  $('install').hidden = true;
});
document.addEventListener('visibilitychange', () => { if (document.hidden) recording?.stop(); });
if ('serviceWorker' in navigator) navigator.serviceWorker.register('./sw.js', { updateViaCache: 'none' }).catch(console.error);
renderScene($('home-scene'), 2, true);

async function account(next) {
  run++;
  mission = undefined;
  recording?.stop();
  pause();
  store = next;
  $('signout').hidden = !cloudConfig || !store;
  notice();
  if (!store) { show('login'); return; }
  await refresh();
  show('home');
}
event('login-form','submit', async e => {
  e.preventDefault();
  const values = new FormData(e.target);
  try { await cloud.signIn(values.get('email'), values.get('password')); e.target.reset(); }
  catch { notice('登入失敗。請確認家庭帳號、密碼及網路連線。'); }
});
event('signout','click', async () => { if (!busy) await cloud.signOut(); });
try {
  if (cloudConfig) {
    const { connect } = await import('./cloud.js');
    cloud = await connect(cloudConfig, next => account(next).catch(report));
  } else await account(local);
} catch (error) {
  report(error);
}
