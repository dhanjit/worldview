const ISSUE_URL =
  "https://github.com/dhanjit/worldview/issues/new?title=Correction%20request%3A%20";

export default function Methodology() {
  return (
    <article className="prose">
      <h2>What this is</h2>
      <p>
        Worldview maps where named public experts stand on the questions that
        matter — rendered as an opinion wheel, with every position carrying a
        receipt: a source link, dates, and (once extraction lands) a verbatim
        quote. The default wheel covers India's national debates; a second
        wheel carries the US/Western ones. A perspective here is its own wheel
        with its own questions and roster — never a "neutral" view, only an
        explicit one.
      </p>
      <p>
        <strong>Current status: pre-alpha.</strong> Every position shown today
        is a hand-scored, clearly-labeled placeholder ("status: illustrative")
        pending automated extraction with verbatim quotes. Treat the dots as a
        demonstration of the product, not as settled characterizations.
      </p>

      <h2>How a position becomes a dot</h2>
      <ul>
        <li>
          The unit of data is a <strong>claim record</strong>: expert × question ×
          claim type (<em>should</em> / <em>is</em> / <em>will</em>), a 0–100 score
          along a published axis, a one-line summary, a verbatim quote, a source
          URL, and two dates — when it was said and (for predictions) what period
          it concerns.
        </li>
        <li>
          Claims are extracted from each expert's Wikipedia "views" sections —
          where statements arrive already cited to primary sources — then pass
          two mechanical checks: the output must match the claim schema, and
          every quote must appear verbatim in the source text or it is discarded.
        </li>
        <li>
          Extracted claims sit in a staging area until a human reviews them.
          Status is visible on every receipt: illustrative → extracted → reviewed.
        </li>
        <li>
          Claims are append-only. When an expert's position changes, a new claim
          is added and the newest renders — drift over time is data, not an edit.
        </li>
      </ul>

      <h2>Rules we hold ourselves to</h2>
      <ul>
        <li>
          <strong>No stance without a receipt.</strong> A score never appears
          without its source, dates, and status.
        </li>
        <li>
          <strong>Axes are editorial and published.</strong> Every question's
          0–100 scale has a written rubric; changing an axis's wording means
          re-scoring every claim on it.
        </li>
        <li>
          <strong>Composition, never ventriloquism.</strong> Nothing on this
          site invents what a named person "would" say. Future composed answers
          may only assemble real claims, labeled as direct, school-level, or a
          declared gap.
        </li>
        <li>
          <strong>Silence is data.</strong> If an expert has no public position
          on an axis, no dot appears — we say so rather than guessing.
        </li>
        <li>
          <strong>The hottest axes wait for receipts.</strong> On the India
          wheel, the most contested culture-war questions are deliberately
          excluded until extraction provides verbatim, dated quotes — placeholder
          scores on those topics would be exactly the misrepresentation this
          design exists to prevent.
        </li>
      </ul>

      <h2>Who gets on a wheel</h2>
      <p>
        Public intellectuals with a substantive Wikipedia page and a public
        corpus of positions (books, columns, interviews), chosen for a mix of
        schools of thought per wheel. Former officials are eligible; sitting
        policymakers are excluded — their statements are constrained speech,
        not analysis. The full criteria and rubrics live in the open
        methodology document:{" "}
        <a
          href="https://github.com/dhanjit/worldview/blob/main/docs/DESIGN.md"
          target="_blank"
          rel="noreferrer"
        >
          docs/DESIGN.md
        </a>
        .
      </p>

      <h2>Think we've misread someone?</h2>
      <p>
        Corrections are part of the design, not an embarrassment.{" "}
        <a href={ISSUE_URL} target="_blank" rel="noreferrer">
          Open a correction request
        </a>{" "}
        with the expert, the axis, and ideally a link to what they actually
        said — disputes are resolved against sources, and the receipt updates
        with the resolution.
      </p>

      <h2>Sources and licensing</h2>
      <p>
        Source text comes from Wikipedia under{" "}
        <a
          href="https://creativecommons.org/licenses/by-sa/4.0/"
          target="_blank"
          rel="noreferrer"
        >
          CC BY-SA 4.0
        </a>
        , quoted verbatim and linked, with the underlying primary citations
        preferred where available. This site is an independent project and is
        not affiliated with any expert shown on it.
      </p>
    </article>
  );
}
