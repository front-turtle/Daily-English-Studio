import { getAI, getGenerativeModel, GoogleAIBackend, Schema } from 'firebase/ai';
import app from './firebase';

export interface WritingReviewResult {
  polishedSentence: string;
  tip: string;
}

const responseSchema = Schema.object({
  properties: {
    polishedSentence: Schema.string(),
    tip: Schema.string(),
  },
});

const ai = getAI(app, { backend: new GoogleAIBackend() });

const reviewModel = getGenerativeModel(ai, {
  model: 'gemini-3.5-flash-lite',
  systemInstruction: [
    'You are an English writing coach for a Korean adult learner.',
    'Treat the Korean sentence as the source of truth for meaning. Preserve that Korean intent exactly, even when the learner\'s English is awkward or implies something slightly different.',
    'Prefer clear everyday or workplace English over unnecessarily advanced vocabulary.',
    'Use the learner\'s English as evidence of intended wording/style, but never let it override the Korean meaning. If the original English is already natural and faithful to the Korean, make only minimal changes.',
    'The polishedSentence must contain only the improved English sentence.',
    'The tip must be a concise Korean explanation of the most useful correction or expression.',
  ].join(' '),
  generationConfig: {
    responseMimeType: 'application/json',
    responseSchema,
  },
});

export async function reviewEnglishWriting(
  korean: string,
  english: string
): Promise<WritingReviewResult> {
  const prompt = [
    '다음 영작을 첨삭해 주세요.',
    '',
    `의도한 한국어: ${korean}`,
    `학습자가 작성한 영어: ${english}`,
    '',
    '한국어 문장을 의미의 기준으로 삼아 주세요. 영어 문장이 어색하거나 한국어와 의미가 조금 다르면 한국어의 의도를 우선하여 자연스럽고 실제로 쓰기 좋은 영어로 다듬어 주세요.',
  ].join('\n');

  const result = await reviewModel.generateContent(prompt);
  const raw = result.response.text();
  const parsed = JSON.parse(raw) as Partial<WritingReviewResult>;

  const polishedSentence = parsed.polishedSentence?.trim();
  const tip = parsed.tip?.trim();

  if (!polishedSentence) {
    throw new Error('Gemini returned an empty polished sentence.');
  }

  return {
    polishedSentence,
    tip: tip || '더 자연스럽고 간결한 표현으로 다듬었습니다.',
  };
}
