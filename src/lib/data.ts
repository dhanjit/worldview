import type { Claim, Expert, School, Topic } from "./types";
import topicsJson from "../data/topics.json";
import expertsJson from "../data/experts.json";
import schoolsJson from "../data/schools.json";
import claimsJson from "../data/claims.json";

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

/** The claim an expert holds on a topic, matching the topic's claim type and frame. */
export function claimFor(expertId: string, topicId: string): Claim | undefined {
  const topic = topicById[topicId];
  if (!topic) return undefined;
  return claims.find(
    (c) =>
      c.expertId === expertId &&
      c.topicId === topicId &&
      c.type === topic.type &&
      c.frame === topic.frame,
  );
}
