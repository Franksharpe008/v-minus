export interface ReelMetadata {
  width?: number;
  height?: number;
  duration?: number;
}

export interface ReelQualification {
  isReel: boolean;
  width: number | null;
  height: number | null;
  duration: number | null;
  aspectRatio: number | null;
  formatLabel: string;
  reason?: string;
}

const MAX_REEL_DURATION_SECONDS = 65;
const MIN_REEL_ASPECT_RATIO = 1.65;
const MAX_REEL_ASPECT_RATIO = 1.9;

const toNumber = (value: unknown): number | null => {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

export function qualifyReel(metadata: ReelMetadata): ReelQualification {
  const width = toNumber(metadata.width);
  const height = toNumber(metadata.height);
  const duration = toNumber(metadata.duration);
  const aspectRatio = width && height ? height / width : null;

  const base = {
    width,
    height,
    duration,
    aspectRatio,
    formatLabel: '9:16 Reel',
  };

  if (!width || !height) {
    return {
      ...base,
      isReel: false,
      reason: 'source did not expose width/height metadata',
    };
  }

  if (height <= width) {
    return {
      ...base,
      isReel: false,
      reason: `source is ${width}x${height}, not vertical`,
    };
  }

  if (!aspectRatio || aspectRatio < MIN_REEL_ASPECT_RATIO || aspectRatio > MAX_REEL_ASPECT_RATIO) {
    return {
      ...base,
      isReel: false,
      reason: `source is ${width}x${height}, not close enough to 9:16`,
    };
  }

  if (!duration || duration > MAX_REEL_DURATION_SECONDS) {
    return {
      ...base,
      isReel: false,
      reason: duration
        ? `source is ${Math.round(duration)}s, longer than ${MAX_REEL_DURATION_SECONDS}s`
        : 'source did not expose duration metadata',
    };
  }

  return {
    ...base,
    isReel: true,
  };
}
