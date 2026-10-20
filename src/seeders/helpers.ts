import { ObjectId } from "mongodb";

/** Small helpers shared by the seeders. */

export const REACTIONS = ["like", "love", "haha", "wow", "sad", "angry"] as const;
export type Reaction = (typeof REACTIONS)[number];

/** "love" → "countReactLove", the counter field on echoes and messages. */
export const reactionCountField = (reaction: Reaction) =>
  `countReact${reaction[0].toUpperCase()}${reaction.slice(1)}`;

export const randomItem = <T>(items: readonly T[]): T =>
  items[Math.floor(Math.random() * items.length)];

export const randomInt = (min: number, max: number) =>
  min + Math.floor(Math.random() * (max - min + 1));

/** Now plus [days] (negative = in the past). */
export const dateOffsetDays = (days: number) => new Date(Date.now() + days * 24 * 60 * 60 * 1000);

/** The same key for a pair of users whatever their order (conversation dmKey). */
export const dmKeyForUsers = (a: ObjectId, b: ObjectId) => {
  const sa = a.toHexString();
  const sb = b.toHexString();
  return sa < sb ? `${sa}:${sb}` : `${sb}:${sa}`;
};

/** Up to [count] distinct random pairs of different users. */
export const uniquePairs = (ids: ObjectId[], count: number): [ObjectId, ObjectId][] => {
  const seen = new Set<string>();
  const pairs: [ObjectId, ObjectId][] = [];
  let attempts = 0;
  while (pairs.length < count && attempts < count * 25) {
    attempts += 1;
    const a = randomItem(ids);
    const b = randomItem(ids);
    if (a.equals(b)) continue;
    const key = dmKeyForUsers(a, b);
    if (seen.has(key)) continue;
    seen.add(key);
    pairs.push([a, b]);
  }
  return pairs;
};

/** A demo user as the later seeders need it. */
export type SeededUser = { _id: ObjectId; username: string };

/** One line per seeder, same format everywhere. */
export const log = (message: string) => console.log(`[seed] ${message}`);
