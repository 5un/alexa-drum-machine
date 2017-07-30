export function overrideMMATempo(mma, newtempo) {
  return mma.replace(/^Tempo.*$/m, `Tempo ${newtempo}`);
}

export function readMMATempo(mma) {
  const matches = mma.match(/^Tempo.*$/m);
  if(matches) {
    return (matches[0].split(' '))[1];
  }
  return null;
}

export function generateGroove(opts) {
  return `
  Tempo ${opts.tempo || 120}
  Keysig C
  Transpose up per 4

  Groove Metronome4
    z * 1

  Chord Off
  Arpeggio Off
  Scale Off
  Bass Off
  Walk Off
  Plectrum Off
  Solo Off
  Melody Off
  Groove ${opts.groove || 'pop'}
  1 z
  2 z
  3 z
  4 z
  5 z
  6 z
  7 z
  8 z
  9 z
  10 z
  11 z
  12 z
  13 z
  14 z
  15 z
  16 z
  17 z
  18 z
  19 z
  20 z
  `;
}