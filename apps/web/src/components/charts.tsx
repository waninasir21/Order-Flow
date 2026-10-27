"use client";

import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { formatDay } from "@/lib/format";
import { useResolvedTheme } from "@/lib/theme";

// Recharts writes colors into SVG attributes, where `var(--accent)` is not reliable, so the
// charts read the real values of the CSS tokens and re-read them whenever the theme changes.
// That keeps the charts on the same palette as the rest of the page, in both modes.
function useChartColors() {
  const theme = useResolvedTheme();
  return useMemo(() => {
    const light = { accent: "#1d6b57", ink: "#17201c", muted: "#66706a", line: "#e3dfd3", surface: "#fffdf9" };
    if (typeof document === "undefined") return light;
    const css = getComputedStyle(document.documentElement);
    const read = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
    return {
      accent: read("--accent", light.accent),
      ink: read("--ink", light.ink),
      muted: read("--muted", light.muted),
      line: read("--line", light.line),
      surface: read("--surface", light.surface),
    };
    // `theme` isn't read inside, but a change of it is exactly when the tokens change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
}

// Same data as a table for people who can't see the chart (screen readers, and anyone who
// wants the exact numbers). The chart itself is aria-hidden, so Recharts' own keyboard/ARIA
// layer is switched off (accessibilityLayer={false}): otherwise it would leave a focusable
// element inside an aria-hidden region, which assistive technology handles badly.
function DataTable({ caption, head, rows }: { caption: string; head: [string, string]; rows: [string, number][] }) {
  return (
    // The visually-hidden styles go on a wrapping <div>, not on the <table>: a table ignores a
    // 1px width and would stretch past the card, widening the whole page on phones.
    <div className="sr-only">
    <table>
      <caption>{caption}</caption>
      <thead>
        <tr>
          <th scope="col">{head[0]}</th>
          <th scope="col">{head[1]}</th>
        </tr>
      </thead>
      <tbody>
        {rows.map(([a, b]) => (
          <tr key={a}>
            <th scope="row">{a}</th>
            <td>{b}</td>
          </tr>
        ))}
      </tbody>
    </table>
    </div>
  );
}

export function OrdersPerDayChart({ data }: { data: { date: string; count: number }[] }) {
  const c = useChartColors();
  const points = data.map((d) => ({ ...d, label: formatDay(d.date) }));
  return (
    <figure aria-label="Line chart of orders per day" className="relative">
      <div aria-hidden className="h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart accessibilityLayer={false} data={points} margin={{ top: 8, right: 16, bottom: 0, left: -12 }}>
            <CartesianGrid stroke={c.line} vertical={false} />
            <XAxis
              dataKey="label"
              tick={{ fill: c.muted, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: c.line }}
              interval="preserveStartEnd"
              minTickGap={24}
            />
            <YAxis
              allowDecimals={false}
              tick={{ fill: c.muted, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              width={44}
            />
            <Tooltip
              cursor={{ stroke: c.line }}
              contentStyle={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 8, color: c.ink }}
              labelStyle={{ color: c.muted }}
              itemStyle={{ color: c.ink }}
              formatter={(value) => [value, "Orders"]}
            />
            <Line
              type="monotone"
              dataKey="count"
              stroke={c.accent}
              strokeWidth={2.5}
              dot={{ r: 3, fill: c.accent, stroke: c.accent }}
              activeDot={{ r: 5 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        caption="Orders per day"
        head={["Day", "Orders"]}
        rows={points.map((p) => [p.label, p.count])}
      />
    </figure>
  );
}

const truncate = (text: string, max = 20) => (text.length > max ? `${text.slice(0, max - 1)}…` : text);

export function TopProductsChart({ data }: { data: { name: string; units: number }[] }) {
  const c = useChartColors();
  // 44 px per bar plus room for the axis, so a longer list doesn't squash the bars.
  const height = Math.max(180, data.length * 44 + 40);
  return (
    <figure aria-label="Bar chart of best selling products" className="relative">
      <div aria-hidden style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart accessibilityLayer={false} data={data} layout="vertical" margin={{ top: 0, right: 24, bottom: 0, left: 0 }}>
            <CartesianGrid stroke={c.line} horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
              tick={{ fill: c.muted, fontSize: 12 }}
              tickLine={false}
              axisLine={{ stroke: c.line }}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={132}
              tick={{ fill: c.ink, fontSize: 12 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: string) => truncate(v)}
            />
            <Tooltip
              cursor={{ fill: c.line, opacity: 0.4 }}
              contentStyle={{ background: c.surface, border: `1px solid ${c.line}`, borderRadius: 8, color: c.ink }}
              labelStyle={{ color: c.muted }}
              itemStyle={{ color: c.ink }}
              formatter={(value) => [value, "Units ordered"]}
            />
            <Bar dataKey="units" fill={c.accent} radius={[0, 4, 4, 0]} barSize={22} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable
        caption="Best selling products"
        head={["Product", "Units ordered"]}
        rows={data.map((d) => [d.name, d.units])}
      />
    </figure>
  );
}
