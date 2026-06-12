import { useState } from "react";
import Wheel from "./components/Wheel";
import TopicPanel from "./components/TopicPanel";
import ComparePanel from "./components/ComparePanel";
import { frames, schoolsFor } from "./lib/data";

const DEFAULTS: Record<string, { topic: string; expert: string }> = {
  india: { topic: "chn-in", expert: "chel" },
  "us-western": { topic: "ukr", expert: "mear" },
};

export default function App() {
  const [frameId, setFrameId] = useState("india");
  const [topicId, setTopicId] = useState(DEFAULTS.india.topic);
  const [expertId, setExpertId] = useState(DEFAULTS.india.expert);
  const frame = frames.find((f) => f.id === frameId)!;

  function switchFrame(id: string) {
    if (id === frameId) return;
    setFrameId(id);
    setTopicId(DEFAULTS[id].topic);
    setExpertId(DEFAULTS[id].expert);
  }

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Worldview</h1>
          <p className="tagline">{frame.tagline}</p>
        </div>
        <span className="badge badge-warn">pre-alpha · illustrative data</span>
      </header>

      <div className="chips" style={{ margin: "10px 0 4px" }}>
        {frames.map((f) => (
          <button
            key={f.id}
            className={`chip${f.id === frameId ? " active" : ""}`}
            onClick={() => switchFrame(f.id)}
            aria-pressed={f.id === frameId}
          >
            {f.label}
          </button>
        ))}
        <span className="cmp-note" style={{ alignSelf: "center" }}>
          a perspective is its own wheel — own questions, own roster
        </span>
      </div>

      <Wheel
        frameId={frameId}
        topicId={topicId}
        expertId={expertId}
        onSelect={(t, e) => {
          setTopicId(t);
          if (e) setExpertId(e);
        }}
      />

      <div className="legend">
        {schoolsFor(frameId).map((s) => (
          <span key={s.id} className="legend-item">
            <span className="swatch" style={{ background: s.dot }} />
            {s.label}
          </span>
        ))}
      </div>
      <p className="hint">
        Each sector is one question. Center to rim traces that question's axis;
        color is school of thought. Click any dot or sector to drill in.
      </p>

      <TopicPanel
        frameId={frameId}
        topicId={topicId}
        expertId={expertId}
        onTopic={setTopicId}
        onExpert={setExpertId}
      />

      <ComparePanel key={frameId} frameId={frameId} />

      <footer className="footer">
        All positions are hand-scored placeholders for now — after extraction
        lands, every dot carries a verbatim quote, source link and as-of date.
        Source text comes from Wikipedia (CC BY-SA 4.0), which cites the
        underlying primary sources. Methodology:{" "}
        <a
          href="https://github.com/dhanjit/worldview/blob/main/docs/DESIGN.md"
          target="_blank"
          rel="noreferrer"
        >
          docs/DESIGN.md
        </a>
        .
      </footer>
    </div>
  );
}
