const CODE: Readonly<Record<string, string>> = {
  A: '.-',
  B: '-...',
  C: '-.-.',
  D: '-..',
  E: '.',
  F: '..-.',
  G: '--.',
  H: '....',
  I: '..',
  J: '.---',
  K: '-.-',
  L: '.-..',
  M: '--',
  N: '-.',
  O: '---',
  P: '.--.',
  Q: '--.-',
  R: '.-.',
  S: '...',
  T: '-',
  U: '..-',
  V: '...-',
  W: '.--',
  X: '-..-',
  Y: '-.--',
  Z: '--..',
  '0': '-----',
  '1': '.----',
  '2': '..---',
  '3': '...--',
  '4': '....-',
  '5': '.....',
  '6': '-....',
  '7': '--...',
  '8': '---..',
  '9': '----.',
  '.': '.-.-.-',
  ',': '--..--',
  '?': '..--..',
  '!': '-.-.--',
  '@': '.--.-.',
  '/': '-..-.',
};

const DECODE = new Map(Object.entries(CODE).map(([char, code]) => [code, char]));

/** Letters are separated by spaces, words by ` / `. */
export const toMorse = (text: string): string =>
  text
    .toUpperCase()
    .split(/\s+/)
    .filter(Boolean)
    .map((word) =>
      [...word]
        .map((char) => CODE[char])
        .filter(Boolean)
        .join(' '),
    )
    .filter(Boolean)
    .join(' / ');

export const fromMorse = (code: string): string =>
  code
    .trim()
    .split(/\s*\/\s*/)
    .map((word) =>
      word
        .split(/\s+/)
        .map((letter) => DECODE.get(letter) ?? '?')
        .join(''),
    )
    .join(' ');

/** True when the input is already dots and dashes, so it should be decoded. */
export const isMorse = (text: string): boolean => /^[.\-\s/]+$/.test(text) && /[.-]/.test(text);
