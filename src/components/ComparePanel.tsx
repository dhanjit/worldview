import { useState } from "react";
import { claimFor, expertById, expertsFor, schoolById, topicsFor } from "../lib/data";

const DEFAULT_PAIR: Record<string, [string, string]> = {
  india: ["chel", "swam"],
  "us-western": ["mear", "appl"],
};

function verdict(delta: number): { label: string; cls: string } {
  if (delta <= 20) return { label: "Close", cls: "close" };
  if (delta <= 45) return { label: "Split", cls: "split" };
  return { label: "Opposed", cls: "opposed" };
}

export default function ComparePanel({ frameId }: { frameId: string }) {
  const pool = expertsFor(frameId);
  const fallback: [string, string] = [pool[0]?.id ?? "", pool[1]?.id ?? ""];
  const [a, setA] = useState(DEFAULT_PAIR[frameId]?.[0] ?? fallback[0]);
  const [b, setB] = useState(DEFAULT_PAIR[frameId]?.[1] ?? fallback[1]);
  const ea = expertById[a];
  const eb = expertById[b];

  return (
    <section className="card">
      <div className="cmp-head">
        <select value={a} onChange={(e) => setA(e.currentTarget.value)} aria-label="First expert">
          {pool.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <span style={{ fontSize: 12, color: "var(--text-2)" }}>vs</span>
        <select value={b} onChange={(e) => setB(e.currentTarget.value)} aria-label="Second expert">
          {pool.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name}
            </option>
          ))}
        </select>
        <span className="cmp-note">circle = left pick, square = right pick</span>
      </div>

      {topicsFor(frameId).map((t) => {
        const ca = claimFor(a, t.id);
        const cb = claimFor(b, t.id);
        if (!ca || !cb || ca.score == null || cb.score == null) {
          return (
            <div key={t.id} className="cmp-row">
              <span className="cmp-label">{t.label}</span>
              <span className="receipt-meta">
                no indexed position for one of the two
              </span>
              <span />
            </div>
          );
        }
        const v = verdict(Math.abs(ca.score - cb.score));
        return (
          <div key={t.id} className="cmp-row">
            <span className="cmp-label">{t.label}</span>
            <span className="mini-track">
              <span className="mini-bar" />
              <span
                className="marker b"
                title={`${eb.name}: ${cb.score}`}
                style={{
                  background: schoolById[eb.school].dot,
                  left: `calc(${cb.score}% - 6px)`,
                }}
              />
              <span
                className="marker a"
                title={`${ea.name}: ${ca.score}`}
                style={{
                  background: schoolById[ea.school].dot,
                  left: `calc(${ca.score}% - 6px)`,
                }}
              />
            </span>
            <span className={`verdict ${v.cls}`}>{v.label}</span>
          </div>
        );
      })}
    </section>
  );
}
