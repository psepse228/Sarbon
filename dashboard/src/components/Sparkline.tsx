interface SparklineProps {
  values: number[];
  color: string;
}

/** Minimal inline-SVG sparkline — thin 2px line, single hue (the caller's own
 * semantic KPI color, not a new categorical assignment), no axis/legend/grid
 * (a single-series sparkline needs none per the dataviz skill's accessibility
 * rule). Renders nothing meaningful for an all-zero series rather than a
 * flat misleading line at a fake baseline. */
export function Sparkline({ values, color }: SparklineProps) {
  const max = Math.max(...values, 1);
  const width = 100;
  const height = 28;
  const step = values.length > 1 ? width / (values.length - 1) : 0;

  const points = values
    .map((value, index) => {
      const x = index * step;
      const y = height - (value / max) * (height - 4) - 2;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" height={height} preserveAspectRatio="none" aria-hidden="true">
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
