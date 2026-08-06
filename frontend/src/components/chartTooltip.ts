/**
 * The subset of Recharts' tooltip payload the custom tooltips actually read.
 * Recharts clones the `content` element with these props at render time, so a
 * narrow hand-written type is both accurate enough and avoids `any`.
 */
export interface ChartTooltipEntry {
  name?: string;
  value?: number;
  color?: string;
  fill?: string;
}

export interface ChartTooltipProps {
  active?: boolean;
  payload?: ChartTooltipEntry[];
  label?: string | number;
}
