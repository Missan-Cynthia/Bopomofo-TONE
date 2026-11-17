let context;
export function wakeAudio() {
  try {
    context ??= new (window.AudioContext || window.webkitAudioContext)();
    if (context.state !== 'running') context.resume().catch(() => {});
  } catch { /* 音效非必要 */ }
}

export function chime(success, enabled) {
  if (!enabled || context?.state !== 'running') return;
  (success ? [523, 659, 784] : [784, 988, 1175, 1568]).forEach((frequency, index) => {
    const start = context.currentTime + index * .086;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(.001, start);
    gain.gain.exponentialRampToValueAtTime(.12, start + .025);
    gain.gain.exponentialRampToValueAtTime(.001, start + .18);
    osc.connect(gain).connect(context.destination);
    osc.start(start);
    osc.stop(start + .19);
  });
}

export async function microphone() {
  if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) throw Error('請使用支援麥克風的 HTTPS 網址，或在電腦使用 localhost。');
  const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const release = () => stream.getTracks().forEach(track => track.stop());
  try {
    const mimeType = ['audio/webm;codecs=opus', 'audio/mp4', 'audio/webm'].find(type => MediaRecorder.isTypeSupported?.(type));
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : {});
    const chunks = [];
    let timer;
    const blob = new Promise((resolve, reject) => {
      recorder.ondataavailable = event => { if (event.data.size) chunks.push(event.data); };
      recorder.onstop = () => {
        clearTimeout(timer);
        release();
        resolve(new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type }));
      };
      recorder.onerror = () => {
        clearTimeout(timer);
        release();
        reject(Error('錄音中斷，請重新錄音。'));
      };
    });
    recorder.start();
    const stop = () => {
      clearTimeout(timer);
      if (recorder.state !== 'inactive') recorder.stop();
      release();
    };
    timer = setTimeout(stop, 8000);
    return { stop, blob };
  } catch (error) {
    release();
    throw error;
  }
}

export async function wav(blob) {
  if (!blob.size || !context) throw Error('錄音內容無法讀取，請重新錄音。');
  const decoded = await context.decodeAudioData(await blob.arrayBuffer());
  const rate = 24000;
  const length = Math.min(8 * rate, Math.floor(decoded.duration * rate));
  if (length < rate / 10) throw Error('錄音時間太短，請重新錄音。');
  const offline = new OfflineAudioContext(1, length, rate);
  const node = offline.createBufferSource();
  node.buffer = decoded;
  node.connect(offline.destination);
  node.start();
  const samples = (await offline.startRendering()).getChannelData(0);
  const data = new DataView(new ArrayBuffer(44 + samples.length * 2));
  for (const [offset, label] of [[0,'RIFF'],[8,'WAVE'],[12,'fmt '],[36,'data']]) {
    [...label].forEach((char, index) => data.setUint8(offset + index, char.charCodeAt(0)));
  }
  for (const [offset,value] of [[4,data.byteLength - 8],[16,16],[24,rate],[28,rate * 2],[40,samples.length * 2]]) data.setUint32(offset,value,true);
  for (const [offset,value] of [[20,1],[22,1],[32,2],[34,16]]) data.setUint16(offset,value,true);
  samples.forEach((value, index) => data.setInt16(44 + index * 2, Math.max(-1, Math.min(1,value)) * 32767,true));
  return new Blob([data.buffer], { type: 'audio/wav' });
}

export function playable(player, url) {
  return new Promise((resolve, reject) => {
    const controller = new AbortController();
    const finish = (ok) => {
      clearTimeout(timer);
      controller.abort();
      if (ok) resolve();
      else reject(Error('錄音無法播放。'));
    };
    const timer = setTimeout(() => finish(false), 3500);
    player.addEventListener('canplay', () => finish(true), { signal: controller.signal });
    player.addEventListener('error', () => finish(false), { signal: controller.signal });
    player.src = url;
    player.load();
  });
}
