import { useState } from "react";
import Wheel from "./components/Wheel";
import TopicPanel from "./components/TopicPanel";
import ComparePanel from "./components/ComparePanel";
import { schools } from "./lib/data";

export default function App() {
  const [topicId, setTopicId] = useState("ukr");
  const [expertId, setExpertId] = useState("mear");

  return (
    <div className="app">
      <header className="header">
        <div>
          <h1>Worldview</h1>
          <p className="tagline">
            Where public experts stand on the big questions — with receipts
          </p>
        </div>
        <span className="badge badge-warn">pre-alpha · illustrative data</span>
      </header>

      <Wheel
        topicId={topicId}
        expertId={expertId}
        onSelect={(t, e) => {
          setTopicId(t);
          if (e) setExpertId(e);
        }}
      />

      <div className="legend">
        {schools.map((s) => (
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
        topicId={topicId}
        expertId={expertId}
        onTopic={setTopicId}
        onExpert={setExpertId}
      />

      <ComparePanel />

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
