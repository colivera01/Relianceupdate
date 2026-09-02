export const CUSTOMER_SERVICE_VIDEO_STAGES = ["before", "during", "after"] as const;

export type CustomerServiceVideoStage = (typeof CUSTOMER_SERVICE_VIDEO_STAGES)[number];

export function getForwardPlaybackStages(
  startStage: CustomerServiceVideoStage,
  availableStages: readonly CustomerServiceVideoStage[],
): CustomerServiceVideoStage[] {
  const available = new Set(availableStages);
  const startIndex = CUSTOMER_SERVICE_VIDEO_STAGES.indexOf(startStage);
  return CUSTOMER_SERVICE_VIDEO_STAGES.slice(startIndex).filter((stage) => available.has(stage));
}

export function getNextPlaybackStage(
  currentStage: CustomerServiceVideoStage,
  queue: readonly CustomerServiceVideoStage[],
): CustomerServiceVideoStage | null {
  const currentIndex = queue.indexOf(currentStage);
  if (currentIndex < 0) return null;
  return queue[currentIndex + 1] || null;
}
