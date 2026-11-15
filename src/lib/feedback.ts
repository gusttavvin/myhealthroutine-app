"use client";

/** Fala em português, com voz pausada. */
export function speak(text: string, enabled: boolean) {
  if (!enabled || typeof window === "undefined" || !("speechSynthesis" in window)) return;
  try {
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "pt-BR";
    u.rate = 0.88;
    const voice = window.speechSynthesis.getVoices().find((v) => v.lang?.toLowerCase().startsWith("pt"));
    if (voice) u.voice = voice;
    window.speechSynthesis.speak(u);
  } catch {
    /* sem voz */
  }
}

export function stopSpeaking() {
  try {
    window.speechSynthesis?.cancel();
  } catch {
    /* ignora */
  }
}

export function vibrate(pattern: number | number[]) {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* sem vibração */
  }
}

let ctx: AudioContext | null = null;

/** Som de volume crescente. level 1 = aviso do horário, 2 = lembrete reforçado. */
export function chime(level: 1 | 2, enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = ctx ?? new AC();
    const notes = level === 1 ? [660, 784, 988] : [660, 784, 988, 784, 988, 1175];
    const base = level === 1 ? 0.05 : 0.09;
    notes.forEach((freq, i) => {
      const t = ctx!.currentTime + i * 0.38;
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const peak = base * (1 + i * 0.6); // volume crescente
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(peak, t + 0.04);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.34);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.36);
    });
  } catch {
    /* sem áudio */
  }
}

export function success(enabled: boolean) {
  if (!enabled || typeof window === "undefined") return;
  try {
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    ctx = ctx ?? new AC();
    [523, 659].forEach((freq, i) => {
      const t = ctx!.currentTime + i * 0.15;
      const osc = ctx!.createOscillator();
      const gain = ctx!.createGain();
      osc.frequency.value = freq;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.08, t + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
      osc.connect(gain).connect(ctx!.destination);
      osc.start(t);
      osc.stop(t + 0.32);
    });
  } catch {
    /* sem áudio */
  }
}
