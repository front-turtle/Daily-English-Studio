/**
 * Web Speech API text-to-speech helper
 */
export function playEnglishSpeech(text: string, voiceType: 'US' | 'UK' = 'US', rate: number = 1.0) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    console.warn('SpeechSynthesis not supported in this browser.');
    return;
  }

  // Cancel any ongoing utterance
  window.speechSynthesis.cancel();

  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = rate;
  utterance.pitch = 1.0;
  utterance.lang = voiceType === 'UK' ? 'en-GB' : 'en-US';

  const voices = window.speechSynthesis.getVoices();
  if (voices.length > 0) {
    const targetLang = voiceType === 'UK' ? 'en-GB' : 'en-US';
    const foundVoice = voices.find(v => v.lang.includes(targetLang) || (voiceType === 'US' && v.lang.startsWith('en')));
    if (foundVoice) {
      utterance.voice = foundVoice;
    }
  }

  window.speechSynthesis.speak(utterance);
}

/**
 * Check if speech recognition is available in browser
 */
export function isSpeechRecognitionAvailable(): boolean {
  if (typeof window === 'undefined') return false;
  return 'webkitSpeechRecognition' in window || 'SpeechRecognition' in window;
}

/**
 * Creates a simple speech recognizer instance for pronunciation practice
 */
export function createSpeechRecognizer(
  onResult: (transcript: string) => void,
  onError: (err: any) => void,
  onEnd: () => void
) {
  if (!isSpeechRecognitionAvailable()) return null;

  const SpeechRecognitionClass =
    (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const recognition = new SpeechRecognitionClass();
  recognition.lang = 'en-US';
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event: any) => {
    const transcript = event.results[0][0].transcript;
    onResult(transcript);
  };

  recognition.onerror = (event: any) => {
    onError(event.error);
  };

  recognition.onend = () => {
    onEnd();
  };

  return recognition;
}
