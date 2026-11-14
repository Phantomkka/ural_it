let context: AudioContext | undefined;
export function playFeedback(ok: boolean, volume: number) {
  if (!volume || !navigator.userActivation?.hasBeenActive) return;
  try {
    context ??= new AudioContext();
    void context.resume().catch(()=>{});
    const tone=context.createOscillator(), gain=context.createGain();
    tone.frequency.value=ok?660:180; gain.gain.value=volume*0.08;
    gain.gain.exponentialRampToValueAtTime(0.001,context.currentTime+0.16);
    tone.connect(gain); gain.connect(context.destination); tone.start(); tone.stop(context.currentTime+0.18);
    tone.onended=()=>{tone.disconnect();gain.disconnect();};
  } catch { /* Sound is optional on browsers without audio support. */ }
}
