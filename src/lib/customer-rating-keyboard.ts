/** Radio-group key behavior for five-star customer ratings. */
export function ratingForRadioKey(focusedRating: number, key: string): number | null {
  if (key === 'Home') return 1;
  if (key === 'End') return 5;
  if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(key)) return null;

  const current = Number.isInteger(focusedRating) && focusedRating >= 1 && focusedRating <= 5
    ? focusedRating
    : 1;
  if (key === 'ArrowRight' || key === 'ArrowDown') return current === 5 ? 1 : current + 1;
  return current === 1 ? 5 : current - 1;
}
