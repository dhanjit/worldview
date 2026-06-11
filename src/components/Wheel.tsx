import { claimFor, experts, schoolById, topics } from "../lib/data";

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
  topicId: string;
  expertId: string;
  onSelect: (topicId: string, expertId?: string) => void;
}

export default function Wheel({ topicId, onSelect }: Props) {
  return (
    <svg
      viewBox="0 0 680 452"
      width="100%"
      role="img"
      aria-label="Radial wheel plotting nine experts across five geopolitical topic axes"
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

      {topics.map((t, i) => {
        const g = -36 + 72 * i;
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

      {topics.map((t, i) => {
        const s = -36 + 72 * i + 3;
        const e = s + 66;
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

      {topics.map((t, i) => {
        const m = 72 * i;
        const [lx, ly] = pt(m, 220);
        const anchor = m === 0 ? "middle" : m < 180 ? "start" : "end";
        const dy = m === 0 ? 0 : m === 72 || m === 288 ? 4 : 9;
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

      {topics.flatMap((t, i) =>
        experts.map((ex, j) => {
          const c = claimFor(ex.id, t.id);
          if (!c || c.score == null) return null;
          const a = -36 + 72 * i + 9 + ((j + 0.5) / experts.length) * 54;
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
