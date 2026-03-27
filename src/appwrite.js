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
  // Appwrite document IDs must start with a letter
  if (/^[^a-zA-Z]/.test(cleaned)) {
    return "u" + cleaned;
  }
  return cleaned;
}

export function getPhotoUrl(fileId) {
  if (!fileId) return "";
  try {
    return storage.getFilePreview(BUCKET_PHOTOS, fileId).toString();
  } catch {
    return "";
  }
}
