import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/lms/Header";
import { getUserDashboardData } from "@/services/api";
import { subjects, Video } from "@/data/subjects";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import {
  CheckCircle2,
  Clock,
  BookOpen,
  Play,
  ArrowLeft,
  Trophy,
  TrendingUp,
  Video as VideoIcon,
  Loader2,
} from "lucide-react";

interface DashboardData {
  completedVideoIds: string[];
  progressMap: Record<string, any>;
  completedMap: Record<string, string>;
  totalWatched: number;
  totalCompleted: number;
  userName: string;
  userRole: string;
}

// Build a lookup map: videoId -> Video & subject metadata
function buildVideoLookup() {
  const map: Record<string, { video: Video; subjectName: string; section: string; topic: string; className: string }> = {};
  for (const subject of subjects) {
    for (const video of subject.videos) {
      map[video.id] = {
        video,
        subjectName: subject.name,
        section: subject.section || "",
        topic: subject.topic || "",
        className: subject.class || "",
      };
    }
  }
  return map;
}

export default function UserDashboard() {
  const { user, role, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  const videoLookup = useMemo(() => buildVideoLookup(), []);
  const totalVideos = useMemo(() => subjects.reduce((acc, s) => acc + s.videos.length, 0), []);

  useEffect(() => {
    if (authLoading) return;
    if (!user || role == "school") {
      navigate("/");
      return;
    }

    const load = async () => {
      setLoading(true);
      const result = await getUserDashboardData(user.id);
      setData(result);
      setLoading(false);
    };
    load();
  }, [user, role, authLoading, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container py-8 px-4 flex items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </main>
      </div>
    );
  }

  if (!data) return null;

  const overallProgress = totalVideos > 0 ? Math.round((data.totalCompleted / totalVideos) * 100) : 0;

  // Build completed video list with metadata, sorted by completion date
  const completedList = data.completedVideoIds
    .map((id) => {
      const info = videoLookup[id];
      if (!info) return null;
      return {
        ...info,
        completedAt: data.completedMap[id] || "",
        progress: data.progressMap[id],
      };
    })
    .filter(Boolean)
    .sort((a, b) => {
      const dateA = a!.completedAt ? new Date(a!.completedAt).getTime() : 0;
      const dateB = b!.completedAt ? new Date(b!.completedAt).getTime() : 0;
      return dateB - dateA; // newest first
    }) as Array<{
      video: Video;
      subjectName: string;
      section: string;
      topic: string;
      className: string;
      completedAt: string;
      progress: any;
    }>;

  // In-progress videos (started but not completed)
  const inProgressList = Object.entries(data.progressMap)
    .filter(([id, prog]) => (prog.percentage || 0) > 0 && !data.completedVideoIds.includes(id))
    .map(([id, prog]) => {
      const info = videoLookup[id];
      if (!info) return null;
      return { ...info, progress: prog };
    })
    .filter(Boolean)
    .sort((a, b) => (b!.progress.percentage || 0) - (a!.progress.percentage || 0)) as Array<{
      video: Video;
      subjectName: string;
      section: string;
      topic: string;
      className: string;
      progress: any;
    }>;

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main className="container py-4 sm:py-6 md:py-8 px-4 space-y-6 sm:space-y-8">
        {/* Back button */}
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate("/")} className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">Back to Home</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">My Dashboard</h1>
            <p className="text-sm text-muted-foreground">
              Track your learning progress
            </p>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          <Card className="relative overflow-hidden">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 sm:p-2 rounded-lg bg-green-500/10">
                  <CheckCircle2 className="h-4 w-4 sm:h-5 sm:w-5 text-green-500" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xl sm:text-2xl font-bold">{data.totalCompleted}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Completed Videos</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 sm:p-2 rounded-lg bg-blue-500/10">
                  <TrendingUp className="h-4 w-4 sm:h-5 sm:w-5 text-blue-500" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xl sm:text-2xl font-bold">{inProgressList.length}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">In Progress</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 sm:p-2 rounded-lg bg-orange-500/10">
                  <VideoIcon className="h-4 w-4 sm:h-5 sm:w-5 text-orange-500" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xl sm:text-2xl font-bold">{data.totalWatched}</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Videos Watched</p>
              </div>
            </CardContent>
          </Card>

          <Card className="relative overflow-hidden">
            <CardContent className="p-4 sm:p-6">
              <div className="flex items-center justify-between mb-2">
                <div className="p-1.5 sm:p-2 rounded-lg bg-purple-500/10">
                  <Trophy className="h-4 w-4 sm:h-5 sm:w-5 text-purple-500" />
                </div>
              </div>
              <div className="space-y-1">
                <p className="text-xl sm:text-2xl font-bold">{overallProgress}%</p>
                <p className="text-xs sm:text-sm text-muted-foreground">Overall Progress</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Overall Progress Bar */}
        <Card>
          <CardContent className="p-4 sm:p-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium">Overall Course Progress</span>
              <span className="text-sm text-muted-foreground">
                {data.totalCompleted} / {totalVideos} videos
              </span>
            </div>
            <Progress value={overallProgress} className="h-3" />
          </CardContent>
        </Card>

        {/* In-Progress Videos */}
        {inProgressList.length > 0 && (
          <section>
            <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-blue-500" />
              Continue Watching
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {inProgressList.map((item) => (
                <Card
                  key={item.video.id}
                  className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-md hover:ring-1 hover:ring-primary/30"
                  onClick={() => {
                    const section = item.section.toLowerCase();
                    const topic = item.topic.toLowerCase();
                    navigate(`/category/${section}/topic/${topic}`);
                  }}
                >
                  <CardContent className="p-0">
                    <div className="relative aspect-video overflow-hidden">
                      <img
                        src={item.video.thumbnail}
                        alt={item.video.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center">
                        <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                          <Play className="h-6 w-6 text-primary ml-1" fill="currentColor" />
                        </div>
                      </div>
                      <Badge className="absolute top-2 right-2 bg-black/70 text-white border-0">
                        <Clock className="mr-1 h-3 w-3" />
                        {item.video.duration}
                      </Badge>
                      <div className="absolute bottom-0 left-0 right-0">
                        <Progress value={item.progress.percentage || 0} className="h-1.5 rounded-none" />
                      </div>
                    </div>
                    <div className="p-3">
                      <h4 className="font-medium text-sm mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                        {item.video.title}
                      </h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {item.section}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {item.className}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {Math.round(item.progress.percentage || 0)}% done
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Completed Videos */}
        <section>
          <h2 className="text-lg sm:text-xl font-bold mb-3 sm:mb-4 flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5 text-green-500" />
            Completed Videos
            {completedList.length > 0 && (
              <Badge variant="secondary" className="ml-1">{completedList.length}</Badge>
            )}
          </h2>

          {completedList.length === 0 ? (
            <Card>
              <CardContent className="p-8 sm:p-12 text-center">
                <BookOpen className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                <h3 className="text-lg sm:text-xl font-semibold mb-2">No Completed Videos Yet</h3>
                <p className="text-sm sm:text-base text-muted-foreground mb-4">
                  Start watching videos and they'll appear here once you complete them.
                </p>
                <Button onClick={() => navigate("/")} className="gap-2">
                  <Play className="h-4 w-4" />
                  Browse Videos
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
              {completedList.map((item) => (
                <Card
                  key={item.video.id}
                  className="group cursor-pointer overflow-hidden transition-all duration-300 hover:shadow-md hover:ring-1 hover:ring-primary/30"
                  onClick={() => {
                    const section = item.section.toLowerCase();
                    const topic = item.topic.toLowerCase();
                    navigate(`/category/${section}/topic/${topic}`);
                  }}
                >
                  <CardContent className="p-0">
                    <div className="relative aspect-video overflow-hidden">
                      <img
                        src={item.video.thumbnail}
                        alt={item.video.title}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/40 opacity-0 transition-opacity group-hover:opacity-100 flex items-center justify-center">
                        <div className="h-14 w-14 rounded-full bg-white/90 flex items-center justify-center shadow-lg">
                          <Play className="h-6 w-6 text-primary ml-1" fill="currentColor" />
                        </div>
                      </div>
                      <Badge className="absolute top-2 right-2 bg-black/70 text-white border-0">
                        <Clock className="mr-1 h-3 w-3" />
                        {item.video.duration}
                      </Badge>
                      <div className="absolute top-2 left-2">
                        <Badge className="bg-green-600 text-white border-0">
                          <CheckCircle2 className="mr-1 h-3 w-3" />
                          Completed
                        </Badge>
                      </div>
                    </div>
                    <div className="p-3">
                      <h4 className="font-medium text-sm mb-1 line-clamp-1 group-hover:text-primary transition-colors">
                        {item.video.title}
                      </h4>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">
                          {item.section}
                        </Badge>
                        <Badge variant="secondary" className="text-xs">
                          {item.className}
                        </Badge>
                        {item.completedAt && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(item.completedAt).toLocaleDateString()}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
}
