// Web Audio 合成音效（無音檔）。預設關閉；第一次開啟時才建立 AudioContext。
// hammer：錘擊；play(name)：室內小互動的音效（whoosh 風箱、chime 魔晶燈、rustle 翻頁、clink 工具、
// purr 黑貓、twang 弓弦、salute 老闆致意、enchant 附魔成功）。
export function createAudio() {
  let ctx = null;
  let hitBuf = null;   // 錘擊用：快速衰減的噪音
  let noiseBuf = null; // 其他音效用：平穩的白噪音

  const out = (gain) => {
    const g = ctx.createGain();
    g.gain.value = gain;
    g.connect(ctx.destination);
    return g;
  };
  // 一段經過濾波、帶包絡的噪音
  const noise = (dest, { type = 'bandpass', freq = 1000, q = 0.8, at = 0, dur = 0.3, peak = 1, attack = 0.01, sweep = null }) => {
    const t = ctx.currentTime + at;
    const n = ctx.createBufferSource();
    n.buffer = noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.setValueAtTime(freq, t);
    if (sweep) for (const [k, v] of sweep) f.frequency.linearRampToValueAtTime(v, t + k * dur);
    f.Q.value = q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    n.connect(f).connect(g).connect(dest);
    n.start(t);
    n.stop(t + dur + 0.05);
  };
  // 一組泛音（金屬、鈴聲）
  const partials = (dest, base, list, at = 0, type = 'sine') => {
    const t = ctx.currentTime + at;
    for (const [ratio, gain, decay] of list) {
      const o = ctx.createOscillator();
      const g = ctx.createGain();
      o.type = type;
      o.frequency.value = base * ratio;
      g.gain.setValueAtTime(gain, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
      o.connect(g).connect(dest);
      o.start(t);
      o.stop(t + decay + 0.05);
    }
  };

  const SOUNDS = {
    whoosh() {
      noise(out(0.5), { type: 'lowpass', freq: 260, q: 1.2, dur: 0.7, attack: 0.18, sweep: [[0.3, 1300], [1, 300]] });
    },
    chime(i = 0) {
      const base = [880, 988, 1175, 1319, 1568][((i % 5) + 5) % 5];
      partials(out(0.16), base, [[1, 0.5, 1.4], [2.0, 0.22, 0.9], [3.01, 0.12, 0.5], [4.2, 0.06, 0.3]]);
    },
    rustle() {
      const o = out(0.32);
      for (let k = 0; k < 5; k++) noise(o, { type: 'highpass', freq: 2600 + Math.random() * 1500, q: 0.5, at: k * 0.09, dur: 0.08, attack: 0.005 });
    },
    clink() {
      const o = out(0.14);
      for (let k = 0; k < 4; k++) partials(o, 1500 + Math.random() * 900, [[1, 0.4, 0.35], [2.7, 0.2, 0.2], [5.1, 0.1, 0.1]], k * (0.08 + Math.random() * 0.1));
    },
    purr() {
      // 低沉噪音以 26Hz 調變振幅
      const t = ctx.currentTime;
      const g = out(0.0);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.5, t + 0.25);
      g.gain.linearRampToValueAtTime(0.0001, t + 1.6);
      const lfo = ctx.createOscillator();
      const depth = ctx.createGain();
      const am = ctx.createGain();
      lfo.frequency.value = 26;
      depth.gain.value = 0.5;
      am.gain.value = 0.5;
      lfo.connect(depth).connect(am.gain);
      am.connect(g);
      noise(am, { type: 'lowpass', freq: 320, q: 0.7, dur: 1.6, attack: 0.2 });
      lfo.start(t);
      lfo.stop(t + 1.7);
    },
    twang() {
      const o = out(0.22);
      partials(o, 196, [[1, 0.5, 0.45], [2, 0.25, 0.3], [3, 0.12, 0.2]], 0, 'triangle');
      noise(o, { type: 'bandpass', freq: 1800, q: 0.6, at: 0.02, dur: 0.35, peak: 0.5, attack: 0.03, sweep: [[1, 600]] });
    },
    // 附魔成功：往上爬的四個音（依附魔種類換調）＋一陣亮晶晶的高頻
    enchant(kind = 0) {
      const o = out(0.16);
      const base = [523, 587, 659, 698][((kind % 4) + 4) % 4];
      [1, 1.25, 1.5, 2].forEach((r, i) => partials(o, base * r, [[1, 0.5, 1.2], [2.0, 0.2, 0.7], [3.0, 0.08, 0.4]], i * 0.09));
      noise(o, { type: 'highpass', freq: 5000, q: 0.5, at: 0.3, dur: 1.0, peak: 0.25, attack: 0.15 });
    },
    salute() {
      partials(out(0.12), 660, [[1, 0.4, 0.5], [2.76, 0.2, 0.3]]);
      partials(out(0.12), 880, [[1, 0.4, 0.6], [2.76, 0.2, 0.3]], 0.16);
    },
  };

  const api = {
    enabled: false,
    get state() { return ctx ? ctx.state : 'none'; },
    setEnabled(on) {
      api.enabled = !!on;
      if (api.enabled && !ctx) {
        const AC = window.AudioContext || window.webkitAudioContext;
        if (!AC) { api.enabled = false; return; }
        ctx = new AC();
        hitBuf = ctx.createBuffer(1, ctx.sampleRate * 0.25, ctx.sampleRate);
        const d = hitBuf.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3);
        noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
        const w = noiseBuf.getChannelData(0);
        for (let i = 0; i < w.length; i++) w[i] = Math.random() * 2 - 1;
      }
      if (ctx && api.enabled && ctx.state === 'suspended') ctx.resume();
    },
    play(name, arg) {
      if (!api.enabled || !ctx || !SOUNDS[name]) return;
      SOUNDS[name](arg);
    },
    hammer() {
      if (!api.enabled || !ctx) return;
      const t = ctx.currentTime;
      const o = out(0.35);
      // 敲擊瞬間的噪音
      const n = ctx.createBufferSource();
      n.buffer = hitBuf;
      const bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 2400;
      bp.Q.value = 0.8;
      n.connect(bp).connect(o);
      n.start(t);
      // 金屬泛音
      partials(o, 520 + Math.random() * 80, [[1, 0.5, 0.9], [2.76, 0.3, 0.6], [5.4, 0.18, 0.35], [8.9, 0.1, 0.2]]);
    },
  };
  return api;
}
