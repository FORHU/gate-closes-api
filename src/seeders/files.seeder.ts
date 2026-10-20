import { Db, ObjectId } from "mongodb";
import { MFile } from "../models/file.model";
import { log, randomInt } from "./helpers";

/** 20 fake voice-note files the demo echoes and messages point at. */
export async function seedFiles(db: Db): Promise<ObjectId[]> {
  const ids: ObjectId[] = [];
  for (let i = 1; i <= 20; i += 1) {
    const file = new MFile({
      fileUrl: `https://gate-closes-seed.s3.amazonaws.com/voice-notes/voice-${i}.m4a`,
      fileName: `voice-${i}.m4a`,
      metaData: { mimeType: "audio/m4a", durationSec: randomInt(2, 45) },
    });
    await db.collection("file").insertOne(file);
    ids.push(file._id!);
  }
  log(`files: ${ids.length}`);
  return ids;
}
