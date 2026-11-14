let context: AudioContext | undefined;
/** Short procedural ambience; no downloads, timers, or persistent audio nodes. */
export function playCityAmbience(indoor:boolean,volume:number){
 if(!volume||!navigator.userActivation?.hasBeenActive)return;
 try{context??=new AudioContext();void context.resume().catch(()=>{});const tone=context.createOscillator(),gain=context.createGain();tone.type='sine';tone.frequency.value=indoor?120:68;gain.gain.value=0;gain.gain.linearRampToValueAtTime(volume*.012,context.currentTime+.2);gain.gain.linearRampToValueAtTime(0,context.currentTime+1.8);tone.connect(gain);gain.connect(context.destination);tone.start();tone.stop(context.currentTime+2);tone.onended=()=>{tone.disconnect();gain.disconnect();};}catch{}
}
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
export function playFootstep(volume: number) {
  if(!volume || !navigator.userActivation?.hasBeenActive) return;
  try {
    context ??= new AudioContext();
    const tone=context.createOscillator(),gain=context.createGain();
    tone.type="triangle";tone.frequency.value=90;
    gain.gain.value=volume*0.025;gain.gain.exponentialRampToValueAtTime(0.001,context.currentTime+0.07);
    tone.connect(gain);gain.connect(context.destination);tone.start();tone.stop(context.currentTime+0.08);
    tone.onended=()=>{tone.disconnect();gain.disconnect();};
  } catch { /* Walking still works without audio. */ }
}
