/** Large visual milestones follow the existing 16-stage streak, independently of the four progress groups. */
export const LANDSCAPE_STAGES = [
  { days: 0, key: 'meadow', name: '새싹의 초원', asset: 'garden-meadow-v1.webp' },
  { days: 7, key: 'tree', name: '나무가 자라는 들판', asset: 'garden/tree-v1.webp' },
  { days: 30, key: 'forest', name: '생명이 깃드는 숲', asset: 'garden/forest-v1.webp' },
  { days: 90, key: 'primeval', name: '오래된 원시림', asset: 'garden/primeval-v1.webp' },
  { days: 120, key: 'tropical', name: '초록빛 열대우림', asset: 'garden/tropical-v1.webp' },
  { days: 150, key: 'amazon', name: '거대한 생명의 아마존', asset: 'garden/amazon-v1.webp' },
  { days: 210, key: 'paradise', name: '생명의 낙원', asset: 'garden/paradise-v1.webp' },
  { days: 240, key: 'earth', name: '생명을 품은 지구', asset: 'assets/review-world-earth.svg' },
] as const;

export function landscapeForStreak(streak: number) {
  const days = Number.isFinite(streak) ? Math.max(0, streak) : 0;
  const index = LANDSCAPE_STAGES.reduce((current, stage, i) => days >= stage.days ? i : current, 0);
  return LANDSCAPE_STAGES[index];
}
