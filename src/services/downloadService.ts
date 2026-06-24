import { dbPromise } from "./indexedDB";

export async function saveVideo(
    videoId: string, 
    blob: Blob) 
    {
    const db = await dbPromise;

    await db.put("videos", {
        videoId,
        blob,
        downloadedAt: Date.now(),
    });
}

// Check if downloaded
export async function isDownloaded(videoId: string) {
  const db = await dbPromise;
  return !!(await db.get("videos", videoId));
}

// Delete downloaded video
export async function deleteVideo(videoId: string) {
  const db = await dbPromise;
  await db.delete("videos", videoId);
}

// Get all downloaded videos
export async function getAllDownloads() {
  const db = await dbPromise;
  return db.getAll("videos");
}