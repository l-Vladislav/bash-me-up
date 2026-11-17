/**
 * The terminal's noises, synthesised with Web Audio: no sound files.
 *
 * Modelled on the real hardware. A VT100 or VT220 keyclick is one pulse on the
 * keyboard's little speaker, and its bell is the same pulse repeated for about
 * a quarter of a second, an RC-filtered tone near 780 Hz. A CRT switching on
 * thumps and hums as the degaussing coil shakes the shadow mask, and crackles
 * as the glass discharges when it goes off. Printing ticks in an even
 * blip-blip-blip, as on the terminals of games set in a retro future. Everything rises over a few milliseconds and goes through one gentle
 * low-pass "speaker", so nothing starts with a hard edge. The games beep
 * their tunes on the same speaker, as games of the time did.
 */

import type { Cue, Music } from '../terminal/line';

export type SoundName =
  /** A key on the keyboard. */
  | 'key'
  /** Return: the long key, a heavier click. */
  | 'enter'
  /** BEL: an error, a completion with nothing to offer. */
  | 'bell'
  /** A key on the front panel. */
  | 'button'
  /** A square push button latching in or springing out. */
  | 'latch'
  /** The rotary switch clicking over to its other position. */
  | 'rotary'
  | 'power-on'
  | 'power-off'
  /** The degaussing thump on its own, for a warm reboot. */
  | 'degauss';

const MASTER_VOLUME = 0.5;
/** Hertz above which the speaker gives up. */
const SPEAKER_CUTOFF = 4500;
/**
 * Seconds every sound takes to rise. Starting at full volume, a sound begins
 * with a hard click of its own; a couple of milliseconds take the edge off.
 */
const ATTACK = 0.003;

interface Audio {
  context: AudioContext;
  /** Everything plays into this, at the master volume. */
  out: GainNode;
  noise: AudioBuffer;
}

let enabled = false;
let audio: Audio | null = null;

/** Seconds the speaker takes to come up to volume, or to go quiet, when switched. */
const FADE = 0.15;
/**
 * Seconds it takes when the output first opens: enough that the device does
 * not pop, short enough that the sound that opened it is still heard.
 */
const OPEN_FADE = 0.02;

/**
 * Moves the volume to `target` over `seconds`, from wherever it is now.
 * Never by a jump: a volume that leaps, up or down, is itself heard as a click.
 */
const fade = ({ context, out }: Audio, target: number, after = 0, seconds = FADE): void => {
  const now = context.currentTime;
  const level = out.gain.value;
  // Hold the level it has reached, then ramp on from there. Merely cancelling
  // a fade halfway would snap the volume back to where that fade began.
  if (typeof out.gain.cancelAndHoldAtTime === 'function') out.gain.cancelAndHoldAtTime(now);
  else out.gain.cancelScheduledValues(now);
  out.gain.setValueAtTime(level, now + after);
  out.gain.linearRampToValueAtTime(target, now + after + seconds);
};

/** Set while the browser is asked to un-pause the output; one ask is enough. */
let resuming: Promise<void> | null = null;

/**
 * Opens the audio output, or asks for it to be un-paused. A browser may let a
 * page sound at once, e.g. on a site the visitor has used before, or hold the
 * output paused until the first click or key.
 */
const output = (): Audio | null => {
  if (typeof AudioContext === 'undefined') return null;
  if (!audio) {
    const context = new AudioContext();
    const out = context.createGain();
    out.gain.value = 0;
    // A small speaker in a plastic case: the hard top end never gets out.
    const speaker = context.createBiquadFilter();
    speaker.type = 'lowpass';
    speaker.frequency.value = SPEAKER_CUTOFF;
    speaker.Q.value = 0.5;
    out.connect(speaker).connect(context.destination);
    // One second of white noise, the raw material of every click and crackle.
    const noise = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const samples = noise.getChannelData(0);
    for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;
    audio = { context, out, noise };
    fade(audio, MASTER_VOLUME, 0, OPEN_FADE);
  }
  if (audio.context.state === 'suspended' && !resuming) {
    resuming = audio.context.resume().finally(() => {
      resuming = null;
    });
  }
  return audio;
};

const running = (audio: Audio): boolean => audio.context.state === 'running';

/**
 * Whether a sound may be scheduled now. While the output is paused, sounds
 * would pile up and all come out together once it starts, so they are
 * dropped; except during a click or key, which is what un-pauses it, so the
 * sound of that very click is heard a moment later.
 */
const audible = (audio: Audio): boolean =>
  running(audio) || (navigator.userActivation?.isActive ?? false);

/** The events that can un-pause the output. */
const UNLOCK_EVENTS = ['pointerdown', 'keydown'] as const;

/** On a click or key anywhere, before any handler that plays a sound, un-pauses the output. */
const unlock = (): void => {
  try {
    const opened = enabled ? output() : audio;
    if (opened && !running(opened)) return;
  } catch {
    // No audio device: the terminal works silently.
  }
  for (const type of UNLOCK_EVENTS) window.removeEventListener(type, unlock, true);
};

/** Opens the output now; if the browser holds it paused, waits for a click or key. */
const prepare = (): void => {
  const opened = output();
  if (!opened || running(opened)) return;
  // The capture phase runs before every other handler on the page.
  for (const type of UNLOCK_EVENTS) window.addEventListener(type, unlock, true);
  // It may also start by itself; then nothing is left waiting.
  opened.context.addEventListener('statechange', unlock, { once: true });
};

/** Something between a and b, so no two clicks sound quite alike. */
const vary = (a: number, b: number): number => a + Math.random() * (b - a);

interface Burst {
  /** Seconds after now. */
  at?: number;
  duration: number;
  /** Centre of the band of noise that gets through. */
  frequency: number;
  q?: number;
  gain: number;
  filter?: BiquadFilterType;
  attack?: number;
}

/** A short burst of filtered noise: the body of a click. */
const burst = ({ context, out, noise }: Audio, options: Burst): void => {
  const {
    at = 0,
    duration,
    frequency,
    q = 1,
    gain,
    filter = 'bandpass',
    attack = ATTACK,
  } = options;
  const start = context.currentTime + at;
  const source = context.createBufferSource();
  source.buffer = noise;
  const band = context.createBiquadFilter();
  band.type = filter;
  band.frequency.value = frequency;
  band.Q.value = q;
  const envelope = context.createGain();
  // As with a tone: never up faster than a couple of cycles of the band.
  const rise = Math.max(attack, 2 / frequency);
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(gain, start + rise);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + rise + duration);
  source.connect(band).connect(envelope).connect(out);
  // Start somewhere random in the buffer so repeated clicks differ.
  source.start(start, vary(0, 0.9), rise + duration + 0.01);
};

interface Tone {
  at?: number;
  duration: number;
  frequency: number;
  /** Glides here by the end. */
  to?: number;
  type?: OscillatorType;
  gain: number;
  attack?: number;
  /** Rounds off a square or sawtooth, like the RC filter on a bell circuit. */
  lowpass?: number;
}

/** A tone that rises in `attack` seconds and dies away over `duration`. */
const tone = ({ context, out }: Audio, options: Tone): void => {
  const {
    at = 0,
    duration,
    frequency,
    to,
    type = 'sine',
    gain,
    attack = ATTACK,
    lowpass,
  } = options;
  const start = context.currentTime + at;
  const oscillator = context.createOscillator();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (to) oscillator.frequency.exponentialRampToValueAtTime(to, start + duration);
  const envelope = context.createGain();
  // A tone that comes up faster than one of its own cycles starts with a
  // click: a low one needs longer, 10 ms at 100 Hz.
  const rise = Math.max(attack, 1 / Math.min(frequency, to ?? frequency));
  const end = start + Math.max(duration, rise * 2);
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(gain, start + rise);
  envelope.gain.exponentialRampToValueAtTime(0.0001, end);
  let chain: AudioNode = oscillator;
  if (lowpass) {
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = lowpass;
    chain = chain.connect(filter);
  }
  chain.connect(envelope).connect(out);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
};

interface Sweep {
  at?: number;
  duration: number;
  /** The band of noise moves from here to `to` over the sound. */
  from: number;
  to: number;
  q?: number;
  gain: number;
  filter?: BiquadFilterType;
  /** Seconds to swell to full strength. */
  attack: number;
}

/** Noise through a band that slides: a whoosh, a roar, a blast dying down. */
const sweep = ({ context, out, noise }: Audio, options: Sweep): void => {
  const { at = 0, duration, from, to, q = 1, gain, filter = 'bandpass', attack } = options;
  const start = context.currentTime + at;
  const end = start + duration;
  const source = context.createBufferSource();
  source.buffer = noise;
  source.loop = true;
  const band = context.createBiquadFilter();
  band.type = filter;
  band.Q.value = q;
  band.frequency.setValueAtTime(from, start);
  band.frequency.exponentialRampToValueAtTime(to, end);
  const envelope = context.createGain();
  const rise = Math.max(attack, 2 / Math.min(from, to));
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(gain, start + rise);
  envelope.gain.exponentialRampToValueAtTime(0.0001, Math.max(end, start + rise * 2));
  source.connect(band).connect(envelope).connect(out);
  source.start(start, vary(0, 0.9));
  source.stop(Math.max(end, start + rise * 2) + 0.02);
};

interface Tune {
  at?: number;
  /** Seconds from one note to the next. */
  step: number;
  /** How long each note rings; the last rings for `last`. */
  duration: number;
  last?: number;
  type?: OscillatorType;
  gain: number;
}

/**
 * A run of notes on the little speaker, as games of the time played them: a
 * square wave rounded off, so it beeps rather than buzzes.
 */
const tune = (audio: Audio, notes: readonly number[], options: Tune): void => {
  const { at = 0, step, duration, last = duration, type = 'square', gain } = options;
  notes.forEach((frequency, index) => {
    tone(audio, {
      at: at + index * step,
      duration: index === notes.length - 1 ? last : duration,
      frequency,
      type,
      gain,
      attack: 0.006,
      lowpass: 2400,
    });
  });
};

/** Static from the tube: a handful of tiny ticks scattered over a stretch of time. */
const crackle = (audio: Audio, from: number, to: number, count: number, gain: number): void => {
  for (let i = 0; i < count; i += 1) {
    burst(audio, {
      at: vary(from, to),
      duration: vary(0.003, 0.008),
      frequency: vary(2000, 3500),
      q: 1.5,
      gain: vary(gain * 0.3, gain),
      attack: 0.001,
    });
  }
};

/** The muffled clunk of a mains switch. */
const mainsSwitch = (audio: Audio): void => {
  burst(audio, { duration: 0.03, frequency: 700, q: 1.2, gain: 0.3, attack: 0.004 });
  tone(audio, { duration: 0.07, frequency: 100, to: 55, gain: 0.25, attack: 0.005 });
};

/**
 * The degaussing coil: mains current rattles the shadow mask, a deep "vmmm"
 * that swells at once and dies away within a second.
 */
const degauss = (audio: Audio, at: number): void => {
  // The relay that switches the coil in.
  burst(audio, { at, duration: 0.012, frequency: 1800, q: 2, gain: 0.12 });
  // The hum swells over a tenth of a second rather than starting at full strength.
  tone(audio, { at, duration: 1.0, frequency: 50, gain: 0.4, attack: 0.1 });
  tone(audio, { at, duration: 0.8, frequency: 100, gain: 0.14, attack: 0.1 });
  // The mask's rattle: a little rough noise riding on the hum.
  burst(audio, { at, duration: 0.6, frequency: 220, q: 4, gain: 0.18, attack: 0.1 });
};

/** A key: a soft, short "tup" rather than a clack, with no low thump under it. */
const keystroke = (audio: Audio, weight: number): void => {
  burst(audio, {
    duration: 0.02 * weight,
    frequency: vary(700, 950) / weight,
    q: 1.2,
    gain: 0.2,
  });
};

/**
 * One blip of the chatter that goes with printing: a short electronic pip,
 * pitched a little differently each time, so a run of them warbles like data.
 */
const tick = (audio: Audio, at: number): void => {
  // A dry "tk": a few milliseconds of noise through a narrow band, nearly the
  // same pitch each time, so a run of them is a steady blip-blip, not a babble.
  // It rises over a few cycles rather than at once, so it reads as a soft
  // "tp" and not as a sharp click.
  burst(audio, {
    at,
    duration: vary(0.006, 0.008),
    frequency: vary(1700, 1850),
    q: 3,
    gain: vary(0.14, 0.17),
    attack: 0.0025,
  });
};

const VOICES: Record<SoundName, (audio: Audio) => void> = {
  key: (audio) => keystroke(audio, 1),
  enter: (audio) => keystroke(audio, 1.5),
  bell: (audio) => {
    // A square wave rounded off by the RC filter, the speaker ringing a little after.
    tone(audio, {
      duration: 0.28,
      frequency: 780,
      type: 'square',
      gain: 0.07,
      attack: 0.008,
      lowpass: 2000,
    });
    tone(audio, { duration: 0.32, frequency: 1560, gain: 0.012, attack: 0.008 });
  },
  button: (audio) => {
    burst(audio, { duration: 0.022, frequency: vary(800, 1000), q: 1.2, gain: 0.24 });
  },
  latch: (audio) => {
    burst(audio, { duration: 0.016, frequency: 1300, q: 1.4, gain: 0.2 });
    burst(audio, { at: 0.045, duration: 0.022, frequency: 800, q: 1.2, gain: 0.22 });
  },
  rotary: (audio) => {
    burst(audio, { duration: 0.012, frequency: 1800, q: 1.5, gain: 0.16 });
    burst(audio, { at: 0.02, duration: 0.016, frequency: 1200, q: 1.5, gain: 0.16 });
  },
  'power-on': (audio) => {
    mainsSwitch(audio);
    degauss(audio, 0.08);
  },
  'power-off': (audio) => {
    mainsSwitch(audio);
    // The picture collapses: a soft falling thump, then the glass discharges.
    tone(audio, { at: 0.03, duration: 0.35, frequency: 90, to: 30, gain: 0.25, attack: 0.02 });
    crackle(audio, 0.1, 0.9, 6, 0.08);
  },
  degauss: (audio) => {
    degauss(audio, 0);
  },
};

/** Notes, in hertz. */
const C5 = 523;
const D5 = 587;
const E5 = 659;
const G5 = 784;
const A5 = 880;
const B5 = 988;
const C6 = 1047;
const E6 = 1319;
const G4 = 392;
const E4 = 330;
const C4 = 262;

/** A blow landing: a dull smack of noise with a little weight under it. */
const smack = (audio: Audio, at: number, low: number): void => {
  burst(audio, { at, duration: 0.06, frequency: 900 * low, q: 0.8, gain: 0.32, filter: 'lowpass' });
  tone(audio, {
    at,
    duration: 0.08,
    frequency: 180 * low,
    to: 90 * low,
    gain: 0.12,
    attack: 0.008,
  });
};

const CUES: Record<Cue, (audio: Audio) => void> = {
  blip: (audio) => {
    tone(audio, { duration: 0.05, frequency: C6, type: 'square', gain: 0.035, lowpass: 2400 });
  },
  right: (audio) => tune(audio, [A5, E6], { step: 0.07, duration: 0.08, last: 0.18, gain: 0.045 }),
  wrong: (audio) => {
    // A short, low raspberry: the buzzer of a quiz, not an alarm.
    tone(audio, {
      duration: 0.28,
      frequency: 170,
      to: 140,
      type: 'sawtooth',
      gain: 0.08,
      attack: 0.012,
      lowpass: 900,
    });
  },
  // Up the major chord to the octave, and hold it.
  win: (audio) =>
    tune(audio, [C5, E5, G5, C6, G5, C6], { step: 0.1, duration: 0.09, last: 0.5, gain: 0.05 }),
  // Down, slower, and the last note sags.
  lose: (audio) => {
    tune(audio, [G4, E4], { step: 0.24, duration: 0.2, gain: 0.06 });
    tone(audio, {
      at: 0.48,
      duration: 0.7,
      frequency: C4,
      to: 235,
      type: 'square',
      gain: 0.06,
      attack: 0.006,
      lowpass: 1600,
    });
  },
  draw: (audio) => tune(audio, [D5, C5], { step: 0.14, duration: 0.12, last: 0.25, gain: 0.045 }),
  coin: (audio) => tune(audio, [B5, E6], { step: 0.06, duration: 0.06, last: 0.3, gain: 0.04 }),
  heal: (audio) => {
    tone(audio, { duration: 0.4, frequency: 440, to: 880, gain: 0.08, attack: 0.02 });
    tone(audio, { at: 0.05, duration: 0.4, frequency: 660, to: 1320, gain: 0.03, attack: 0.02 });
  },
  unlock: (audio) => {
    // The key turns over the wards, the bolt slides, the door groans.
    burst(audio, { duration: 0.012, frequency: 2600, q: 5, gain: 0.18 });
    burst(audio, { at: 0.07, duration: 0.02, frequency: 1500, q: 3, gain: 0.2 });
    tone(audio, {
      at: 0.16,
      duration: 0.6,
      frequency: 120,
      to: 85,
      type: 'sawtooth',
      gain: 0.05,
      attack: 0.08,
      lowpass: 700,
    });
  },
  // Two notes a tritone apart, at once: something is wrong.
  danger: (audio) => {
    for (const frequency of [220, 311]) {
      tone(audio, {
        duration: 0.55,
        frequency,
        to: frequency * 0.96,
        type: 'sawtooth',
        gain: 0.035,
        attack: 0.02,
        lowpass: 1200,
      });
    }
  },
  hit: (audio) => smack(audio, 0, 1),
  hurt: (audio) => {
    smack(audio, 0, 0.75);
    // And a short grunt of a tone falling away.
    tone(audio, {
      at: 0.02,
      duration: 0.12,
      frequency: 300,
      to: 160,
      type: 'square',
      gain: 0.025,
      lowpass: 1200,
    });
  },
  critical: (audio) => {
    smack(audio, 0, 1.1);
    smack(audio, 0.06, 0.9);
    tone(audio, { duration: 0.18, frequency: 2600, to: 1700, gain: 0.04 });
  },
  block: (audio) => {
    // Metal on metal: a narrow clank, and two partials that do not quite agree.
    burst(audio, { duration: 0.04, frequency: 2200, q: 8, gain: 0.3 });
    tone(audio, { duration: 0.2, frequency: 1170, type: 'triangle', gain: 0.03 });
    tone(audio, { duration: 0.16, frequency: 1730, type: 'triangle', gain: 0.02 });
  },
  miss: (audio) => {
    sweep(audio, { duration: 0.2, from: 500, to: 2200, q: 1.5, gain: 0.16, attack: 0.08 });
  },
  engine: (audio) => {
    // A roar that swells, holds and dies away under the picture of the burn.
    sweep(audio, {
      duration: 1.6,
      from: 320,
      to: 160,
      q: 0.7,
      gain: 0.4,
      filter: 'lowpass',
      attack: 0.25,
    });
    sweep(audio, { duration: 1.2, from: 900, to: 600, q: 2, gain: 0.05, attack: 0.25 });
  },
  explosion: (audio) => {
    burst(audio, { duration: 0.05, frequency: 1400, q: 0.8, gain: 0.3 });
    sweep(audio, {
      duration: 1.8,
      from: 2400,
      to: 110,
      q: 0.6,
      gain: 0.5,
      filter: 'lowpass',
      attack: 0.012,
    });
    crackle(audio, 0.15, 1.4, 12, 0.12);
  },
  alarm: (audio) => tune(audio, [A5, G5, A5, G5], { step: 0.16, duration: 0.12, gain: 0.04 }),
};

/**
 * A game's sound effect, `after` milliseconds from now: the moment its row
 * comes to rest on the screen.
 */
export const cue = (name: Cue, after = 0): void => {
  if (after > 0) setTimeout(() => sound(CUES[name]), after);
  else sound(CUES[name]);
};

/** Seconds the last sound before going quiet, the button's clack, is let ring. */
const LAST_SOUND = 0.12;

/** Whether the monitor is switched on: the background hum runs only then. */
let powered = true;

/** The background: the fan and the transformer, running while the set is on. */
interface Hum {
  level: GainNode;
  /** The fan's air, its pitch falling as it spins down. */
  fan: BiquadFilterNode;
  sources: AudioScheduledSourceNode[];
}

let hum: Hum | null = null;

/** Seconds of noise for anything that runs on, looped; long enough that the loop is not heard. */
const AIR_SECONDS = 4;
let airBuffer: AudioBuffer | null = null;

/** Noise for the backgrounds, made once. */
const longNoise = (context: AudioContext): AudioBuffer => {
  if (airBuffer) return airBuffer;
  airBuffer = context.createBuffer(1, context.sampleRate * AIR_SECONDS, context.sampleRate);
  const samples = airBuffer.getChannelData(0);
  for (let i = 0; i < samples.length; i += 1) samples[i] = Math.random() * 2 - 1;
  return airBuffer;
};

/** Freezes a parameter where it is now, so a ramp can start from there without a jump. */
const hold = (param: AudioParam, now: number): void => {
  const value = param.value;
  if (typeof param.cancelAndHoldAtTime === 'function') param.cancelAndHoldAtTime(now);
  else param.cancelScheduledValues(now);
  param.setValueAtTime(value, now);
};
/** Seconds the hum takes to swell after switching on, and to die away. */
const HUM_RISE = 2;
const HUM_FALL = 0.8;
/** Seconds after power-on before the fan is heard, past the switch and the degauss thump. */
const HUM_AFTER_POWER = 0.4;
/** The fan's pitch while it runs, and where it ends up as it stops. */
const FAN_CUTOFF = 420;
const FAN_STOPPED = 90;

/**
 * Starts the hum, swelling up from silence: soft air from the fan, slowly
 * wavering as fans do, and the mains hum of the transformer under it.
 */
const startHum = (audio: Audio, at: number): Hum => {
  const { context, out } = audio;
  const start = context.currentTime + at;

  const level = context.createGain();
  level.gain.setValueAtTime(0, start);
  level.gain.linearRampToValueAtTime(1, start + HUM_RISE);
  level.connect(out);

  const air = context.createBufferSource();
  air.buffer = longNoise(context);
  air.loop = true;
  const fan = context.createBiquadFilter();
  fan.type = 'lowpass';
  fan.frequency.value = FAN_CUTOFF;
  fan.Q.value = 0.6;
  const fanLevel = context.createGain();
  fanLevel.gain.value = 0.08;
  air.connect(fan).connect(fanLevel).connect(level);

  // A fan never quite holds its note: its level drifts, once every seven seconds or so.
  const drift = context.createOscillator();
  drift.frequency.value = 0.14;
  const depth = context.createGain();
  depth.gain.value = 0.015;
  drift.connect(depth).connect(fanLevel.gain);

  // The transformer: mains at twice 50 Hz, and a little of its third harmonic.
  const mains = (
    [
      [100, 0.014],
      [150, 0.005],
    ] as const
  ).map(([frequency, gain]) => {
    const oscillator = context.createOscillator();
    oscillator.frequency.value = frequency;
    const amount = context.createGain();
    amount.gain.value = gain;
    oscillator.connect(amount).connect(level);
    return oscillator;
  });

  const sources = [air, drift, ...mains];
  for (const source of sources) source.start(start);
  return { level, fan, sources };
};

/** Lets the hum die away, the fan's air dropping in pitch as it spins down. */
const stopHum = ({ context }: Audio, { level, fan, sources }: Hum, seconds: number): void => {
  const now = context.currentTime;
  hold(level.gain, now);
  hold(fan.frequency, now);
  level.gain.linearRampToValueAtTime(0, now + seconds);
  fan.frequency.exponentialRampToValueAtTime(FAN_STOPPED, now + seconds);
  for (const source of sources) source.stop(now + seconds + 0.05);
};

/** Starts or stops the hum to match the speaker and the power; `at` delays a start. */
const updateHum = (at = 0, fall = HUM_FALL): void => {
  try {
    if (enabled && powered) {
      if (hum) return;
      const opened = output();
      if (opened) hum = startHum(opened, at);
    } else if (hum && audio) {
      stopHum(audio, hum, fall);
      hum = null;
    }
  } catch {
    // No audio device: the terminal works silently.
  }
};

// The games' music.

/**
 * One voice of a theme, written out an eighth note a token: a note (`A4`,
 * `C#5`, `Bb2`), `-` holding the one before, `.` a rest, `x` a tick of the
 * hi-hat. `|` marks the bars and is skipped. A shorter part loops on its own,
 * e.g. one bar of hi-hat under four of tune.
 */
interface Part {
  score: string;
  /** A wave for notes; `hat` for ticks of noise. */
  type: 'square' | 'triangle' | 'hat';
  gain: number;
  /** Rounds a square off, so it sings rather than buzzes. */
  lowpass?: number;
}

/** A game's theme: a short tune that goes round while the game runs. */
interface Theme {
  /** Quarter notes a minute. */
  bpm: number;
  parts: readonly Part[];
}

const lead = (score: string, lowpass = 2200, gain = 0.024): Part => ({
  score,
  type: 'square',
  gain,
  lowpass,
});
const bass = (score: string, gain = 0.06): Part => ({ score, type: 'triangle', gain });
const hat = (score: string, gain = 0.03): Part => ({ score, type: 'hat', gain });

const THEMES: Record<Music, Theme> = {
  // A slow minor walk down the corridors.
  dungeon: {
    bpm: 76,
    parts: [
      lead(
        'A4 - C5 - B4 - E4 - | A4 - C5 - D5 - B4 - | C5 - B4 - A4 - G#4 - | A4 - - - . . . .',
        1200,
      ),
      bass('A2 - - - E2 - - - | F2 - - - E2 - - - | A2 - - - E2 - - - | A2 - - - E2 - - -'),
    ],
  },
  // Quick and punchy, with a hi-hat driving it.
  fight: {
    bpm: 140,
    parts: [
      lead(
        'E4 E4 G4 E4 A4 G4 E4 D4 | E4 E4 G4 E4 B4 A4 G4 . | E4 E4 G4 E4 A4 G4 E4 D4 | C4 D4 E4 . E4 . . .',
      ),
      bass(
        'E2 . E2 . E2 . D2 . | E2 . E2 . G2 . A2 . | C3 . C3 . C3 . B2 . | A2 . B2 . E2 . E2 .',
        0.07,
      ),
      hat('x . x . x . x .'),
    ],
  },
  // A pulse that will not let up, under a few long, uneasy notes.
  millionaire: {
    bpm: 92,
    parts: [
      lead(
        'D4 - - - F4 - E4 - | D4 - - - A4 - - - | G4 - F4 - E4 - D4 - | C#4 - - - - - - -',
        1600,
        0.022,
      ),
      bass(
        'D3 D3 D3 D3 D3 D3 D3 D3 | Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 Bb2 | G2 G2 G2 G2 G2 G2 G2 G2 | A2 A2 A2 A2 A2 A2 A2 A2',
        0.05,
      ),
      hat('. . x . . . x .', 0.02),
    ],
  },
  // Wide, rolling arpeggios: the view from the edge of space.
  xlander: {
    bpm: 100,
    parts: [
      {
        score:
          'C4 G4 D5 G4 E5 G4 D5 G4 | A3 E4 B4 E4 C5 E4 B4 E4 | F3 C4 G4 C4 A4 C4 G4 C4 | G3 D4 A4 D4 B4 D4 A4 D4',
        type: 'triangle',
        gain: 0.045,
      },
      bass('C3 - - - - - - - | A2 - - - - - - - | F2 - - - - - - - | G2 - - - - - - -'),
    ],
  },
  // A slow, crooked little tune, half a funeral march.
  hangman: {
    bpm: 72,
    parts: [
      lead(
        'E4 - F4 E4 D#4 E4 - - | G4 - F4 E4 D4 C4 - - | B3 - C4 D4 E4 - A3 - | B3 - - - . . . .',
        1400,
        0.022,
      ),
      bass('A2 - - - E2 - - - | A2 - - - C3 - - - | G2 - - - F2 - - - | E2 - - - E2 - - -'),
    ],
  },
  // Bouncy: up and down the scale, like the hints.
  guess: {
    bpm: 120,
    parts: [
      lead(
        'C5 . E5 . G5 . E5 . | F5 . D5 . B4 . G4 . | C5 . E5 . G5 . C6 . | B5 . G5 . D5 . . .',
        2400,
        0.02,
      ),
      bass('C3 . G2 . C3 . G2 . | G2 . D3 . G2 . B2 . | A2 . E3 . A2 . E3 . | G2 . D3 . G2 . . .'),
    ],
  },
  // Light and tidy, a game in a café.
  tictactoe: {
    bpm: 108,
    parts: [
      lead(
        'G4 B4 D5 B4 C5 - A4 - | F#4 A4 C5 A4 B4 - G4 - | E4 G4 B4 G4 A4 - F#4 - | G4 - D4 - G4 - . .',
        2400,
        0.02,
      ),
      bass('G2 - - - C3 - - - | D3 - - - G2 - - - | E2 - - - D2 - - - | G2 - D2 - G2 - - -'),
      hat('. . x . . . x .', 0.022),
    ],
  },
};

const SEMITONES: Readonly<Record<string, number>> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** The pitch of a note such as `C#5` or `Bb2`, in hertz. */
const pitch = (name: string): number => {
  const match = /^([A-G])([#b]?)(\d)$/.exec(name);
  if (!match) throw new Error(`music: no such note "${name}"`);
  const [, letter = 'A', accidental = '', octave = '4'] = match;
  const shift = accidental === '#' ? 1 : accidental === 'b' ? -1 : 0;
  const midi = 12 * (Number(octave) + 1) + (SEMITONES[letter] ?? 0) + shift;
  return 440 * 2 ** ((midi - 69) / 12);
};

/** A note to play: from which eighth, for how many, at what pitch; none for a tick. */
interface Played {
  step: number;
  steps: number;
  frequency?: number;
}

/** A part read into notes, and how many eighths it runs before it repeats. */
const read = (score: string): { notes: Played[]; length: number } => {
  const tokens = score.split(/\s+/).filter((token) => token !== '' && token !== '|');
  const notes: Played[] = [];
  tokens.forEach((token, step) => {
    if (token === '.') return;
    if (token === '-') {
      const last = notes.at(-1);
      if (last && last.step + last.steps === step) last.steps += 1;
      return;
    }
    notes.push(token === 'x' ? { step, steps: 1 } : { step, steps: 1, frequency: pitch(token) });
  });
  return { notes, length: tokens.length };
};

/** How many eighths each part of a theme runs; for checking the scores. */
export const themeLengths = (name: Music): number[] =>
  THEMES[name].parts.map(({ score }) => read(score).length);

/** A note held for `seconds` from `start`, audio time, with a soft start and end. */
const held = (
  { context }: Audio,
  into: AudioNode,
  part: Part,
  start: number,
  seconds: number,
  frequency: number,
): void => {
  const oscillator = context.createOscillator();
  oscillator.type = part.type === 'hat' ? 'square' : part.type;
  oscillator.frequency.value = frequency;
  const envelope = context.createGain();
  // No faster than a cycle of the note, or it clicks; no slower than a short pluck.
  const rise = Math.max(0.008, 1 / frequency);
  const end = start + Math.max(seconds, rise * 3);
  const fall = Math.min(0.06, (end - start) / 3);
  envelope.gain.setValueAtTime(0, start);
  envelope.gain.linearRampToValueAtTime(part.gain, start + rise);
  envelope.gain.linearRampToValueAtTime(part.gain * 0.7, end - fall);
  envelope.gain.linearRampToValueAtTime(0, end);
  let chain: AudioNode = oscillator;
  if (part.lowpass) {
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = part.lowpass;
    chain = chain.connect(filter);
  }
  chain.connect(envelope).connect(into);
  oscillator.start(start);
  oscillator.stop(end + 0.02);
};

/** A theme as it plays: its volume, its parts read, and where it has got to. */
interface Song {
  name: Music;
  level: GainNode;
  parts: { part: Part; notes: Played[]; length: number }[];
  /** Seconds an eighth lasts. */
  eighth: number;
  /** The next eighth to play, and its audio time. */
  step: number;
  next: number;
  timer: ReturnType<typeof setInterval>;
}

/** The theme asked for, and the one playing. */
let wanted: Music | null = null;
let song: Song | null = null;

/** Seconds ahead notes are lined up, and milliseconds between lining them up. */
const LOOKAHEAD = 0.3;
const PUMP_MS = 60;
/** Seconds a theme takes to come in, and to fade when its game ends. */
const SONG_RISE = 0.6;
const SONG_FALL = 0.8;

/** Lines up the notes due in the next moment. */
const pump = (opened: Audio, playing: Song): void => {
  if (!running(opened)) return;
  const now = opened.context.currentTime;
  // Back from a pause, it picks up from here rather than playing what it missed.
  if (playing.next < now) playing.next = now + 0.05;
  while (playing.next < now + LOOKAHEAD) {
    for (const { part, notes, length } of playing.parts) {
      const at = playing.step % length;
      for (const note of notes) {
        if (note.step !== at) continue;
        if (note.frequency === undefined) {
          burst(
            { ...opened, out: playing.level },
            {
              at: playing.next - now,
              duration: 0.02,
              frequency: 3200,
              q: 0.8,
              gain: part.gain,
              filter: 'highpass',
            },
          );
        } else {
          const seconds = note.steps * playing.eighth * 0.92;
          held(opened, playing.level, part, playing.next, seconds, note.frequency);
        }
      }
    }
    playing.step += 1;
    playing.next += playing.eighth;
  }
};

const startSong = (opened: Audio, name: Music): Song => {
  const { context, out } = opened;
  const now = context.currentTime;
  const level = context.createGain();
  level.gain.setValueAtTime(0, now);
  level.gain.linearRampToValueAtTime(1, now + SONG_RISE);
  level.connect(out);
  const theme = THEMES[name];
  const playing: Song = {
    name,
    level,
    parts: theme.parts.map((part) => ({ part, ...read(part.score) })),
    eighth: 30 / theme.bpm,
    step: 0,
    next: now + 0.05,
    timer: setInterval(() => {
      try {
        pump(opened, playing);
      } catch {
        // The device went away: the tune stops, the game goes on.
      }
    }, PUMP_MS),
  };
  pump(opened, playing);
  return playing;
};

const stopSong = ({ context }: Audio, { level, timer }: Song): void => {
  clearInterval(timer);
  const now = context.currentTime;
  hold(level.gain, now);
  level.gain.linearRampToValueAtTime(0, now + SONG_FALL);
  setTimeout(() => level.disconnect(), (SONG_FALL + LOOKAHEAD + 0.2) * 1000);
};

/** Plays the theme asked for, if the speaker and the set are on; fades out any other. */
const updateMusic = (): void => {
  try {
    const name = enabled && powered ? wanted : null;
    if (song?.name === name) return;
    if (song && audio) stopSong(audio, song);
    song = null;
    const opened = name ? output() : null;
    if (name && opened) song = startSong(opened, name);
  } catch {
    // No audio device: the games play silently.
  }
};

/** The theme of the game being played, or none: `null` once it ends. */
export const setMusic = (name: Music | null): void => {
  wanted = name;
  updateMusic();
};

/** The monitor switched on or off: the fan and transformer start up, or wind down. */
export const setMonitorPower = (on: boolean): void => {
  if (on === powered) return;
  powered = on;
  updateHum(HUM_AFTER_POWER);
  updateMusic();
};

/**
 * Turns the speaker on or off. On, it opens the audio output and comes up
 * from silence; off, it lets the last sound out and then fades away.
 */
export const setSoundEnabled = (on: boolean): void => {
  if (on === enabled) return;
  enabled = on;
  try {
    if (!on) {
      if (audio) fade(audio, 0, LAST_SOUND);
    } else if (audio) {
      // Open from before, it went quiet by fading: it comes back the same way.
      fade(audio, MASTER_VOLUME);
    } else {
      // Otherwise it opens now, or on the first click or key after a reload.
      prepare();
    }
  } catch {
    // No audio device: the terminal works silently.
  }
  updateHum();
  updateMusic();
};

/** Runs `voice` if the speaker is on. Safe to call anywhere, any time. */
const sound = (voice: (audio: Audio) => void): void => {
  if (!enabled) return;
  try {
    const audio = output();
    if (audio && audible(audio)) voice(audio);
  } catch {
    // No audio device, or the browser said no: the terminal works silently.
  }
};

export const play = (name: SoundName): void => sound(VOICES[name]);

/** The most clicks one turn of a knob is heard as, and the seconds between them. */
const MAX_DETENTS = 5;
const DETENT_GAP = 0.016;

/** A knob turned past `count` notches at once: one click for each, in quick succession. */
export const detents = (count: number): void =>
  sound((audio) => {
    for (let i = 0; i < Math.min(count, MAX_DETENTS); i += 1) {
      burst(audio, {
        at: i * DETENT_GAP,
        duration: 0.008,
        frequency: vary(1900, 2100),
        q: 2,
        gain: 0.08,
      });
    }
  });

/** Characters per tick of chatter, and the most ticks one row gets. */
const CHARS_PER_TICK = 8;
const MAX_TICKS = 4;
/** Chatter queued further ahead than this is dropped: the screen has moved on. */
const MAX_BACKLOG = 0.15;
/**
 * Seconds between ticks: an even beat of about thirty a second, like a
 * terminal putting characters up one at a time. Much faster and it blurs
 * into a buzz; uneven and it burbles.
 */
const TICK_EVERY = 0.032;

/** Audio time at which the next tick of chatter may sound. */
let chatterAt = 0;

/**
 * The chatter of a row being printed: a quick run of ticks, longer for a
 * longer row. Rows that come fast one after another make one steady stream.
 */
export const chatter = (characters: number): void =>
  sound((audio) => {
    if (characters <= 0) return;
    const now = audio.context.currentTime;
    let at = Math.max(now, chatterAt);
    if (at - now > MAX_BACKLOG) return;
    const ticks = Math.min(MAX_TICKS, Math.ceil(characters / CHARS_PER_TICK));
    for (let i = 0; i < ticks; i += 1) {
      tick(audio, at - now);
      at += TICK_EVERY * vary(0.95, 1.05);
    }
    chatterAt = at;
  });

/**
 * A picture coming down the line, drawn a band at a time: each band is a
 * short data tone, its pitch wandering the way a signal that carries an
 * image does, so the sound keeps step with the picture as it fills in.
 */
export const drawing = (seconds: number, bands: number): void =>
  sound((audio) => {
    const step = seconds / bands;
    let pitch = vary(1300, 1700);
    for (let i = 0; i < bands; i += 1) {
      pitch = Math.min(2200, Math.max(1000, pitch + vary(-250, 250)));
      tone(audio, {
        at: i * step,
        duration: step * 0.85,
        frequency: pitch,
        type: 'square',
        gain: 0.03,
        attack: 0.004,
        lowpass: 2400,
      });
    }
    // The line settling once the last band is in.
    tone(audio, { at: seconds, duration: 0.08, frequency: 520, gain: 0.05, attack: 0.006 });
  });

/** The most line feeds one scroll is heard as. */
const MAX_FEEDS = 8;

/**
 * Text rolling up the screen: a soft, low tick for each row that goes by,
 * like the line feeds of a terminal scrolling.
 */
export const feed = (rows: number): void =>
  sound((audio) => {
    const now = audio.context.currentTime;
    // While output chatters, the scrolling it causes is not heard on top of it.
    if (rows < 1 || chatterAt > now) return;
    let at = now;
    for (let i = 0; i < Math.min(MAX_FEEDS, Math.round(rows)); i += 1) {
      tone(audio, {
        at: at - now,
        duration: vary(0.02, 0.03),
        frequency: vary(330, 420),
        gain: vary(0.07, 0.1),
        attack: 0.004,
      });
      at += TICK_EVERY;
    }
    chatterAt = at;
  });
