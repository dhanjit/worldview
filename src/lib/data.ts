import type { Claim, Expert, Frame, School, Topic } from "./types";
import framesJson from "../data/frames.json";
import topicsJson from "../data/topics.json";
import expertsJson from "../data/experts.json";
import schoolsJson from "../data/schools.json";
import claimsJson from "../data/claims.json";

export const frames = framesJson as unknown as Frame[];
export const topics = topicsJson as unknown as Topic[];
export const experts = expertsJson as unknown as Expert[];
export const schools = schoolsJson as unknown as School[];
export const claims = claimsJson as unknown as Claim[];

export const schoolById: Record<string, School> = Object.fromEntries(
  schools.map((s) => [s.id, s]),
);
export const expertById: Record<string, Expert> = Object.fromEntries(
  experts.map((e) => [e.id, e]),
);
export const topicById: Record<string, Topic> = Object.fromEntries(
  topics.map((t) => [t.id, t]),
);

export function topicsFor(frameId: string): Topic[] {
  return topics.filter((t) => t.frame === frameId);
}

export function expertsFor(frameId: string): Expert[] {
  return experts.filter((e) => e.wheels.includes(frameId));
}

export function schoolsFor(frameId: string): School[] {
  const present = new Set(expertsFor(frameId).map((e) => e.school));
  return schools.filter((s) => present.has(s.id));
}

/** A frame is "real" once its claims are extracted/reviewed rather than illustrative placeholders. */
export function frameIsReal(frameId: string): boolean {
  return claims.some((c) => c.frame === frameId && c.status !== "illustrative");
}

function recency(c: Claim): string {
  return c.saidOn ?? c.retrievedOn;
}

/**
 * Every recorded position an expert has held on a topic, newest first.
 * Claims are append-only: a changed mind is a new claim with a newer saidOn,
 * never an overwrite. This is the query behind the future drift/timeline view.
 */
export function claimHistoryFor(expertId: string, topicId: string): Claim[] {
  const topic = topicById[topicId];
  if (!topic) return [];
  return claims
    .filter(
      (c) =>
        c.expertId === expertId &&
        c.topicId === topicId &&
        c.type === topic.type &&
        c.frame === topic.frame,
    )
    .sort(
      (a, b) =>
        recency(b).localeCompare(recency(a)) ||
        b.retrievedOn.localeCompare(a.retrievedOn) ||
        a.id.localeCompare(b.id),
    );
}

/** The expert's LATEST position on a topic — the only claim views may render as current. */
export function claimFor(expertId: string, topicId: string): Claim | undefined {
  return claimHistoryFor(expertId, topicId)[0];
}
