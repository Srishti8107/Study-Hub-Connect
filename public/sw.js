// Service Worker for LMS Video Caching
const CACHE_NAME = 'lms-videos-v1';
const VIDEO_CACHE_NAME = 'lms-video-files-v1';

self.addEventListener('install', (event) => {
  console.log('[SW] Installing Service Worker...');
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  console.log('[SW] Activating Service Worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME && name !== VIDEO_CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    })
  );
  return self.clients.claim();
});

// Handle fetch events - intercept video requests
self.addEventListener('fetch', (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Only cache video files
  if (request.method === 'GET' && 
      (request.headers.get('range') || url.pathname.endsWith('.mp4'))) {
    
    event.respondWith(
      caches.open(VIDEO_CACHE_NAME).then((cache) => {
        return cache.match(request).then((cachedResponse) => {
          if (cachedResponse) {
            console.log('[SW] Serving from cache:', url.pathname);
            return cachedResponse;
          }

          // Not in cache, fetch from network
          return fetch(request).then((response) => {
            // Don't cache if not a successful response
            if (!response || response.status !== 200) {
              return response;
            }
            
            return response;
          });
        });
      })
    );
  }
});

// Handle messages from main thread
self.addEventListener('message', (event) => {
  const { type, payload } = event.data;

  switch (type) {
    case 'CACHE_VIDEO':
      handleCacheVideo(event, payload);
      break;
    case 'DELETE_VIDEO':
      handleDeleteVideo(event, payload);
      break;
    case 'CHECK_CACHE':
      handleCheckCache(event, payload);
      break;
    case 'CLEAR_ALL':
      handleClearAll(event);
      break;
    default:
      console.log('[SW] Unknown message type:', type);
  }
});

// Cache a video file
async function handleCacheVideo(event, { videoId, videoUrl, userId }) {
  try {
    console.log('[SW] Caching video:', videoId);
    const cacheKey = `video-${userId}-${videoId}`;
    const cache = await caches.open(VIDEO_CACHE_NAME);
    await cache.put(new Request(cacheKey), response);
    // Fetch the video
    const response = await fetch(videoUrl);

    if (!response.ok) {
      throw new Error(`Failed to fetch video: ${response.status}`);
    }
    const responseClone = response.clone();

    const blob= await response.blob();
       
    // Store in cache with custom key including userId for access control
  


    // Also cache with original URL for playback
    await cache.put(videoUrl, responseClone);

    event.ports[0].postMessage({ 
      success: true, 
      videoId,
      message: 'Video cached successfully'
    });
  } catch (error) {
    console.error('[SW] Error caching video:', error);
    event.ports[0].postMessage({ 
      success: false, 
      videoId,
      error: error.message 
    });
  }
}

// Delete a cached video
async function handleDeleteVideo(event, { videoId, videoUrl, userId }) {
  try {
    const cache = await caches.open(VIDEO_CACHE_NAME);
    const cacheKey = `video-${userId}-${videoId}`;
    
    await cache.delete(cacheKey);
    await cache.delete(videoUrl);

    event.ports[0].postMessage({ 
      success: true, 
      videoId,
      message: 'Video deleted from cache'
    });
  } catch (error) {
    console.error('[SW] Error deleting video:', error);
    event.ports[0].postMessage({ 
      success: false, 
      videoId,
      error: error.message 
    });
  }
}

// Check if video is cached
async function handleCheckCache(event, { videoUrl }) {
  try {
    const cache = await caches.open(VIDEO_CACHE_NAME);
    const response = await cache.match(videoUrl);
    
    event.ports[0].postMessage({ 
      success: true,
      cached: !!response
    });
  } catch (error) {
    event.ports[0].postMessage({ 
      success: false,
      cached: false,
      error: error.message 
    });
  }
}

// Clear all cached videos
async function handleClearAll(event) {
  try {
    await caches.delete(VIDEO_CACHE_NAME);
    await caches.open(VIDEO_CACHE_NAME); // Recreate empty cache
    
    event.ports[0].postMessage({ 
      success: true,
      message: 'All videos cleared'
    });
  } catch (error) {
    event.ports[0].postMessage({ 
      success: false,
      error: error.message 
    });
  }
}
