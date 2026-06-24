// IndexedDB utilities for managing offline video metadata

const DB_NAME = 'lms-video-db';
const DB_VERSION = 1;
const STORE_NAME = 'videos';
const EXPIRY_DAYS = 7;

export interface OfflineVideoMetadata {
  videoId: string;
  userId: string;
  videoUrl: string;
  title: string;
  downloadedAt: number;
  expiresAt: number;

  blob?: Blob;

  size?: number;
  progress: number;
  status: 'downloading' | 'downloaded' | 'failed';
}

// Initialize IndexedDB
function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => resolve(request.result);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Create object store if it doesn't exist
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'videoId' });
        store.createIndex('userId', 'userId', { unique: false });
        store.createIndex('expiresAt', 'expiresAt', { unique: false });
        store.createIndex('status', 'status', { unique: false });
      }
    };
  });
}

// Add or update video metadata
export async function saveVideoMetadata(metadata: OfflineVideoMetadata): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.put(metadata);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get video metadata by ID
export async function getVideoMetadata(videoId: string): Promise<OfflineVideoMetadata | null> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(videoId);

    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error);
  });
}

// Get all videos for a user
export async function getUserVideos(userId: string): Promise<OfflineVideoMetadata[]> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('userId');
    const request = index.getAll(userId);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Delete video metadata
export async function deleteVideoMetadata(videoId: string): Promise<void> {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(videoId);

    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Get expired videos
export async function getExpiredVideos(): Promise<OfflineVideoMetadata[]> {
  const db = await openDatabase();
  const now = Date.now();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const index = store.index('expiresAt');
    const range = IDBKeyRange.upperBound(now);
    const request = index.getAll(range);

    request.onsuccess = () => resolve(request.result || []);
    request.onerror = () => reject(request.error);
  });
}

// Clear all video metadata for a user
export async function clearUserVideos(userId: string): Promise<void> {
  const videos = await getUserVideos(userId);
  const db = await openDatabase();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);

    let completed = 0;
    const total = videos.length;

    if (total === 0) {
      resolve();
      return;
    }

    videos.forEach((video) => {
      const request = store.delete(video.videoId);
      request.onsuccess = () => {
        completed++;
        if (completed === total) resolve();
      };
      request.onerror = () => reject(request.error);
    });
  });
}

// Calculate expiry date
export function calculateExpiryDate(days: number = EXPIRY_DAYS): number {
  return Date.now() + days * 24 * 60 * 60 * 1000;
}

// Check if video is expired
export function isVideoExpired(expiresAt: number): boolean {
  return Date.now() > expiresAt;
}

// Check if video is available offline
export async function isVideoAvailableOffline(
  videoId: string,
  userId: string
): Promise<boolean> {
  const metadata = await getVideoMetadata(videoId);
  
  if (!metadata) return false;
  if (metadata.userId !== userId) return false;
  if (metadata.status !== 'downloaded') return false;
  if (isVideoExpired(metadata.expiresAt)) return false;
  
  return true;
}

// Get storage usage statistics
export async function getStorageStats(userId: string): Promise<{
  totalVideos: number;
  totalSize: number;
  expiredVideos: number;
}> {
  const videos = await getUserVideos(userId);
  const expiredVideos = videos.filter(v => isVideoExpired(v.expiresAt));
  
  return {
    totalVideos: videos.length,
    totalSize: videos.reduce((sum, v) => sum + (v.size || 0), 0),
    expiredVideos: expiredVideos.length,
  };
}

export async function getVideoBlob(
  videoId: string
): Promise<Blob | null> {

  const video = await getVideoMetadata(videoId);

  return video?.blob ?? null;

}

export async function playOfflineVideo(videoId: string){
  const blob = await getVideoBlob(videoId);
  if (!blob) return null;
  return URL.createObjectURL(blob);
} 