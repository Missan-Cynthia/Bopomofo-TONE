export const modes = [
  { id:'water', name:'消防車水戰', icon:'💦', description:'聽對聲調，噴水命中電腦車！', action:'水柱命中！', ending:'水戰勝利！', unit:'次命中' },
  { id:'tug', name:'水柱拔河', icon:'🔵', description:'用大水柱把浮球推過終點。', action:'浮球往前推進！', ending:'浮球到達終點！', unit:'次推進' },
  { id:'race', name:'雙隊滅火賽', icon:'🔥', description:'和電腦消防隊比賽滅火。', action:'撲滅一處火焰！', ending:'救援完成！', unit:'處滅火' },
  { id:'chase', name:'消防車追逐賽', icon:'🏁', description:'跨過路障，加速追上前車！', action:'加速跨過路障！', ending:'追上前車了！', unit:'次加速' },
  { id:'mud', name:'合作洗泥巴怪', icon:'🫧', description:'和電腦隊友一起幫泥巴怪洗澡。', action:'一起沖掉泥巴！', ending:'泥巴怪洗乾淨了！', unit:'塊泥巴' },
  { id:'ladder', name:'雲梯動物救援', icon:'🐱', description:'升起雲梯，把小動物接回來。', action:'小動物安全下樓！', ending:'小動物全都平安！', unit:'隻動物' }
];
export const characters = [
  { id:'blue', name:'藍車隊長', color:'#387bb5' },
  { id:'green', name:'綠車隊長', color:'#408461' },
  { id:'purple', name:'紫車隊長', color:'#8854aa' }
];

export function computerProgress(round, firstCorrect, previous, total) {
  return Math.min(total, previous + (firstCorrect ? (round % 2 === 0 ? 1 : 0) : 1));
}

export function decorateScene(container, mode, character, total) {
  container.dataset.mode = mode.id;
  container.style.setProperty('--rival-color', character.color);
  const rival = container.querySelector('.truck').cloneNode(true);
  rival.classList.add('rival');
  container.append(rival);
  if (mode.id === 'race') {
    const building = container.querySelector('.building').cloneNode(true);
    building.classList.add('computer-building');
    container.append(building);
  }
  const objects = document.createElement('div');
  objects.className = 'mode-objects';
  objects.innerHTML = '<div class="float-ball"></div><div class="finish-line"></div>' +
    '<div class="mud-monster"><span>●　●</span><b>◡</b>' +
    Array.from({length:total}, (_, i) => '<i class="mud-patch" style="--patch:'+ i +'"></i>').join('') + '</div>' +
    '<div class="animals">' + Array.from({length:total},(_,i) => '<span style="--animal:'+ i +'">🐱</span>').join('') + '</div>' +
    '<div class="rescue-ladder"></div><div class="obstacle">▰</div><div class="splash">💦</div>' +
    '<div class="computer-water"><i></i><i></i><i></i></div><div class="landing-pad"></div><div class="carried-animal">🐱</div>';
  container.append(objects);
}

export const computerTurnMs = 1450;

export function beginComputerTurn(container, mode, previous, next, round) {
  const rival = container.querySelector('.rival');
  let target;
  if (mode === 'race') target = container.querySelectorAll('.computer-building .flame')[previous];
  else if (mode === 'mud') target = container.querySelector('.mud-monster');
  else if (mode === 'tug') target = container.querySelector('.float-ball');
  else target = container.querySelector('.truck:not(.rival)');
  if (target) {
    const scene = container.getBoundingClientRect();
    const origin = rival.querySelector('.beacons').getBoundingClientRect();
    const destination = target.getBoundingClientRect();
    const x = origin.left + origin.width / 2;
    const y = origin.bottom;
    const dx = destination.left + destination.width / 2 - x;
    const dy = destination.top + destination.height / 2 - y;
    container.style.setProperty('--computer-jet-x', x - scene.left + 'px');
    container.style.setProperty('--computer-jet-y', y - scene.top + 'px');
    container.style.setProperty('--computer-jet-width', Math.hypot(dx,dy) + 'px');
    container.style.setProperty('--computer-jet-angle', Math.atan2(dy,dx) + 'rad');
  }
  container.classList.add('computer-action');
  container.classList.toggle('computer-miss', mode === 'race' && next === previous);
  container.style.setProperty('--rescue-number', round);
  return () => {
    container.classList.remove('computer-action','computer-miss');
  };
}

export function updateScene(container, round, total, computer) {
  container.style.setProperty('--round', round);
  container.style.setProperty('--fraction', round / total);
  container.dataset.round = round;
  container.querySelectorAll('.mud-patch').forEach((patch,i) => patch.classList.toggle('clean',i < round));
  container.querySelectorAll('.animals span').forEach((animal,i) => animal.classList.toggle('rescued',i < round));
  container.querySelector('.rival').style.setProperty('--computer-fraction', computer / total);
  container.querySelectorAll('.computer-building .flame').forEach((fire,i) => fire.classList.toggle('out',i < computer));
}
