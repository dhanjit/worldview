import { claimFor, expertById, experts, schoolById, topicById, topics } from "../lib/data";

interface Props {
  topicId: string;
  expertId: string;
  onTopic: (id: string) => void;
  onExpert: (id: string) => void;
}

export default function TopicPanel({ topicId, expertId, onTopic, onExpert }: Props) {
  const topic = topicById[topicId];
  const rows = experts
    .map((e) => ({ expert: e, claim: claimFor(e.id, topicId) }))
    .filter((r) => r.claim && r.claim.score != null)
    .sort((a, b) => a.claim!.score! - b.claim!.score!);

  const selected = claimFor(expertId, topicId);
  const selectedExpert = expertById[expertId];

  return (
    <section className="card">
      <div className="chips">
        {topics.map((t) => (
          <button
            key={t.id}
            className={`chip${t.id === topicId ? " active" : ""}`}
            onClick={() => onTopic(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <h2 className="question">{topic.question}</h2>
      <div className="poles">
        <span>← {topic.poleA}</span>
        <span>{topic.poleB} →</span>
      </div>

      <div className="track">
        <div className="track-bar" />
        {rows.map((r, i) => {
          const score = r.claim!.score!;
          const school = schoolById[r.expert.school];
          return (
            <button
              key={r.expert.id}
              className={`tdot${r.expert.id === expertId ? " selected" : ""}`}
              style={{
                left: `calc(${score}% - 13px)`,
                top: i % 2 ? 47 : 7,
                background: school.chip,
              }}
              title={`${r.expert.name} · ${score}/100`}
              aria-label={`${r.expert.name}, position ${score} of 100`}
              onClick={() => onExpert(r.expert.id)}
            >
              {r.expert.initials}
            </button>
          );
        })}
      </div>

      {selected && selectedExpert && (
        <div className="receipt">
          <div className="receipt-head">
            <span className="receipt-name">{selectedExpert.name}</span>
            <span
              className="school-chip"
              style={{ color: schoolById[selectedExpert.school].dot }}
            >
              {schoolById[selectedExpert.school].label}
            </span>
            <span className="receipt-score">
              {selected.score}/100 on this axis
              {selected.type === "will" && selected.aboutWhen
                ? ` · about ${selected.aboutWhen}`
                : ""}
            </span>
          </div>
          <p className="receipt-summary">{selected.summary}</p>
          <div className="receipt-meta">
            <a href={selected.sourceUrl} target="_blank" rel="noreferrer">
              Wikipedia — views section
            </a>{" "}
            · retrieved {selected.retrievedOn} · status: {selected.status}
            {selected.quote == null ? " (no verbatim quote yet)" : ""}
          </div>
        </div>
      )}
    </section>
  );
}
