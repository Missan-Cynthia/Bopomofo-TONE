export function truck() {
  return '<div class="truck"><div class="ladder"></div><div class="truck-body"><span>119</span></div><div class="cab"><div></div></div><div class="beacons"><i></i><i></i></div><div class="bumper"></div><div class="wheel rear"></div><div class="wheel front"></div></div>';
}

export function renderScene(container, count, home = false) {
  const columns = Math.min(count, 5);
  const rows = Math.ceil(count / columns);
  const fires = Array.from({length:count}, (_, index) =>
    '<i class="flame" style="--i:' + index + ';--x:' + ((index % columns + .5) * 100 / columns) + '%;--y:' +
      (18 + (Math.floor(index / columns) + .5) * 62 / rows) + '%;--fire-height:' + Math.min(32, 80 / rows) + '%"><b></b></i>'
  ).join('');
  container.innerHTML = '<div class="sun"></div><div class="cloud a"></div><div class="cloud b"></div>' +
    '<div class="hills"></div><div class="tree left"></div><div class="tree right"></div>' +
    '<div class="station"><div class="station-sign">119</div><div class="garage"><i></i></div></div>' +
    '<div class="building"><div class="roof"></div><div class="windows"><i></i><i></i><i></i><i></i></div><div class="door"></div><div class="fires">' + fires + '</div></div>' +
    '<div class="road"></div>' + truck() + '<div class="water"><i></i><i></i><i></i></div>';
  container.classList.toggle('poster', home);
}

export function extinguish(container, index) {
  const fire = container.querySelectorAll('.flame')[index];
  if (fire) {
    const scene = container.getBoundingClientRect();
    const truck = container.querySelector('.beacons').getBoundingClientRect();
    const target = fire.getBoundingClientRect();
    const x = truck.left + truck.width / 2;
    const y = truck.top + truck.height;
    const dx = target.left + target.width / 2 - x;
    const dy = target.top + target.height / 2 - y;
    container.style.setProperty('--jet-x', x - scene.left + 'px');
    container.style.setProperty('--jet-y', y - scene.top + 'px');
    container.style.setProperty('--jet-width', Math.hypot(dx, dy) + 'px');
    container.style.setProperty('--jet-angle', Math.atan2(dy, dx) + 'rad');
    container.classList.add('spraying');
  }
  return () => {
    fire?.classList.add('out');
    container.classList.remove('spraying');
  };
}
