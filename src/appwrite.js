import { Client, Databases, Storage, ID, Query } from "appwrite";

const client = new Client()
  .setEndpoint(import.meta.env.VITE_APPWRITE_ENDPOINT)
  .setProject(import.meta.env.VITE_APPWRITE_PROJECT_ID);

export const databases = new Databases(client);
export const storage = new Storage(client);

export const DATABASE_ID = import.meta.env.VITE_APPWRITE_DATABASE_ID;
export const COLLECTION_USERS = "users";
export const COLLECTION_POLLS = "polls";
export const COLLECTION_VOTES = "votes";
export const COLLECTION_VOTE_LOG = "voteLog";
export const BUCKET_PHOTOS = "candidate-photos";

export { ID, Query };

export function sanitizeId(id) {
  const cleaned = id.replace(/[^a-zA-Z0-9._-]/g, "-");
  if (/^[^a-zA-Z]/.test(cleaned)) {
    return "u" + cleaned;
  }
  return cleaned;
}

export function getPhotoUrl(fileId) {
  if (!fileId) return "";
  try {
    return storage.getFilePreview(
      BUCKET_PHOTOS,
      fileId,
      200,  // width
      200,  // height
      undefined, // gravity
      80,   // quality
      0,    // borderWidth
      "",   // borderColor
      0,    // borderRadius
      1,    // opacity
      0,    // rotation
      "ffffff", // background
      "webp"  // output
    ).toString();
  } catch {
    return "";
  }
}

/**
 * Check which Appwrite collections/buckets exist.
 * Returns { collections: {name: bool}, bucket: bool }
 */
export async function checkSetup() {
  const result = { collections: {}, bucket: false, errors: [] };
  const collectionNames = [COLLECTION_USERS, COLLECTION_POLLS, COLLECTION_VOTES, COLLECTION_VOTE_LOG];

  for (const name of collectionNames) {
    try {
      await databases.listDocuments(DATABASE_ID, name, [Query.limit(1)]);
      result.collections[name] = true;
    } catch (err) {
      result.collections[name] = false;
      result.errors.push(`Collection "${name}" missing or inaccessible`);
    }
  }

  try {
    await storage.listFiles(BUCKET_PHOTOS);
    result.bucket = true;
  } catch {
    result.bucket = false;
    result.errors.push(`Storage bucket "${BUCKET_PHOTOS}" missing or inaccessible`);
  }

  return result;
}
