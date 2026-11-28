import { describe, expect, it } from 'vitest';
import { movementFrame } from './movement.js';
describe('race movement presentation', () => {
  it('waits for the die, then visits every space before landing', () => {
    expect(movementFrame(2, 5, 600).space).toBe(2);
    expect(movementFrame(2, 5, 650 + 420).space).toBe(3);
    expect(movementFrame(2, 5, 650 + 840).space).toBe(4);
    expect(movementFrame(2, 5, 1910)).toEqual({space:5, progress:1, hop:0});
    expect(movementFrame(2, 5, 860).hop).toBeGreaterThan(.4);
  });
  it('moves backwards and respects reduced motion', () => {
    expect(movementFrame(9, 6, 1070).space).toBe(8);
    expect(movementFrame(9, 6, 0, true)).toEqual({space:6,progress:1,hop:0});
  });
});
