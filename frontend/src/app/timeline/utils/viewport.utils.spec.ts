import { anchorZoom, pxToMs, msToRelativePx } from './viewport.utils';

describe('anchorZoom', () => {
  // 30-day viewport, well above the 2-hour minimum duration clamp
  const DAY_MS = 86_400_000;
  const vp = { from: 0, to: 30 * DAY_MS };

  it('zooms in (positive deltaMs shrinks viewport)', () => {
    const result = anchorZoom(vp, DAY_MS, 0.5);
    expect(result.to - result.from).toBeLessThan(vp.to - vp.from);
  });

  it('zooms out (negative deltaMs expands viewport)', () => {
    const result = anchorZoom(vp, -DAY_MS, 0.5);
    expect(result.to - result.from).toBeGreaterThan(vp.to - vp.from);
  });

  it('anchor at left edge (ratio=0) keeps from unchanged on zoom-in', () => {
    const result = anchorZoom(vp, DAY_MS, 0);
    expect(result.from).toBeCloseTo(vp.from);
  });

  it('anchor at right edge (ratio=1) keeps to unchanged on zoom-in', () => {
    const result = anchorZoom(vp, DAY_MS, 1);
    expect(result.to).toBeCloseTo(vp.to);
  });

  it('clamps to minimum duration', () => {
    const tiny = { from: 0, to: 100 };
    const result = anchorZoom(tiny, -99_999_999, 0.5);
    expect(result.to - result.from).toBeGreaterThanOrEqual(2 * 3_600_000);
  });

  it('clamps to maximum duration', () => {
    const huge = { from: 0, to: 5 * 365 * 86_400_000 - 1 };
    const result = anchorZoom(huge, 99_999_999_999, 0.5);
    expect(result.to - result.from).toBeLessThanOrEqual(5 * 365 * 86_400_000);
  });
});

describe('pxToMs', () => {
  const vp = { from: 1000, to: 2000 };

  it('maps px=0 to viewport.from', () => {
    expect(pxToMs(0, 100, vp)).toBe(1000);
  });

  it('maps px=containerWidth to viewport.to', () => {
    expect(pxToMs(100, 100, vp)).toBe(2000);
  });

  it('maps px=50 to midpoint', () => {
    expect(pxToMs(50, 100, vp)).toBe(1500);
  });

  it('clamps negative px to viewport.from', () => {
    expect(pxToMs(-50, 100, vp)).toBe(1000);
  });

  it('clamps overflow px to viewport.to', () => {
    expect(pxToMs(200, 100, vp)).toBe(2000);
  });

  it('returns from when containerWidthPx is zero', () => {
    expect(pxToMs(50, 0, vp)).toBe(1000);
  });
});

describe('msToRelativePx', () => {
  const vp = { from: 1000, to: 2000 };

  it('maps from to 0', () => {
    expect(msToRelativePx(1000, 100, vp)).toBe(0);
  });

  it('maps to to containerWidth', () => {
    expect(msToRelativePx(2000, 100, vp)).toBe(100);
  });

  it('maps midpoint to half containerWidth', () => {
    expect(msToRelativePx(1500, 100, vp)).toBe(50);
  });

  it('clamps before-viewport timestamps to 0', () => {
    expect(msToRelativePx(0, 100, vp)).toBe(0);
  });

  it('clamps after-viewport timestamps to containerWidth', () => {
    expect(msToRelativePx(9999, 100, vp)).toBe(100);
  });
});
