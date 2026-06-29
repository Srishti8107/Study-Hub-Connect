import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Header } from "@/components/lms/Header";
import { TopicCard } from "@/components/lms/TopicCard";
import { PasscodeModal } from "@/components/lms/PasscodeModal";
import { VideoPlayer, VideoList } from "@/components/lms/VideoComponents";
import { subjects, Subject, Video } from "@/data/subjects";
import { getAllClassPasscodes, getClassPasscode } from "@/services/api";
import { ArrowLeft, Calculator, Microscope, BookOpen, Code, PlayCircle, ChevronRight, CheckCircle2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useVideoProgress } from "@/hooks/useVideoProgress";
import { doc, getDoc } from "firebase/firestore"; 
import { db } from "@/config/firebase";

export default function CategoryView() {
  const { category } = useParams<{ category: string }>();
  const navigate = useNavigate();
  const { user, role, loading } = useAuth();

  // Inline state for single-subject topics
  const [selectedTopicSubject, setSelectedTopicSubject] = useState<Subject | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [selectedVideo, setSelectedVideo] = useState<Video | null>(null);
  const [shouldAutoPlayNext, setShouldAutoPlayNext] = useState(false);
  const [passcodeModal, setPasscodeModal] = useState<{ open: boolean; subject: Subject | null; className: string }>({ open: false, subject: null, className: "" });
  const [classPasscodes, setClassPasscodes] = useState<Record<string, string>>({});
  const [passcodesLoaded, setPasscodesLoaded] = useState(false);
// School verification tracking
  const [schoolProfile, setSchoolProfile] = useState<{ schoolCode?: string; allowedCategories?: Record<string, boolean> } | null>(null);
  const [verifyingSchool, setVerifyingSchool] = useState(role === "school");

  const videoSectionRef = useRef<HTMLDivElement>(null);
  const chapterSectionRef = useRef<HTMLDivElement>(null);
  const selectedVideoRef = useRef<Video | null>(null);
  const { saveProgress, getProgress, getStartTime } = useVideoProgress();

  useEffect(() => { selectedVideoRef.current = selectedVideo; }, [selectedVideo]);

  useEffect(() => {
    if (loading || role === "teacher" || role === "school") return;
    getAllClassPasscodes().then((data) => { setClassPasscodes(data); setPasscodesLoaded(true); });
  }, [loading, role]);

  const categoryName = category?.charAt(0).toUpperCase() + category?.slice(1) || "";

  // Dynamic remote school tracking loop
  useEffect(() => {
    if (!loading && user && role === "school") {
      setVerifyingSchool(true);
      getDoc(doc(db, "users", user.id))
        .then((snap) => {
          if (snap.exists()) {
            setSchoolProfile(snap.data());
          }
        })
        .finally(() => setVerifyingSchool(false));
    } else {
      setVerifyingSchool(false);
    }
  }, [user, role, loading]);

  const hasAccess = useMemo(() => {
    if (role !== "school") return true;
    if (verifyingSchool) return true;
    return schoolProfile?.allowedCategories?.[categoryName] === true;
  }, [role, verifyingSchool, schoolProfile, categoryName]);

  // Get unique topics for this category
  const topics = useMemo(() => {
    const topicMap = new Map<string, { videoCount: number; classCount: number }>();
    
    subjects
      .filter(subject => subject.section === categoryName)
      .forEach(subject => {
        if (subject.topic) {
          const current = topicMap.get(subject.topic) || { videoCount: 0, classCount: 0 };
          topicMap.set(subject.topic, {
            videoCount: current.videoCount + subject.videos.length,
            classCount: subject.class ? current.classCount + 1 : current.classCount
          });
        }
      });

    const topicIcons: Record<string, { icon: React.ReactNode; color: string; description: string }> = {
      Maths: {
        icon: <Calculator className="h-7 w-7 text-white" />,
        color: "from-purple-500 to-pink-600",
        description: "Mathematical concepts and problem-solving activities"
      },
      Science: {
        icon: <Microscope className="h-7 w-7 text-white" />,
        color: "from-blue-500 to-indigo-600",
        description: "Scientific experiments and interactive activities"
      },
      "Class 8": {
        icon: <BookOpen className="h-7 w-7 text-white" />,
        color: "from-orange-500 to-red-600",
        description: "Hands-on learning activities for Class 8 students"
      },
      "Class 9": {
        icon: <BookOpen className="h-7 w-7 text-white" />,
        color: "from-pink-500 to-rose-600",
        description: "Hands-on learning activities for Class 9 students"
      },
      "Class 10": {
        icon: <BookOpen className="h-7 w-7 text-white" />,
        color: "from-violet-500 to-purple-600",
        description: "Hands-on learning activities for Class 10 students"
      },
      Line: {
        icon: <Code className="h-7 w-7 text-white" />,
        color: "from-cyan-500 to-blue-600",
        description: "Geometric concepts exploring lines and patterns"
      },
      Circle: {
        icon: <Code className="h-7 w-7 text-white" />,
        color: "from-teal-500 to-green-600",
        description: "Geometric concepts exploring circles and curves"
      }
    };

    return Array.from(topicMap.entries()).map(([topicName, counts]) => ({
      name: topicName,
      videoCount: counts.videoCount,
      classCount: counts.classCount,
      icon: topicIcons[topicName]?.icon || <BookOpen className="h-7 w-7 text-white" />,
      color: topicIcons[topicName]?.color || "from-gray-500 to-gray-600",
      description: topicIcons[topicName]?.description || `${topicName} activities and content`
    }));
  }, [categoryName]);

  // Chapter groups and videos for inline-selected subject
  const chapterGroups = useMemo(() => {
    if (!selectedTopicSubject) return [];
    const map = new Map<string, number>();
    selectedTopicSubject.videos.forEach(v => {
      if (v.chapterName) map.set(v.chapterName, (map.get(v.chapterName) || 0) + 1);
    });
    return Array.from(map.entries()).map(([name, count]) => ({ name, count }));
  }, [selectedTopicSubject]);

  const chapterVideos = useMemo(() => {
    if (!selectedTopicSubject) return [];
    if (chapterGroups.length === 0) return selectedTopicSubject.videos;
    if (!selectedChapter) return [];
    return selectedTopicSubject.videos.filter(v => v.chapterName === selectedChapter);
  }, [selectedTopicSubject, selectedChapter, chapterGroups]);

  const currentVideoIndex = useMemo(() => {
    if (!selectedVideo) return -1;
    return chapterVideos.findIndex(v => v.id === selectedVideo.id);
  }, [chapterVideos, selectedVideo]);

  const hasNextVideo = currentVideoIndex >= 0 && currentVideoIndex < chapterVideos.length - 1;

  const proceedWithSubject = useCallback((subject: Subject) => {
    setSelectedTopicSubject(subject);
    setSelectedChapter(null);
    setSelectedVideo(null);
    setShouldAutoPlayNext(false);
    const hasChapters = subject.videos.some(v => v.chapterName);
    setTimeout(() => {
      if (hasChapters) {
        chapterSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      } else {
        videoSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    }, 100);
  }, []);

  const handleTopicClick = useCallback(async (topicName: string) => {
    const topicSubjects = subjects.filter(s => s.section === categoryName && s.topic === topicName);
    // If more than one subject (e.g. Prastuti Science has Class 8/9/10), navigate to TopicView
    if (topicSubjects.length !== 1) {
      navigate(`/category/${category}/topic/${topicName.toLowerCase()}`);
      return;
    }
    const subject = topicSubjects[0];
    // Passcode check for students
    if (role !== "teacher" && role !== "admin") {
      const className = subject.class || "";
      if (className) {
        const storedPasscode = passcodesLoaded
          ? (classPasscodes[className] || null)
          : await getClassPasscode(className);
        if (storedPasscode) {
          setPasscodeModal({ open: true, subject, className });
          return;
        }
      }
    }
    proceedWithSubject(subject);
  }, [categoryName, category, navigate, role, classPasscodes, passcodesLoaded, proceedWithSubject]);

  const handleVerifyPasscode = useCallback(async (entered: string): Promise<boolean> => {
    const stored = await getClassPasscode(passcodeModal.className);
    return stored === entered;
  }, [passcodeModal.className]);

  const handlePasscodeSuccess = useCallback(() => {
    const subject = passcodeModal.subject;
    setPasscodeModal({ open: false, subject: null, className: "" });
    if (subject) proceedWithSubject(subject);
  }, [passcodeModal, proceedWithSubject]);

  const handlePasscodeCancel = useCallback(() => {
    setPasscodeModal({ open: false, subject: null, className: "" });
  }, []);

  const handleSelectChapter = useCallback((chapterName: string) => {
    setSelectedChapter(chapterName);
    setShouldAutoPlayNext(false);
    if (selectedTopicSubject) {
      const first = selectedTopicSubject.videos.find(v => v.chapterName === chapterName) || null;
      setSelectedVideo(first);
    }
    setTimeout(() => { videoSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }); }, 100);
  }, [selectedTopicSubject]);

  const handleSelectVideo = useCallback((video: Video) => {
    setSelectedVideo(video);
    setShouldAutoPlayNext(false);
  }, []);

  const handleVideoTimeUpdate = useCallback((currentTime: number, duration: number) => {
    if (selectedVideoRef.current) saveProgress(selectedVideoRef.current.id, currentTime, duration);
  }, [saveProgress]);

  const handlePlayNextVideo = useCallback(() => {
    if (currentVideoIndex < 0) return;
    const next = chapterVideos[currentVideoIndex + 1];
    if (next) { setShouldAutoPlayNext(true); setSelectedVideo(next); }
  }, [chapterVideos, currentVideoIndex]);

  const handleAutoPlayHandled = useCallback(() => { setShouldAutoPlayNext(false); }, []);

  if (loading) return null;
  if (!user) { navigate("/"); return null; }

  // Gated UI layout protection for restricted modules
  if (!hasAccess) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container max-w-md mx-auto py-16 px-4 text-center space-y-4">
          <div className="w-16 h-16 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
          <p className="text-sm text-muted-foreground">
            Your school account does not currently hold access permissions for the <strong>{categoryName}</strong> module. Please contact platform administrators.
          </p>
          <Button variant="outline" size="sm" onClick={() => navigate("/")} className="mt-2">
            Return to Dashboard
          </Button>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />

      <PasscodeModal
        isOpen={passcodeModal.open}
        className={passcodeModal.className}
        onVerify={handleVerifyPasscode}
        onSuccess={handlePasscodeSuccess}
        onCancel={handlePasscodeCancel}
      />

      <main className="container py-4 sm:py-6 md:py-8 px-4 space-y-6 sm:space-y-8">
        {/* UNIQUE SCHOOL CODE RENDER GATED FOR THE SCHOOL DASHBOARD LOGGED IN VIEW */}
        {role === "school" && schoolProfile?.schoolCode && (
          <div className="bg-gradient-to-r from-purple-50 to-indigo-50 border border-purple-200 text-purple-700 px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold w-fit shadow-sm flex items-center gap-2">
            <span>🏫</span> School Code: <span className="bg-purple-200 px-2 py-0.5 rounded tracking-wide font-mono text-purple-900">{schoolProfile.schoolCode}</span>
          </div>
        )}
        {/* Header with Back Button */}
        <div className="flex flex-col gap-3">
          <Button
            variant="outline"
            size="sm"
            onClick={selectedTopicSubject ? () => { setSelectedTopicSubject(null); setSelectedChapter(null); setSelectedVideo(null); } : () => navigate("/")}
            className="gap-2 w-fit"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="hidden sm:inline">{selectedTopicSubject ? `Back to ${categoryName}` : "Back to Categories"}</span>
            <span className="sm:hidden">Back</span>
          </Button>
          <div className="flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold">{categoryName}</h1>
            <p className="text-sm sm:text-base text-muted-foreground">
              {topics.length} topics available
            </p>
          </div>
        </div>

        {/* Topics */}
        <section>
          <div className="mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Browse Topics</h2>
            <p className="text-sm sm:text-base text-muted-foreground">Choose a topic to explore activities and classes</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {topics.map((topic) => (
              <TopicCard
                key={topic.name}
                name={topic.name}
                description={topic.description}
                color={topic.color}
                icon={topic.icon}
                videoCount={topic.videoCount}
                classCount={topic.classCount}
                onClick={() => handleTopicClick(topic.name)}
              />
            ))}
          </div>
        </section>

        {/* Inline Chapter Topics — shown when a single-subject topic is selected */}
        {selectedTopicSubject && chapterGroups.length > 0 && (
          <section className="animate-fade-in" ref={chapterSectionRef}>
            <div className="flex items-center gap-3 mb-4 sm:mb-5">
              <div className="h-8 w-1 rounded-full bg-primary" />
              <div>
                <h2 className="text-lg sm:text-xl font-bold leading-tight">{selectedTopicSubject.name} — Topics</h2>
                <p className="text-xs text-muted-foreground mt-0.5">{chapterGroups.length} topics · tap to watch</p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              {chapterGroups.map((ch, idx) => {
                const isActive = selectedChapter === ch.name;
                return (
                  <button
                    key={ch.name}
                    onClick={() => handleSelectChapter(ch.name)}
                    className={`group w-full text-left flex items-center gap-4 px-4 py-3 rounded-xl border transition-all duration-200 ${isActive
                      ? "bg-primary text-primary-foreground border-primary shadow-md"
                      : "bg-card border-border hover:border-primary/50 hover:bg-accent/50 hover:shadow-sm"
                    }`}
                  >
                    <span className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${isActive
                      ? "bg-white/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary"
                    }`}>
                      {isActive ? <CheckCircle2 className="h-4 w-4" /> : idx + 1}
                    </span>
                    <span className={`flex-1 font-medium text-sm sm:text-base truncate ${isActive ? "text-primary-foreground" : "text-foreground"}`}>
                      {ch.name}
                    </span>
                    <span className={`flex-shrink-0 flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${isActive
                      ? "bg-white/20 text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                    }`}>
                      <PlayCircle className="h-3 w-3" />
                      {ch.count}
                    </span>
                    <ChevronRight className={`flex-shrink-0 h-4 w-4 transition-transform duration-200 ${isActive
                      ? "text-primary-foreground"
                      : "text-muted-foreground group-hover:text-primary group-hover:translate-x-0.5"
                    }`} />
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Inline Video Section */}
        {selectedTopicSubject && (chapterGroups.length === 0 || selectedChapter) && (
          <section className="animate-fade-in" ref={videoSectionRef}>
            {selectedVideo ? (
              <>
                <div className="flex items-center justify-between mb-4 sm:mb-6">
                  <div>
                    <h2 className="text-xl sm:text-2xl font-bold">Now Watching</h2>
                    <p className="text-sm sm:text-base text-muted-foreground">
                      {selectedChapter || selectedTopicSubject.name}
                    </p>
                  </div>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
                  <div className="lg:col-span-2">
                    <VideoPlayer
                      video={selectedVideo}
                      startTime={getStartTime(selectedVideo.id)}
                      onTimeUpdate={handleVideoTimeUpdate}
                      wasCompleted={getProgress(selectedVideo.id).completed}
                      onPlayNext={handlePlayNextVideo}
                      hasNextVideo={hasNextVideo}
                      autoPlay={shouldAutoPlayNext}
                      onAutoPlayHandled={handleAutoPlayHandled}
                    />
                  </div>
                  <div className="lg:col-span-1">
                    <VideoList
                      subject={{ ...selectedTopicSubject, videos: chapterVideos }}
                      selectedVideo={selectedVideo}
                      onSelectVideo={handleSelectVideo}
                      getProgress={getProgress}
                    />
                  </div>
                </div>
              </>
            ) : chapterVideos.length > 0 ? (
              <>
                <div className="mb-4 sm:mb-6">
                  <h2 className="text-xl sm:text-2xl font-bold">Select a Video</h2>
                  <p className="text-sm sm:text-base text-muted-foreground">{selectedTopicSubject.name} — {chapterVideos.length} videos</p>
                </div>
                <VideoList
                  subject={{ ...selectedTopicSubject, videos: chapterVideos }}
                  selectedVideo={null}
                  onSelectVideo={handleSelectVideo}
                  getProgress={getProgress}
                />
              </>
            ) : (
              <div className="text-center py-8 sm:py-12 bg-muted/30 rounded-lg">
                <BookOpen className="h-12 w-12 sm:h-16 sm:w-16 mx-auto text-muted-foreground mb-3 sm:mb-4" />
                <h3 className="text-lg sm:text-xl font-semibold mb-2">No Videos Available</h3>
                <p className="text-sm sm:text-base text-muted-foreground">Videos for {selectedTopicSubject.name} will be added soon.</p>
              </div>
            )}
          </section>
        )}
      </main>
    </div>
  );
}
