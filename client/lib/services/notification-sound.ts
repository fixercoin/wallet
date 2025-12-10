/**
 * Notification sound utility
 * Generates and plays a bell ring sound using Web Audio API
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext) {
    const AudioContextClass =
      window.AudioContext || (window as any).webkitAudioContext;
    audioContext = new AudioContextClass();
  }
  return audioContext;
}

/**
 * Plays a bell ring notification sound
 */
export function playNotificationSound() {
  try {
    const context = getAudioContext();

    // Resume audio context if suspended (required for user interaction)
    if (context.state === "suspended") {
      context
        .resume()
        .catch((e) => console.error("Failed to resume audio:", e));
    }

    // Create oscillators and gainNodes for bell-like sound
    const now = context.currentTime;
    const duration = 0.6;

    // Main tone (higher frequency for bell)
    const osc1 = context.createOscillator();
    const gain1 = context.createGain();
    osc1.connect(gain1);
    gain1.connect(context.destination);

    osc1.frequency.setValueAtTime(1046.5, now); // High C
    osc1.frequency.exponentialRampToValueAtTime(800, now + duration);
    gain1.gain.setValueAtTime(0.3, now);
    gain1.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc1.start(now);
    osc1.stop(now + duration);

    // Secondary tone (harmony)
    const osc2 = context.createOscillator();
    const gain2 = context.createGain();
    osc2.connect(gain2);
    gain2.connect(context.destination);

    osc2.frequency.setValueAtTime(1318.5, now); // High E
    osc2.frequency.exponentialRampToValueAtTime(1000, now + duration);
    gain2.gain.setValueAtTime(0.2, now);
    gain2.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc2.start(now);
    osc2.stop(now + duration);

    // Quick second bell strike
    const delayBetweenStrikes = 0.15;
    const osc3 = context.createOscillator();
    const gain3 = context.createGain();
    osc3.connect(gain3);
    gain3.connect(context.destination);

    osc3.frequency.setValueAtTime(1046.5, now + delayBetweenStrikes);
    osc3.frequency.exponentialRampToValueAtTime(
      800,
      now + delayBetweenStrikes + duration * 0.7,
    );
    gain3.gain.setValueAtTime(0.25, now + delayBetweenStrikes);
    gain3.gain.exponentialRampToValueAtTime(
      0.01,
      now + delayBetweenStrikes + duration * 0.7,
    );

    osc3.start(now + delayBetweenStrikes);
    osc3.stop(now + delayBetweenStrikes + duration * 0.7);
  } catch (error) {
    console.error("Failed to play notification sound:", error);
  }
}

/**
 * Plays a single bell strike for subtle notifications
 */
export function playSingleBellSound() {
  try {
    const context = getAudioContext();

    if (context.state === "suspended") {
      context
        .resume()
        .catch((e) => console.error("Failed to resume audio:", e));
    }

    const now = context.currentTime;
    const duration = 0.4;

    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.connect(gain);
    gain.connect(context.destination);

    osc.frequency.setValueAtTime(1046.5, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + duration);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + duration);

    osc.start(now);
    osc.stop(now + duration);
  } catch (error) {
    console.error("Failed to play bell sound:", error);
  }
}
