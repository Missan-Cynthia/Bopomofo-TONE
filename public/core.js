export const markers = ['', '', 'ˊ', 'ˇ', 'ˋ'];
export const tones = [1, 2, 3, 4];
export const settings = { fires: 5, introMs: 2650, sprayMs: 950, wrongMs: 450 };
export const spelling = (base, tone) => base + markers[tone];

export function parseList(text) {
  const result = new Map();
  let neutral = 0;
  for (const token of text.replace(/^\uFEFF/, '').trim().split(/[\s,，、;；]+/u).filter(Boolean)) {
    if (/^(?:˙[ㄅ-ㄩ]+|[ㄅ-ㄩ]+˙)$/u.test(token)) {
      neutral++;
      continue;
    }
    const match = /^([ㄅ-ㄩ]{1,3})([ˉˊˇˋ]?)$/u.exec(token);
    if (!match) throw Error('清單含有無法辨識的項目「' + token.slice(0, 32) + '」。');
    const [, base, mark] = match;
    const tone = mark && mark !== 'ˉ' ? markers.indexOf(mark) : 1;
    const id = [...base].map(char => char.codePointAt(0).toString(16)).join('-') + '-' + tone;
    result.set(id, { id, base, tone });
  }
  if (!result.size) throw Error('請提供至少一筆第一到第四聲的注音。');
  return { entries: [...result.values()], neutral };
}

export function candidates(meta) {
  const result = [];
  if (meta?.brother?.status === 'approved') result.push(['brother', meta.brother]);
  if (meta?.mother) result.push(['mother', meta.mother]);
  return result;
}

export function shuffled(items, random = Math.random) {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index--) {
    const other = Math.floor(random() * (index + 1));
    [copy[index], copy[other]] = [copy[other], copy[index]];
  }
  return copy;
}

export function recordAnswer(question, tone, now = new Date().toISOString()) {
  const correct = tone === question.correctTone;
  return {
    ...question,
    firstCorrect: question.firstCorrect ?? correct,
    wrongCount: question.wrongCount + Number(!correct),
    selectedTone: tone,
    answeredAt: now,
    attempts: [...question.attempts, { tone, correct, at: now }]
  };
}
