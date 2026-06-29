import { useRef, useEffect, useState, memo } from "react";
import { Video, Subject } from "@/data/subjects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Play, Pause, Clock, CheckCircle2, Download, Volume2, VolumeX, Maximize, RotateCcw, Trash2, WifiOff, Loader2, BookOpen, Video as VideoIcon } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { useAuth } from "@/hooks/useAuth";
import { useVideoDownload } from "@/hooks/useVideoDownload";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";
import { useToast } from "@/hooks/use-toast";
import * as videoStorage from '@/lib/videoStorage';


// VideoCard Component
interface VideoCardProps {
  video: Video;
  onClick: () => void;
  isSelected: boolean;
  progress?: {
    percentage: number;
    completed: boolean;
  };
}
export function getVideoSrc(video: Video) {
  const [src, setSrc] = useState<string>('');

  useEffect(() => {
    let active = true;
    
    async function checkStorage() {
      const offlineUrl = await videoStorage.playOfflineVideo(video.id);
      if (!active) return;
      setSrc(offlineUrl || video.url);
    }

    checkStorage();
    return () => { active = false; };
  }, [video.id, video.url]);

  return src;
}

export const VideoCard = memo(function VideoCard({ video, onClick, isSelected, progress }: VideoCardProps) {
  const { user } = useAuth();
  const { isVideoOffline } = useVideoDownload();
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    let mounted = true;
    if (user?.id) {
      isVideoOffline(video.id).then((offline) => {
        if (mounted) {
          setIsOffline(offline);
        }
      });
    } else {
      setIsOffline(false);
    }
    return () => {
      mounted = false;
    };
  }, [video.id, user?.id, isVideoOffline]);
  return (
    <Card
      onClick={onClick}
      className={`group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-md ${
        isSelected
          ? "ring-2 ring-primary"
          : "hover:ring-1 hover:ring-primary/30"
      }`}
    >
      <CardContent className="p-0">
        <div className="relative aspect-video overflow-hidden">
          <img
            src={video.thumbnail}
            alt={video.title}
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center">
            <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
              <Play className="h-6 w-6 text-primary ml-1" fill="currentColor" />
            </div>
          </div>
          
          <Badge className="absolute top-2 right-2 bg-black/70 text-white border-0">
            <Clock className="mr-1 h-3 w-3" />
            {video.duration}
          </Badge>
          
          {isOffline && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-green-600 text-white border-0">
                <Download className="mr-1 h-3 w-3" />
                Offline
              </Badge>
            </div>
          )}
          
          {progress?.completed && !isOffline && (
            <div className="absolute top-2 left-2">
              <Badge className="bg-success text-success-foreground border-0">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                Completed
              </Badge>
            </div>
          )}
          
          {progress && progress.percentage > 0 && (
            <div className="absolute bottom-0 left-0 right-0">
              <Progress value={progress.percentage} className="h-1 rounded-none" />
            </div>
          )}
        </div>
        
        <div className="p-3">
          <h4 className="font-medium text-sm mb-1 line-clamp-1 group-hover:text-primary transition-colors">
            {video.title}
          </h4>
          <p className="text-xs text-muted-foreground line-clamp-2">
            {video.description}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if meaningful values change
  return (
    prevProps.video.id === nextProps.video.id &&
    prevProps.isSelected === nextProps.isSelected &&
    prevProps.progress?.percentage === nextProps.progress?.percentage &&
    prevProps.progress?.completed === nextProps.progress?.completed
  );
});

// VideoList Component
interface VideoListProps {
  subject: Subject;
  selectedVideo: Video | null;
  onSelectVideo: (video: Video) => void;
  getProgress: (videoId: string) => { percentage: number; completed: boolean };
}

export const VideoList = memo(function VideoList({ subject, selectedVideo, onSelectVideo, getProgress }: VideoListProps) {
  return (
    <Card className="shadow-card">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <BookOpen className="h-5 w-5 text-primary" />
          Videos in {subject.name}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {subject.videos.map((video) => (
            <VideoCard
              key={video.id}
              video={video}
              onClick={() => onSelectVideo(video)}
              isSelected={selectedVideo?.id === video.id}
              progress={getProgress(video.id)}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
});

// VideoPlayer Component
interface VideoPlayerProps {
  video: Video;
  startTime?: number;
  onTimeUpdate: (currentTime: number, duration: number) => void;
  wasCompleted?: boolean;
  onPlayNext?: () => void;
  hasNextVideo?: boolean;
  autoPlay?: boolean;
  onAutoPlayHandled?: () => void;
}

export function VideoPlayer({ video, startTime = 0, onTimeUpdate, wasCompleted = false, onPlayNext, hasNextVideo = false, autoPlay = false, onAutoPlayHandled }: VideoPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [isOfflineAvailable, setIsOfflineAvailable] = useState(false);
  const [isPersistentlyCompleted, setIsPersistentlyCompleted] = useState(wasCompleted);
  const lastSaveTimeRef = useRef<number>(0);
  const hasSetInitialTimeRef = useRef<boolean>(false);
  const hasShownCompletionRef = useRef<boolean>(false);
  const wasCompletedOnLoadRef = useRef<boolean>(false);
  const { role, user } = useAuth();
  const { downloadVideo, deleteVideo, getDownloadProgress, isVideoOffline } = useVideoDownload();
  const isOnline = useOnlineStatus();
  const { toast } = useToast();
  
  const downloadProgress = getDownloadProgress(video.id);

  // Check if video is available offline
  useEffect(() => {
    let mounted = true;
    if (user?.id) {
      isVideoOffline(video.id).then((offline) => {
        if (mounted) {
          setIsOfflineAvailable(offline);
        }
      });
    } else {
      setIsOfflineAvailable(false);
    }
    return () => {
      mounted = false;
    };
  }, [video.id, user?.id]);

  // Reset tracking when video changes
  useEffect(() => {
    hasSetInitialTimeRef.current = false;
    hasShownCompletionRef.current = false;
    wasCompletedOnLoadRef.current = wasCompleted; // Use the passed prop
    setIsPersistentlyCompleted(wasCompleted);
    setCurrentTime(0);
    setIsPlaying(false);
  }, [video.id]);

  // Update completion state when it loads asynchronously
  useEffect(() => {
    wasCompletedOnLoadRef.current = wasCompleted;
    setIsPersistentlyCompleted(wasCompleted);
  }, [wasCompleted]);

  // Seek to startTime when progress loads after video metadata is already available
  useEffect(() => {
    const vid = videoRef.current;
    if (
      !hasSetInitialTimeRef.current &&
      startTime > 0 &&
      vid &&
      vid.readyState >= 1 && // HAVE_METADATA
      vid.duration > 0
    ) {
      const safeStartTime = Math.min(startTime, vid.duration);
      vid.currentTime = safeStartTime;
      setCurrentTime(safeStartTime);
      hasSetInitialTimeRef.current = true;
    }
  }, [startTime]);

  // Save progress before page unload (refresh / close)
  useEffect(() => {
    const handleBeforeUnload = () => {
      const vid = videoRef.current;
      if (vid && vid.duration > 0 && vid.currentTime > 0) {
        onTimeUpdate(vid.currentTime, vid.duration);
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [onTimeUpdate]);

  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (video && video.duration > 0) {
      const newTime = video.currentTime;
      const percentage = (newTime / video.duration) * 100;
      
      // Update UI less frequently to reduce re-renders
      if (Math.abs(newTime - currentTime) >= 0.5) {
        setCurrentTime(newTime);
      }
      
      // Only save progress every 5 seconds to prevent performance issues
      const now = Date.now();
      if (now - lastSaveTimeRef.current >= 5000) {
        lastSaveTimeRef.current = now;
        onTimeUpdate(newTime, video.duration);
      }
      
      // Check for completion (90% or more is considered complete)
      if (percentage >= 90 && !hasShownCompletionRef.current) {
        hasShownCompletionRef.current = true;
        wasCompletedOnLoadRef.current = false; // Clear flag once we reach completion
        setIsPersistentlyCompleted(true);
        // Save final progress
        onTimeUpdate(newTime, video.duration);
        // Show completion toast
        toast({
          title: "Video Completed! 🎉",
          description: `You've completed "${video.title}". Keep up the great work!`,
        });
      }
    }
  };

  const handleLoadedMetadata = () => {
    const video = videoRef.current;
    if (video) {
      setDuration(video.duration);
      // Track if video was completed when loaded
      wasCompletedOnLoadRef.current = wasCompleted;
      
      // Only set initial time once when video first loads
      if (!hasSetInitialTimeRef.current && startTime > 0 && video.duration > 0) {
        const safeStartTime = Math.min(startTime, video.duration);
        video.currentTime = safeStartTime;
        setCurrentTime(safeStartTime);
        hasSetInitialTimeRef.current = true;
      }

      if (autoPlay) {
        video.play()
          .then(() => {
            setIsPlaying(true);
          })
          .catch(() => {
            setIsPlaying(false);
          })
          .finally(() => {
            onAutoPlayHandled?.();
          });
      }
    }
  };

  // Save progress when component unmounts or video changes
  useEffect(() => {
    return () => {
      const video = videoRef.current;
      if (video && video.duration > 0 && video.currentTime > 0) {
        onTimeUpdate(video.currentTime, video.duration);
      }
    };
  }, [video.id, onTimeUpdate]);

  const togglePlay = () => {
    const video = videoRef.current;
    if (video) {
      if (isPlaying) {
        video.pause();
        // Save progress when pausing
        if (video.duration > 0) {
          onTimeUpdate(video.currentTime, video.duration);
        }
      } else {
        video.play();
      }
      setIsPlaying(!isPlaying);
    }
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (video) {
      video.muted = !isMuted;
      setIsMuted(!isMuted);
    }
  };

  const handleVolumeChange = (value: number[]) => {
    const video = videoRef.current;
    if (video) {
      const newVolume = value[0];
      video.volume = newVolume;
      setVolume(newVolume);
      setIsMuted(newVolume === 0);
    }
  };

  const handleSeek = (value: number[]) => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = value[0];
      setCurrentTime(value[0]);
      // Save progress immediately when user seeks
      if (video.duration > 0) {
        onTimeUpdate(value[0], video.duration);
      }
    }
  };

  const handleFullscreen = () => {
    const video = videoRef.current;
    if (video) {
      video.requestFullscreen();
    }
  };

  const handleRestart = () => {
    const video = videoRef.current;
    if (video) {
      video.currentTime = 0;
      setCurrentTime(0);
    }
  };

  const formatTime = (time: number) => {
    const minutes = Math.floor(time / 60);
    const seconds = Math.floor(time % 60);
    return `${minutes}:${seconds.toString().padStart(2, "0")}`;
  };

  const handleDownload = async () => {
    await downloadVideo(video.id, video.url, video.title);
    const available = await isVideoOffline(video.id);
    setIsOfflineAvailable(available);
  };

  const handleDeleteOffline = async () => {
    await deleteVideo(video.id, video.url);
    setIsOfflineAvailable(false);
  };

  const progressPercentage = duration > 0 ? (currentTime / duration) * 100 : 0;
  const isCompleted = isPersistentlyCompleted || progressPercentage >= 99.5;

  return (
    <Card className="overflow-hidden shadow-card">
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex flex-col sm:flex-row sm:items-center gap-2">
            <CardTitle className="text-lg sm:text-xl">{video.title}</CardTitle>
            <div className="flex items-center gap-2">
              {!isOnline && (
                <Badge variant="secondary" className="gap-1 w-fit">
                  <WifiOff className="h-3 w-3" />
                  Offline
                </Badge>
              )}
              {isOfflineAvailable && (
                <Badge variant="outline" className="border-green-500 text-green-600 w-fit">
                  Downloaded
                </Badge>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {role === "teacher" && (
              <Badge variant="outline" className="border-secondary text-secondary">
                Teacher View
              </Badge>
            )}
            
            {/* Download/Delete Button */}
            {user && (
              <>
                {downloadProgress.status === 'downloading' ? (
                  <Button variant="outline" size="sm" disabled className="text-xs sm:text-sm">
                    <Loader2 className="h-3 w-3 sm:h-4 sm:w-4 animate-spin mr-1 sm:mr-2" />
                    <span className="hidden sm:inline">{downloadProgress.progress.toFixed(0)}%</span>
                    <span className="sm:hidden">{downloadProgress.progress.toFixed(0)}%</span>
                  </Button>
                ) : isOfflineAvailable ? (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleDeleteOffline}
                    className="gap-1 sm:gap-2 text-xs sm:text-sm"
                  >
                    <Trash2 className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Remove</span>
                  </Button>
                ) : (
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={handleDownload}
                    disabled={!isOnline}
                    className="gap-1 sm:gap-2 text-xs sm:text-sm"
                  >
                    <Download className="h-3 w-3 sm:h-4 sm:w-4" />
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
        <p className="text-sm text-muted-foreground">{video.description}</p>
      </CardHeader>
      <CardContent className="p-0">
        <div className="relative bg-black aspect-video">
          <video
            ref={videoRef}
            src={getVideoSrc(video)}
            className="h-full w-full"
            onTimeUpdate={handleTimeUpdate}
            onLoadedMetadata={handleLoadedMetadata}
            onPlay={() => setIsPlaying(true)}
            onPause={() => setIsPlaying(false)}
            onEnded={() => {
              setIsPlaying(false);
              // Ensure we save progress at 100% when video ends
              const video = videoRef.current;
              if (video && video.duration > 0) {
                onTimeUpdate(video.duration, video.duration);
                // Show completion if not already shown
                if (!hasShownCompletionRef.current) {
                  hasShownCompletionRef.current = true;
                  toast({
                    title: "Video Completed! 🎉",
                    description: `You've completed "${video.title}". Keep up the great work!`,
                  });
                }
              }
            }}
          />
          
          {/* Fullscreen Button - Top Right Corner */}
          <button
            onClick={handleFullscreen}
            className="absolute top-2 right-2 sm:top-3 sm:right-3 z-10 p-2 sm:p-2.5 rounded-lg bg-black/60 hover:bg-black/80 backdrop-blur-sm transition-all"
            title="Fullscreen"
          >
            <Maximize className="h-4 w-4 sm:h-5 sm:w-5 text-white" />
          </button>
          
          {/* Play/Pause Overlay */}
          <button
            onClick={togglePlay}
            className="absolute inset-0 flex items-center justify-center bg-black/20 opacity-0 hover:opacity-100 transition-opacity"
          >
            <div className="h-16 w-16 rounded-full bg-white/90 flex items-center justify-center shadow-xl">
              {isPlaying ? (
                <Pause className="h-7 w-7 text-primary" fill="currentColor" />
              ) : (
                <Play className="h-7 w-7 text-primary ml-1" fill="currentColor" />
              )}
            </div>
          </button>
        </div>
        
        {/* Controls */}
        <div className="p-3 sm:p-4 bg-card border-t">
          {/* Progress Bar */}
          <div className="mb-3 sm:mb-4">
            <Slider
              value={[currentTime]}
              max={duration || 100}
              step={0.1}
              onValueChange={handleSeek}
              className="cursor-pointer"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
            <div className="flex items-center gap-1 sm:gap-2 w-full sm:w-auto">
              <Button variant="ghost" size="icon" onClick={togglePlay} className="h-8 w-8 sm:h-9 sm:w-9">
                {isPlaying ? (
                  <Pause className="h-4 w-4 sm:h-5 sm:w-5" />
                ) : (
                  <Play className="h-4 w-4 sm:h-5 sm:w-5" />
                )}
              </Button>
              
              <Button variant="ghost" size="icon" onClick={handleRestart} className="h-8 w-8 sm:h-9 sm:w-9">
                <RotateCcw className="h-3 w-3 sm:h-4 sm:w-4" />
              </Button>
              
              <div className="flex items-center gap-1 sm:gap-2 flex-1 sm:w-32">
                <Button variant="ghost" size="icon" onClick={toggleMute} className="h-8 w-8 sm:h-9 sm:w-9">
                  {isMuted || volume === 0 ? (
                    <VolumeX className="h-4 w-4 sm:h-5 sm:w-5" />
                  ) : (
                    <Volume2 className="h-4 w-4 sm:h-5 sm:w-5" />
                  )}
                </Button>
                <Slider
                  value={[isMuted ? 0 : volume]}
                  max={1}
                  step={0.1}
                  onValueChange={handleVolumeChange}
                  className="w-12 sm:w-20"
                />
              </div>
              
              <span className="text-xs sm:text-sm text-muted-foreground ml-1 sm:ml-2">
                {formatTime(currentTime)} / {formatTime(duration)}
              </span>
            </div>
            
            <div className="flex items-center gap-2 sm:gap-4 w-full sm:w-auto justify-end">
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-medium">{progressPercentage.toFixed(0)}%</span>
                <Progress value={progressPercentage} className="w-16 sm:w-24 h-2" />
                {isCompleted && (
                  <Badge variant="secondary" className="text-xs">
                    Completed
                  </Badge>
                )}
                {isCompleted && hasNextVideo && onPlayNext && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={onPlayNext}
                    className="text-xs sm:text-sm"
                  >
                    Play Next
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// VideoStats Component
interface VideoStatsProps {
  subjects: Subject[];
  progress: Record<string, { percentage: number; completed: boolean }>;
}

export const VideoStats = memo(function VideoStats({ subjects, progress }: VideoStatsProps) {
  const totalVideos = subjects.reduce((acc, s) => acc + s.videos.length, 0);
  const totalChapters = new Set(
    subjects.flatMap(s => s.videos.map(v => v.chapter).filter(Boolean))
  ).size;
  
  const watchedVideos = Object.values(progress).filter(p => p.percentage > 0).length;
  const completedVideos = Object.values(progress).filter(p => p.completed).length;
  
  const totalDuration = subjects.reduce((acc, s) => {
    return acc + s.videos.reduce((vAcc, v) => {
      const [min, sec] = v.duration.split(':').map(Number);
      return vAcc + min * 60 + sec;
    }, 0);
  }, 0);
  
  const hours = Math.floor(totalDuration / 3600);
  const minutes = Math.floor((totalDuration % 3600) / 60);

  const stats = [
    {
      title: "Total Videos",
      value: totalVideos,
      icon: VideoIcon,
      color: "text-blue-500",
      bgColor: "bg-blue-500/10"
    },
    {
      title: "Chapters",
      value: totalChapters,
      icon: BookOpen,
      color: "text-purple-500",
      bgColor: "bg-purple-500/10"
    },
    {
      title: "Total Duration",
      value: `${hours}h ${minutes}m`,
      icon: Clock,
      color: "text-orange-500",
      bgColor: "bg-orange-500/10"
    },
    {
      title: "Completed Videos",
      value: completedVideos,
      icon: CheckCircle2,
      color: "text-green-500",
      bgColor: "bg-green-500/10"
    }
  ];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
      {stats.map((stat) => (
        <Card key={stat.title} className="relative overflow-hidden">
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <div className={`p-1.5 sm:p-2 rounded-lg ${stat.bgColor}`}>
                <stat.icon className={`h-4 w-4 sm:h-5 sm:w-5 ${stat.color}`} />
              </div>
              {stat.title === "Completed Videos" && watchedVideos > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {Math.round((completedVideos / totalVideos) * 100)}%
                </Badge>
              )}
            </div>
            <div className="space-y-1">
              <p className="text-xl sm:text-2xl font-bold">{stat.value}</p>
              <p className="text-xs sm:text-sm text-muted-foreground">{stat.title}</p>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}, (prevProps, nextProps) => {
  // Custom comparison: only re-render if completed count changes
  const prevCompleted = Object.values(prevProps.progress).filter(p => p.completed).length;
  const nextCompleted = Object.values(nextProps.progress).filter(p => p.completed).length;
  
  return prevProps.subjects === nextProps.subjects && prevCompleted === nextCompleted;
});
