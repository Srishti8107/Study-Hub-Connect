import { useState, useMemo, useEffect, useCallback } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useVideoProgress } from "@/hooks/useVideoProgress";
import { Header } from "@/components/lms/Header";
import { CategoryGrid } from "@/components/lms/CategoryGrid";
import { VideoStats } from "@/components/lms/VideoComponents";
import { subjects, Subject, Video } from "@/data/subjects";
import { Loader2, BookOpen, Microscope, Code, TrendingUp, Award, Users, ArrowRight, Lightbulb } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import logo from '@/components/assets/logo.png';

import { doc, getDoc } from "firebase/firestore";
import { db } from "@/config/firebase";


export default function Index() {
  const { user, role, loading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [clickCount, setClickCount] = useState(0);
  const { progress } = useVideoProgress();
  const displayName = useMemo(() => {
    if (user?.full_name?.trim()) return user.full_name.trim();
    return "there";
  }, [user]); 

  const [schoolCode, setSchoolCode] = useState<string | null>(null);

  useEffect(() => {
    const fetchSchoolProfile = async () => {
      // Only look up if the logged-in user is a school account
      if (user && role === "school") {
        try {
          const docRef = doc(db, "users", user.id);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            setSchoolCode(docSnap.data().schoolCode || null);
          }
        } catch (error) {
          console.error("Error loading school code on dashboard:", error);
        }
      }
    };

    fetchSchoolProfile();
  }, [user, role]);

  // Handle navigation from My Downloads page
  useEffect(() => {
    if (location.state?.videoId) {  
      // Find the subject by video ID and navigate to topic view
      for (const subject of subjects) {
        const video = subject.videos.find(v => v.id === location.state.videoId);
        if (video && subject.section && subject.topic) {
          navigate(`/category/${subject.section.toLowerCase()}/topic/${subject.topic.toLowerCase()}`);
          break;
        }
      }
    }
  }, [location.state, navigate]);

  // Prepare categories
  const categories = useMemo(() => {
    const categoryMap = new Map<string, { videoCount: number; subjectCount: number }>();
    
    subjects.forEach(subject => {
      if (subject.section) {
        const current = categoryMap.get(subject.section) || { videoCount: 0, subjectCount: 0 };
        categoryMap.set(subject.section, {
          videoCount: current.videoCount + subject.videos.length,
          subjectCount: current.subjectCount + 1
        });
      }
    });
    
    return [
      {
        id: "Prastuti",
        name: "Prastuti",
        description: "Comprehensive mathematics and science curriculum for classes 8-10",
        color: "from-blue-500 to-indigo-600",
        icon: <Microscope className="h-8 w-8 text-white" />,
        videoCount: categoryMap.get("Prastuti")?.videoCount || 0,
        subjectCount: categoryMap.get("Prastuti")?.subjectCount || 0
      },
      {
        id: "anubhav",
        name: "Anubhav",
        description: "Hands-on experiential learning activities through practical exploration",
        color: "from-orange-500 to-red-600",
        icon: <BookOpen className="h-8 w-8 text-white" />,
        videoCount: categoryMap.get("Anubhav")?.videoCount || 0,
        subjectCount: categoryMap.get("Anubhav")?.subjectCount || 0
      },
      {
        id: "geomagic",
        name: "Geomagic",
        description: "Geometric concepts and visual mathematics through interactive activities",
        color: "from-cyan-500 to-blue-600",
        icon: <Code className="h-8 w-8 text-white" />,
        videoCount: categoryMap.get("Geomagic")?.videoCount || 0,
        subjectCount: categoryMap.get("Geomagic")?.subjectCount || 0
      }
    ];
  }, []);

  const handleCategorySelect = useCallback((categoryId: string) => {
    navigate(`/category/${categoryId}`);
  }, [navigate]);

  const handleFooterClick = () => {
    const newCount = clickCount + 1;
    setClickCount(newCount);
    
    if (newCount === 10) {
      navigate("/admin/login");
      setClickCount(0); // Reset counter after navigation
    }
  };

  const stats = useMemo(() => {
    const totalVideos = subjects.reduce((acc, s) => acc + s.videos.length, 0);
    const totalSubjects = subjects.length;
    return [
      { label: "Categories", value: 3, icon: BookOpen, color: "text-primary" },
      { label: "Topics", value: totalSubjects, icon: TrendingUp, color: "text-secondary" },
      { label: "Videos", value: totalVideos, icon: Award, color: "text-success" },
      { label: "Students", value: "2.5K+", icon: Users, color: "text-info" },
    ];
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!user) {
    // Home Page - Shown when not logged in
    const features = [
      {
        icon: BookOpen,
        title: "Diverse Subjects",
        description: "Access a wide range of subjects and courses tailored to your learning needs",
        color: "bg-blue-500/10 text-blue-500"
      },
      {
        icon: TrendingUp,
        title: "Video Lessons",
        description: "Learn through engaging video content from expert instructors",
        color: "bg-purple-500/10 text-purple-500"
      },
      {
        icon: Users,
        title: "Interactive Learning",
        description: "Join thousands of students in their learning journey",
        color: "bg-green-500/10 text-green-500"
      },
      {
        icon: Lightbulb,
        title: "Concept Clarity",
        description: "Simplified explanations and experiments help students understand difficult concepts easily",
        color: "bg-amber-500/10 text-amber-500"
      }
    ];

    return (
      <div className="min-h-screen bg-background">
        {/* Navigation */}
        <nav className="border-b sticky top-0 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 z-50">
          <div className="container flex h-14 sm:h-16 items-center justify-between px-4">
            <div className="flex items-center gap-2">
              <img src={logo} className="h-6 w-6 sm:h-8 sm:w-8 text-primary"/>
              {/* <GraduationCap className="h-6 w-6 sm:h-8 sm:w-8 text-primary" /> */}
              <span className="text-lg sm:text-2xl font-bold">Experimind Labs</span>
            </div>
            <Button onClick={() => navigate("/signup")} variant="default" size="sm" className="sm:text-base">
              <span className="hidden sm:inline">Get Started</span>
              <span className="sm:hidden">Start</span>
              <ArrowRight className="ml-1 sm:ml-2 h-3 w-3 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </nav>

        {/* Hero Section */}
        <section className="container px-4 py-12 sm:py-16 md:py-24 lg:py-32">
          <div className="mx-auto max-w-4xl text-center space-y-6 sm:space-y-8">
            <div className="inline-flex items-center rounded-full px-3 py-1.5 sm:px-4 sm:py-2 bg-primary/10 text-primary text-xs sm:text-sm font-medium mb-2 sm:mb-4">
              ✨ Welcome to the Future of Learning
            </div>
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight px-4">
              Learn Anything,
              <br />
              <span className="bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                Anywhere, Anytime
              </span>
            </h1>
            <p className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto px-4">
              Master new skills with our comprehensive learning management system. 
              Access quality education from the comfort of your home.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 justify-center pt-2 sm:pt-4 px-4">
              <Button 
                size="lg" 
                onClick={() => navigate("/signup")}
                className="text-base sm:text-lg px-6 sm:px-8 w-full sm:w-auto"
              >
                Start Learning Now
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
              <Button 
                size="lg" 
                variant="outline"
                onClick={() => navigate("/signin")}
                className="text-base sm:text-lg px-6 sm:px-8 w-full sm:w-auto"
              >
                Sign In
              </Button>
            </div>
          </div>
        </section>

        {/* Features Grid */}
        <section className="container px-4 py-12 sm:py-16 md:py-20 bg-muted/50">
          <div className="text-center mb-8 sm:mb-10 md:mb-12 px-4">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4">
              Why Choose StudyHub?
            </h2>
            <p className="text-base sm:text-lg text-muted-foreground max-w-2xl mx-auto">
              We provide everything you need for a successful learning experience
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {features.map((feature) => (
              <Card key={feature.title} className="border-2 hover:border-primary/50 transition-all hover:shadow-lg">
                <CardContent className="p-6 space-y-4">
                  <div className={`w-12 h-12 rounded-xl ${feature.color} flex items-center justify-center`}>
                    <feature.icon className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-2">{feature.title}</h3>
                    <p className="text-muted-foreground text-sm">{feature.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Stats Section */}
        <section className="container px-4 py-12 sm:py-16 md:py-20">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8 text-center">
            <div>
              <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-1 sm:mb-2">10+</div>
              <div className="text-sm sm:text-base text-muted-foreground">Subjects</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-1 sm:mb-2">200+</div>
              <div className="text-sm sm:text-base text-muted-foreground">Video Lessons</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-1 sm:mb-2">2.5K+</div>
              <div className="text-sm sm:text-base text-muted-foreground">Active Students</div>
            </div>
            <div>
              <div className="text-3xl sm:text-4xl md:text-5xl font-bold text-primary mb-1 sm:mb-2">98%</div>
              <div className="text-sm sm:text-base text-muted-foreground">Satisfaction Rate</div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="container px-4 py-12 sm:py-16 md:py-20">
          <Card className="bg-gradient-to-r from-primary to-purple-600 text-white border-0">
            <CardContent className="p-6 sm:p-8 md:p-12 text-center space-y-4 sm:space-y-6">
              <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold px-4">
                Ready to Start Your Learning Journey?
              </h2>
              <p className="text-base sm:text-lg text-white/90 max-w-2xl mx-auto px-4">
                Join thousands of students already learning on StudyHub. 
                Sign up today and get access to all courses.
              </p>
              <Button 
                size="lg" 
                variant="secondary"
                onClick={() => navigate("/signup")}
                className="text-base sm:text-lg px-6 sm:px-8 w-full sm:w-auto"
              >
                Get Started for Free
                <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
              </Button>
            </CardContent>
          </Card>
        </section>

        {/* Footer */}
        <footer className="border-t mt-12 sm:mt-16 md:mt-20">
          <div className="container px-4 py-6 sm:py-8 text-center text-muted-foreground">
            <p className="text-sm sm:text-base">© 2026 <span 
              onClick={handleFooterClick} 
              className="cursor-pointer select-none hover:text-primary transition-colors"
            >
              StudyHub
            </span>. All rights reserved.</p>
          </div>
        </footer>
      </div>
    );
  }












  

  // LMS Dashboard - Shown when logged in
  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container py-4 sm:py-6 md:py-8 px-4 space-y-6 sm:space-y-8">
        {/* Hero Section */}
        <section className="relative overflow-hidden rounded-xl sm:rounded-2xl gradient-bg-hero p-6 sm:p-8 md:p-12 text-white">
          <div className="absolute inset-0 bg-black/20" />
          <div className="relative z-10 max-w-5xl">
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-2 sm:mb-5">
              Welcome back, {displayName}! 👋
            </h1>
            <p className="text-base sm:text-lg text-white/90 mb-4 sm:mb-6">
              {role === "teacher" 
                ? "Manage your courses and track student progress"
                : "Choose a category to start your learning journey"}
            </p>
            <div>
                {role === "school" && schoolCode && (
                  <div className="flex items-center gap-2 bg-white dark:bg-slate-900 px-3 py-1.5 rounded-lg border border-purple-200 dark:border-purple-800 shadow-sm w-fit shrink-0">
                    <span className="text-xs font-bold text-muted-foreground uppercase tracking-wider">School Code:</span>
                    <span className="font-mono font-bold text-sm text-purple-700 dark:text-purple-400 select-all tracking-wider">
                      {schoolCode}
                    </span>
                  </div>
                )}
            </div>
          </div>

          <div className="absolute -right-20 -bottom-20 w-64 h-64 rounded-full bg-white/10 blur-3xl" />
        </section>

        {/* Stats */}
        <VideoStats subjects={subjects} progress={progress} />

        {/* Categories */}
        <section>
          <div className="mb-4 sm:mb-6">
            <h2 className="text-xl sm:text-2xl font-bold mb-2">Learning Categories</h2>
            <p className="text-sm sm:text-base text-muted-foreground">Select a category to explore topics and activities</p>
          </div>
          
          <CategoryGrid
            categories={categories}
            onSelectCategory={handleCategorySelect}
          />
        </section>

        {/* Passcode Management — visible to teachers and admins only */}

      </main>
    </div>
  );
}
function setSchoolCode(arg0: any) {
  throw new Error("Function not implemented.");
}

