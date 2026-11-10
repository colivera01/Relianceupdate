import { describe, expect, it } from 'vitest';
import { ratingForRadioKey } from './customer-rating-keyboard';

describe('five-star rating keyboard navigation', () => {
  it.each([
    [3, 'ArrowRight', 4],
    [3, 'ArrowDown', 4],
    [3, 'ArrowLeft', 2],
    [3, 'ArrowUp', 2],
    [5, 'ArrowRight', 1],
    [1, 'ArrowLeft', 5],
    [4, 'Home', 1],
    [2, 'End', 5],
  ] as const)('moves from %i with %s to %i', (focused, key, expected) => {
    expect(ratingForRadioKey(focused, key)).toBe(expected);
  });

  it('leaves unrelated keys to the browser', () => {
    expect(ratingForRadioKey(3, 'Tab')).toBeNull();
    expect(ratingForRadioKey(3, ' ')).toBeNull();
  });
});
