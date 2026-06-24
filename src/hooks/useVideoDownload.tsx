import { useState, useEffect, useCallback } from 'react';
import { useAuth } from './useAuth';
import { useToast } from './use-toast';
import * as videoStorage from '@/lib/videoStorage';
import type { OfflineVideoMetadata } from '@/lib/videoStorage';
import {saveVideo} from '@/services/downloadService';

interface DownloadProgress {
  videoId: string;
  progress: number;
  status: 'idle' | 'downloading' | 'downloaded' | 'failed';
}

export function useVideoDownload() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [downloads, setDownloads] = useState<Map<string, DownloadProgress>>(new Map());
  const [offlineVideos, setOfflineVideos] = useState<OfflineVideoMetadata[]>([]);
  const [serviceWorkerReady, setServiceWorkerReady] = useState(false);

  // Check if service worker is ready
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then(() => {
        setServiceWorkerReady(true);
      });
    }
  }, []);

  // Load offline videos on mount and user change
  useEffect(() => {
    if (user?.id) {
      loadOfflineVideos();
      cleanupExpiredVideos();
    }
  }, [user?.id]);

  // Load all offline videos for current user
  const loadOfflineVideos = useCallback(async () => {
    if (!user?.id) return;

    try {
      const videos = await videoStorage.getUserVideos(user.id);
      setOfflineVideos(videos);

      // Update downloads state
      const newDownloads = new Map<string, DownloadProgress>();
      videos.forEach((video) => {
        newDownloads.set(video.videoId, {
          videoId: video.videoId,
          progress: video.progress,
          status: video.status as any,
        });
      });
      setDownloads(newDownloads);
    } catch (error) {
      console.error('Failed to load offline videos:', error);
    }
  }, [user?.id]);

  // Cleanup expired videos
  const cleanupExpiredVideos = useCallback(async () => {
    if (!user?.id) return;

    try {
      const expiredVideos = await videoStorage.getExpiredVideos();
      
      for (const video of expiredVideos) {
        if (video.userId === user.id) {
          await deleteVideo(video.videoId, video.videoUrl);
        }
      }

      if (expiredVideos.length > 0) {
        toast({
          title: 'Expired videos removed',
          description: `${expiredVideos.length} expired video(s) were automatically deleted.`,
        });
      }
    } catch (error) {
      console.error('Failed to cleanup expired videos:', error);
    }
  }, [user?.id]);

  // Send message to service worker
  const sendMessageToSW = useCallback((type: string, payload: any): Promise<any> => {
    return new Promise((resolve, reject) => {
      if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) {
        reject(new Error('Service Worker not available'));
        return;
      }

      const messageChannel = new MessageChannel();
      
      messageChannel.port1.onmessage = (event) => {
        if (event.data.success) {
          resolve(event.data);
        } else {
          reject(new Error(event.data.error || 'Unknown error'));
        }
      };

      navigator.serviceWorker.controller.postMessage(
        { type, payload },
        [messageChannel.port2]
      );
    });
  }, []);

  // Download video for offline viewing
  const downloadVideo = useCallback(async (
    videoId: string,
    videoUrl: string,
    title: string,
  ): Promise<void> => {
    if (!user?.id) {
      toast({
        title: 'Authentication required',
        description: 'Please login to download videos for offline viewing.',
        variant: 'destructive',
      });
      return;
    }

    if (!serviceWorkerReady) {
      toast({
        title: 'Service not ready',
        description: 'Please wait for the download service to initialize.',
        variant: 'destructive',
      });
      return;
    }

    // Check if already downloaded
    const existing = await videoStorage.getVideoMetadata(videoId);
    if (existing && existing.status === 'downloaded') {
      toast({
        title: 'Already downloaded',
        description: 'This video is already available offline.',
      });
      return;
    }

    // Update UI state
    setDownloads((prev) => {
      const newMap = new Map(prev);
      newMap.set(videoId, { videoId, progress: 0, status: 'downloading' });
      return newMap;
    });

    try {
      // Save initial metadata
      const metadata: OfflineVideoMetadata = {
        videoId,
        userId: user.id,
        videoUrl,
        title,
        downloadedAt: Date.now(),
        expiresAt: videoStorage.calculateExpiryDate(),
        progress: 0,
        status: 'downloading',
      };
      await videoStorage.saveVideoMetadata(metadata);

      // Start download via service worker
      const response = await fetch(videoUrl);
      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error('Failed to get response reader');
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch video: ${response.status}`);
      }
      
      const chunks: BlobPart[] = [];
      let receivedLength = 0;
      const contentLength = response.headers.get('content-length');
      const total = contentLength ? parseInt(contentLength, 10) : 0;

      while (true) {
        const { done, value } = await reader.read();
        
        if (done) break;

        chunks.push(value);
        receivedLength += value.length;

        // Update progress
        const progress = total > 0 ? (receivedLength / total) * 100 : 0;
        
        setDownloads((prev) => {
          const newMap = new Map(prev);
          newMap.set(videoId, { videoId, progress, status: 'downloading' });
          return newMap;
        });

        

        // Update metadata with progress
        metadata.progress = progress;
        await videoStorage.saveVideoMetadata(metadata);
      }

      // // Combine chunks into blob
      const blob = new Blob(chunks);
      
      // Cache via service worker
      await saveVideo(videoId, blob);

      // Update metadata as completed
      metadata.progress = 100;
      metadata.status = 'downloaded';
      metadata.size = blob.size;
      await videoStorage.saveVideoMetadata(metadata);

      // Update UI state
      setDownloads((prev) => {
        const newMap = new Map(prev);
        newMap.set(videoId, { videoId, progress: 100, status: 'downloaded' });
        return newMap;
      });

      await loadOfflineVideos();

      toast({
        title: 'Download complete',
        description: `"${title}" is now available offline for 7 days.`,
      });
    } catch (error) {
      console.error('Download failed:', error);
      
      // Update state as failed
      setDownloads((prev) => {
        const newMap = new Map(prev);
        newMap.set(videoId, { videoId, progress: 0, status: 'failed' });
        return newMap;
      });

      const metadata = await videoStorage.getVideoMetadata(videoId);
      if (metadata) {
        metadata.status = 'failed';
        await videoStorage.saveVideoMetadata(metadata);
      }

      toast({
        title: 'Download failed',
        description: error instanceof Error ? error.message : 'Failed to download video',
        variant: 'destructive',
      });
    }
  }, [user, serviceWorkerReady, toast, sendMessageToSW, loadOfflineVideos]);

  // Delete offline video
  const deleteVideo = useCallback(async (
    videoId: string,
    videoUrl: string
  ): Promise<void> => {
    if (!user?.id) return;

    try {
      // Delete from service worker cache
      await sendMessageToSW('DELETE_VIDEO', {
        videoId,
        videoUrl,
        userId: user.id,
      });

      // Delete metadata
      await videoStorage.deleteVideoMetadata(videoId);

      // Update state
      setDownloads((prev) => {
        const newMap = new Map(prev);
        newMap.delete(videoId);
        return newMap;
      });

      await loadOfflineVideos();

      toast({
        title: 'Video deleted',
        description: 'Offline video has been removed.',
      });
    } catch (error) {
      console.error('Failed to delete video:', error);
      toast({
        title: 'Delete failed',
        description: 'Failed to delete offline video',
        variant: 'destructive',
      });
    }
  }, [user, sendMessageToSW, loadOfflineVideos, toast]);

  // Check if video is available offline
  const isVideoOffline = useCallback(async (
    videoId: string
  ): Promise<boolean> => {
    if (!user?.id) return false;
    return videoStorage.isVideoAvailableOffline(videoId, user.id);
  }, [user?.id]);

  // Get download progress for a video
  const getDownloadProgress = useCallback((videoId: string): DownloadProgress => {
    return downloads.get(videoId) || { videoId, progress: 0, status: 'idle' };
  }, [downloads]);

  // Clear all offline videos
  const clearAllVideos = useCallback(async (): Promise<void> => {
    if (!user?.id) return;

    try {
      await sendMessageToSW('CLEAR_ALL', {});
      await videoStorage.clearUserVideos(user.id);
      
      setDownloads(new Map());
      setOfflineVideos([]);

      toast({
        title: 'All videos cleared',
        description: 'All offline videos have been removed.',
      });
    } catch (error) {
      console.error('Failed to clear videos:', error);
      toast({
        title: 'Clear failed',
        description: 'Failed to clear offline videos',
        variant: 'destructive',
      });
    }
  }, [user, sendMessageToSW, toast]);

  return {
    downloadVideo,
    deleteVideo,
    isVideoOffline,
    getDownloadProgress,
    clearAllVideos,
    offlineVideos,
    serviceWorkerReady,
  };
}
