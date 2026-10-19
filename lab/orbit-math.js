const TAU = Math.PI * 2;
const clamp = (value, low = 0, high = 1) => Math.min(high, Math.max(low, value));
const distance = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

function resample(points, spacing) {
  const sampled = [{ ...points[0] }];
  let remainder = 0;
  for (let index = 1; index < points.length; index += 1) {
    const from = points[index - 1];
    const to = points[index];
    const length = distance(from, to);
    if (length === 0) continue;
    let offset = spacing - remainder;
    for (; offset <= length; offset += spacing) {
      const fraction = offset / length;
      sampled.push({ x: from.x + (to.x - from.x) * fraction, y: from.y + (to.y - from.y) * fraction });
      if (sampled.length > 16000) return null;
    }
    remainder = (remainder + length) % spacing;
  }
  const last = points[points.length - 1];
  if (distance(sampled[sampled.length - 1], last) > 0.01) sampled.push({ ...last });
  return sampled;
}

/** Deterministic geometry only: no fitted or invented completion of the stroke. */
export function analyzeOrbit(input, { width, height } = {}) {
  const invalid = (reason) => ({ valid: false, reason, score: 0, circularity: 0, coverage: 0, closure: 0 });
  if (!Array.isArray(input) || !Number.isFinite(width) || !Number.isFinite(height) || Math.min(width, height) < 2) {
    return invalid('invalid-input');
  }
  if (input.length > 16000) return invalid('too-long');
  const points = [];
  for (const point of input) {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y)) return invalid('invalid-input');
    if (point.x < 0 || point.x > width || point.y < 0 || point.y > height) return invalid('out-of-bounds');
    if (!points.length || distance(points[points.length - 1], point) > 0.1) points.push({ x: point.x, y: point.y });
  }
  if (points.length < 6) return invalid('too-short');
  let length = 0;
  for (let index = 1; index < points.length; index += 1) length += distance(points[index - 1], points[index]);
  const minimumSide = Math.min(width, height);
  if (length < Math.max(40, minimumSide * 0.25)) return invalid('too-short');
  const sampled = resample(points, Math.max(1.5, minimumSide / 320));
  if (!sampled) return invalid('too-long');
  const center = { x: width / 2, y: height / 2 };
  const radii = sampled.map((point) => distance(point, center));
  const meanRadius = radii.reduce((sum, radius) => sum + radius, 0) / radii.length;
  if (meanRadius < Math.max(18, minimumSide * 0.17)) return invalid('too-small');

  const radialError = Math.sqrt(radii.reduce((sum, radius) => sum + (radius - meanRadius) ** 2, 0) / radii.length) / meanRadius;
  const angles = sampled.map((point) => Math.atan2(point.y - center.y, point.x - center.x));
  const sorted = [...angles].sort((a, b) => a - b);
  let largestGap = sorted[0] + TAU - sorted[sorted.length - 1];
  for (let index = 1; index < sorted.length; index += 1) largestGap = Math.max(largestGap, sorted[index] - sorted[index - 1]);
  // A small angular allowance accounts for the finite spatial sampling step.
  const resolution = Math.min(Math.PI / 60, Math.max(Math.PI / 180, minimumSide / 320 / meanRadius * 1.5));
  const coverageRatio = clamp((TAU - largestGap + resolution) / TAU);
  const endpointGap = distance(points[0], points[points.length - 1]);
  const closureRatio = clamp(1 - endpointGap / (2 * meanRadius));
  const circularityRatio = clamp(1 - radialError * 2.5);
  let signedSweep = 0;
  let absoluteSweep = 0;
  for (let index = 1; index < angles.length; index += 1) {
    let delta = angles[index] - angles[index - 1];
    if (delta > Math.PI) delta -= TAU;
    if (delta < -Math.PI) delta += TAU;
    signedSweep += delta;
    absoluteSweep += Math.abs(delta);
  }
  const turns = Math.abs(signedSweep) / TAU;
  const totalTurns = absoluteSweep / TAU;
  const lengthRatio = length / (TAU * meanRadius);
  const overtrace = Math.max(0, totalTurns - 1.12, lengthRatio - 1.18);
  const backtrack = Math.max(0, (absoluteSweep - Math.abs(signedSweep)) / TAU - 0.06);
  const innerRatio = Math.min(...radii) / Math.max(1, minimumSide * 0.13);
  const intrusionPenalty = clamp(innerRatio) ** 2;
  let score = 100 * circularityRatio ** 1.12 * coverageRatio ** 2 * closureRatio ** 0.75
    * Math.exp(-3.6 * overtrace - 1.6 * backtrack) * intrusionPenalty;
  if (coverageRatio < 0.5) score = Math.min(score, 15);
  if (coverageRatio < 0.25) score = Math.min(score, 5);
  if (turns >= 1.75 || totalTurns >= 2.1) score = Math.min(score, 10);

  return {
    valid: true,
    reason: '',
    score: Number(clamp(score, 0, 100).toFixed(1)),
    circularity: Number((circularityRatio * 100).toFixed(1)),
    coverage: Number((coverageRatio * 100).toFixed(1)),
    closure: Number((closureRatio * 100).toFixed(1)),
    radialError: Number(radialError.toFixed(5)),
    meanRadius: Number(meanRadius.toFixed(2)),
    endpointGap: Number(endpointGap.toFixed(2)),
    turns: Number(turns.toFixed(3)),
    totalTurns: Number(totalTurns.toFixed(3)),
    length: Number(length.toFixed(2)),
  };
}

