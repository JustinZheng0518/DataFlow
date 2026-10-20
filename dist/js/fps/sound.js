/**
 * Synthesized kitchen audio with Web Audio: bell, sizzle, fire, footsteps and reactions.
 * No audio files. Everything degrades to silence where Web Audio is unavailable.
 */
const TONES = {
  ready: [880, 520], ingredient: [420, 520], cook: [300, 380], miss: [260, 180], pickup: [520, 660],
};

export function createSound() {
  let ctx = null, master = null, noise = null;
  const loops = {};

  function noiseBuffer() {
    const buffer = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  /** A looping filtered-noise bed whose volume we can fade (sizzle, fire crackle). */
  function loop(name, {type, frequency, q = 1}) {
    if (loops[name]) return loops[name];
    const src = ctx.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = frequency;
    filter.Q.value = q;
    const gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(filter).connect(gain).connect(master);
    src.start();
    loops[name] = gain;
    return gain;
  }

  function tone(freq, {to = freq, type = 'sine', gain = .05, attack = .005, decay = .2, at = 0} = {}) {
    const now = ctx.currentTime + at;
    const osc = ctx.createOscillator(), g = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, now);
    if (to !== freq) osc.frequency.exponentialRampToValueAtTime(to, now + decay * .6);
    g.gain.setValueAtTime(0, now);
    g.gain.linearRampToValueAtTime(gain, now + attack);
    g.gain.exponentialRampToValueAtTime(.0001, now + decay);
    osc.connect(g).connect(master);
    osc.start(now);
    osc.stop(now + decay + .05);
  }

  const voices = {
    /** Service bell: bright inharmonic partials with a long ring. */
    bell() {
      for (const [f, g, d] of [[1568, .09, 1.6], [3920, .03, .9], [2350, .04, 1.2], [5270, .015, .5]]) tone(f, {gain: g, decay: d});
    },
    happy() { tone(660, {gain: .04, decay: .15}); tone(880, {gain: .04, decay: .2, at: .1}); tone(1320, {gain: .03, decay: .3, at: .2}); },
    sad() { tone(330, {to: 220, type: 'triangle', gain: .05, decay: .5}); },
    sting() { tone(523, {gain: .05, decay: .2}); tone(659, {gain: .05, decay: .2, at: .12}); tone(784, {gain: .05, decay: .35, at: .24}); },
    alarm() { for (let i = 0; i < 4; i++) tone(i % 2 ? 740 : 988, {type: 'square', gain: .025, decay: .18, at: i * .2}); },
    whoosh() {
      const src = ctx.createBufferSource(), filter = ctx.createBiquadFilter(), g = ctx.createGain(), now = ctx.currentTime;
      src.buffer = noise;
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(3000, now + .5);
      g.gain.setValueAtTime(.2, now);
      g.gain.exponentialRampToValueAtTime(.001, now + .7);
      src.connect(filter).connect(g).connect(master);
      src.start(now);
      src.stop(now + .75);
    },
    step() { tone(90, {to: 60, type: 'triangle', gain: .035, decay: .09}); },
    door() { tone(180, {to: 120, type: 'triangle', gain: .03, decay: .18}); },
  };

  return {
    /** Must run inside a user gesture so browsers allow audio. */
    unlock() {
      try {
        ctx ??= new (window.AudioContext || window.webkitAudioContext)();
        if (!master) {
          master = ctx.createGain();
          master.gain.value = .9;
          master.connect(ctx.destination);
          noise = noiseBuffer();
        }
        ctx.resume();
      } catch (error) {
        console.warn('Audio unavailable', error);
      }
    },
    play(name) {
      if (!ctx || !master) return;
      if (voices[name]) return voices[name]();
      const t = TONES[name];
      if (t) tone(t[0], {to: t[1], gain: .045});
    },
    /** Continuous ambience: sizzle volume 0..1 and fire volume 0..1. */
    ambience({sizzle = 0, fire = 0}) {
      if (!ctx || !master) return;
      const now = ctx.currentTime;
      loop('sizzle', {type: 'highpass', frequency: 3500, q: .7}).gain.setTargetAtTime(sizzle * .05, now, .2);
      loop('fire', {type: 'lowpass', frequency: 900, q: .5}).gain.setTargetAtTime(fire * .12, now, .3);
    },
  };
}
