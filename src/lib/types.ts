export type ClaimType = "should" | "is" | "will";
export type ClaimStatus = "illustrative" | "extracted" | "reviewed";
export type Confidence = "placeholder" | "low" | "medium" | "high";

export interface School {
  id: string;
  label: string;
  /** Mid-tone color for wheel dots and legend swatches (works in light and dark). */
  dot: string;
  /** Darker color for chips that carry light text. */
  chip: string;
}

export interface Expert {
  id: string;
  name: string;
  initials: string;
  school: string;
  wikipedia: string;
  /** Which wheels (frames) this expert appears on. */
  wheels: string[];
}

export interface Topic {
  id: string;
  /** Whose debate this axis belongs to, e.g. "us-western". A perspective is its own wheel, never a filter. */
  frame: string;
  /** The claim type this axis expects: should (policy), is (assessment), will (prediction). */
  type: ClaimType;
  label: string;
  question: string;
  poleA: string;
  poleB: string;
}

/**
 * The atom of the whole product. Every view (wheel, spectrum, compare,
 * state-of-the-world, futures, composed answers) is a query over claims.
 * A claim with no receipt (sourceUrl + dates) must never be rendered as fact.
 */
export interface Claim {
  id: string;
  expertId: string;
  topicId: string;
  type: ClaimType;
  frame: string;
  /** 0–100 along the topic's axis (poleA = 0, poleB = 100), or null if unscorable. */
  score: number | null;
  summary: string;
  /** Verbatim quote backing the claim. Null only while status is "illustrative". */
  quote: string | null;
  sourceUrl: string;
  /** When the expert said it (ISO date), as best known. */
  saidOn: string | null;
  /** What period the claim is about — only meaningful for "will" claims. */
  aboutWhen: string | null;
  retrievedOn: string;
  confidence: Confidence;
  status: ClaimStatus;
}
