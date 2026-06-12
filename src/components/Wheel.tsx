import { claimFor, expertsFor, schoolById, topicsFor } from "../lib/data";

const CX = 340;
const CY = 252;
const RMIN = 65;
const RMAX = 200;
const RINGS = [65, 99, 133, 166, 200];

function pt(deg: number, r: number): [number, number] {
  const t = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(t), CY + r * Math.sin(t)];
}

interface Props {
  frameId: string;
  topicId: string;
  expertId: string;
  onSelect: (topicId: string, expertId?: string) => void;
}

export default function Wheel({ frameId, topicId, onSelect }: Props) {
  const ts = topicsFor(frameId);
  const exps = expertsFor(frameId);
  const span = 360 / ts.length;

  return (
    <svg
      viewBox="0 0 680 452"
      width="100%"
      role="img"
      aria-label={`Radial wheel plotting ${exps.length} experts across ${ts.length} topic axes`}
    >
      {RINGS.map((r) => (
        <circle
          key={r}
          cx={CX}
          cy={CY}
          r={r}
          fill="none"
          stroke="var(--ring)"
          strokeWidth={0.8}
          strokeDasharray={r === 133 ? "3 5" : undefined}
        />
      ))}

      {ts.map((t, i) => {
        const g = -(span / 2) + span * i;
        const [x1, y1] = pt(g, 56);
        const [x2, y2] = pt(g, 210);
        return (
          <line
            key={t.id}
            x1={x1}
            y1={y1}
            x2={x2}
            y2={y2}
            stroke="var(--ring)"
            strokeWidth={0.8}
          />
        );
      })}

      {ts.map((t, i) => {
        const s = -(span / 2) + span * i + 3;
        const e = -(span / 2) + span * (i + 1) - 3;
        const [x1, y1] = pt(s, 206);
        const [x2, y2] = pt(e, 206);
        const [x3, y3] = pt(e, 58);
        const [x4, y4] = pt(s, 58);
        const d = `M${x1} ${y1} A206 206 0 0 1 ${x2} ${y2} L${x3} ${y3} A58 58 0 0 0 ${x4} ${y4} Z`;
        return (
          <path
            key={t.id}
            d={d}
            fill={t.id === topicId ? "var(--surface-2)" : "transparent"}
            cursor="pointer"
            onClick={() => onSelect(t.id)}
          />
        );
      })}

      {ts.map((t, i) => {
        const m = (span * i) % 360;
        const [lx, ly] = pt(m, 220);
        const anchor = m < 10 || m > 350 ? "middle" : m < 180 ? "start" : "end";
        const dy = m < 10 || m > 350 ? 0 : m <= 90 || m >= 270 ? 4 : 9;
        return (
          <text
            key={t.id}
            x={lx}
            y={ly + dy}
            textAnchor={anchor}
            className={`wheel-label${t.id === topicId ? " active" : ""}`}
            onClick={() => onSelect(t.id)}
          >
            {t.label}
          </text>
        );
      })}

      {ts.flatMap((t, i) =>
        exps.map((ex, j) => {
          const c = claimFor(ex.id, t.id);
          if (!c || c.score == null) return null;
          const a =
            -(span / 2) +
            span * i +
            6 +
            ((j + 0.5) / exps.length) * (span - 12);
          const r = RMIN + (c.score / 100) * (RMAX - RMIN);
          const [cx, cy] = pt(a, r);
          return (
            <circle
              key={`${t.id}-${ex.id}`}
              className="wheel-dot"
              cx={cx}
              cy={cy}
              r={6}
              fill={schoolById[ex.school].dot}
              stroke="var(--bg)"
              strokeWidth={1.2}
              onClick={() => onSelect(t.id, ex.id)}
            >
              <title>{`${ex.name} · ${t.label} · ${c.score}/100 — ${c.summary}`}</title>
            </circle>
          );
        }),
      )}
    </svg>
  );
}
