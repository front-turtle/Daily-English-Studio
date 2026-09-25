import { getAI, getGenerativeModel, GoogleAIBackend } from 'firebase/ai';
import app from './firebase';

export interface TutorHistoryItem {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

const ai = getAI(app, { backend: new GoogleAIBackend() });

const tutorModel = getGenerativeModel(ai, {
  model: 'gemini-3.5-flash-lite',
  systemInstruction: [
    'You are a practical English tutor for a Korean adult learner.',
    'The user may ask in Korean or English about words, sentences, grammar, nuance, pronunciation, workplace English, or natural phrasing.',
    'Answer mainly in concise Korean, while keeping target English examples in English.',
    'When reviewing an English sentence, explain whether it is natural, offer a better version when useful, and briefly explain why.',
    'When explaining a word or phrase, include the core meaning, nuance, and 1-3 natural example sentences when useful.',
    'Prefer common, usable English over unnecessarily advanced expressions.',
    'Do not overwhelm the learner with long theory unless they explicitly ask for detail.',
  ].join(' '),
});

export function createEnglishTutorChat(history: TutorHistoryItem[] = []) {
  return tutorModel.startChat({
    history,
    generationConfig: {
      maxOutputTokens: 900,
    },
  });
}
