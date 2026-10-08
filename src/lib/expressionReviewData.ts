export interface ExpressionReview { english: string; korean: string; feedback: string }
export function expressionReviewInput(english: string, korean: string) {
  const sourceEnglish = english.trim(), proposedKoreanMeaning = korean.trim();
  if (!sourceEnglish && !proposedKoreanMeaning) throw new Error('영어 또는 한글을 입력해 주세요.');
  if (sourceEnglish.length > 2000 || proposedKoreanMeaning.length > 2000) throw new Error('각 입력은 2,000자 이내로 줄여 주세요.');
  return { mode: sourceEnglish ? proposedKoreanMeaning ? 'review-pair' : 'en-ko' : 'ko-en', sourceEnglish, proposedKoreanMeaning };
}
export function parseExpressionReview(text: string): ExpressionReview {
  const result = JSON.parse(text);
  if (!['english', 'korean', 'feedback'].every(key => typeof result[key] === 'string' && result[key].trim() && result[key].length <= 4000)) throw new Error('검토 결과를 확인하지 못했습니다. 다시 시도해 주세요.');
  return { english: result.english.trim(), korean: result.korean.trim(), feedback: result.feedback.trim() };
}
