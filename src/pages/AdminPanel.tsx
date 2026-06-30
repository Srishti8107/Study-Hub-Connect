import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import logo from '@/components/assets/logo.png';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  GraduationCap,  
  Shield,
  Users,
  BookOpen,
  LogOut,
  Settings,
  BarChart,
  UserCheck,
  UserPlus,
  CheckCircle,
  XCircle,
  Trash2,
  KeyRound,
} from "lucide-react";
import {
  collection,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  query,
  where,
  getDoc,
  setDoc,
} from "firebase/firestore";
import { db, auth, secondaryAuth } from "@/config/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  updateProfile,
} from "firebase/auth";
import { useToast } from "@/hooks/use-toast";
import { ClassPasscodeManager } from "@/components/lms/ClassPasscodeManager";

interface UserData {
  id: string;
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  schoolCode?: string;
  allowedCategories?: Record<string, boolean>;
}

interface SignupRequest {
  id: string;
  uid: string;   // Firebase Auth UID — set after user verifies email
  email: string;
  full_name: string;
  role: string;
  created_at: string;
  schoolCode?: string;
}

export default function AdminPanel() {
  const { user, role, signOut, loading } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [users, setUsers] = useState<UserData[]>([]);
  const [signupRequests, setSignupRequests] = useState<SignupRequest[]>([]);
  const [activeTab, setActiveTab] = useState("requests");

  const [stats, setStats] = useState({
    totalUsers: 0,
    teachers: 0,
    students: 0,
    schools: 0,
    admins: 0,
    pendingRequests: 0,
  });

  const [loadingUsers, setLoadingUsers] = useState(true);
  const [loadingRequests, setLoadingRequests] = useState(true);
  const [processingRequest, setProcessingRequest] = useState<string | null>(null);
  const [deletingUser, setDeletingUser] = useState<string | null>(null);

  /* ---------------- AUTH GUARD ---------------- */
  useEffect(() => {
    if (!loading && role !== "admin") navigate("/");
  }, [role, loading, navigate]);

  /* ---------------- FETCH USERS + STATS ---------------- */
  const refreshUsersAndStats = async () => {
    try {
      const snap = await getDocs(collection(db, "users"));

      let teachers = 0;
      let students = 0;
      let schools =0;
      let admins = 0;

      const list: UserData[] = snap.docs.map((d) => {
        const data = d.data() as any;
        if (data.role === "teacher") teachers++;
        else if (data.role === "student") students++;
        else if (data.role === "school") schools++;
        else if (data.role === "admin") admins++;

        return {
          id: d.id,
          email: data.email || "",
          full_name: data.full_name || "",
          role: data.role || "",
          created_at: data.created_at || "",
          allowedCategories: data.allowedCategories || {Prastuti: false, Anubhav: false, Geomagic: false},
          schoolCode: data.schoolCode,
        };
      });

      setUsers(list);
      setStats((prev) => ({
        ...prev,
        totalUsers: list.length,
        teachers,
        students,
        schools,
        admins,
      }));
    } catch (error) {
      console.error("Error fetching users:", error);
    } finally {
      setLoadingUsers(false);
    }
  };

  /* ---------------- FETCH REQUESTS ---------------- */
  const refreshRequests = async () => {
    try {
      const snap = await getDocs(collection(db, "signup_requests"));
      const list: SignupRequest[] = snap.docs.map((d) => ({
        id: d.id,
        ...(d.data() as any),
      }));

      setSignupRequests(list);
      setStats((prev) => ({
        ...prev,
        pendingRequests: list.length,
      }));
    } catch (error) {
      console.error("Error fetching requests:", error);
    } finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (role === "admin") {
      refreshUsersAndStats();
      refreshRequests();
    }
  }, [role]);

  /* ---------------- SIGN OUT ---------------- */
  const handleSignOut = async () => {
    await signOut();
    navigate("/admin/login");
  };

  /* ---------------- SCHOOL CHECKBOXES IN ADMIN PANEL -----------------*/

  const handleGenerateSchoolCode = async (userId: string) => {
    const targetUser = users.find(u => u.id === userId);
    if (targetUser?.schoolCode) {
      if (!confirm(`This school already has code ${targetUser.schoolCode}. Generating a new one will overwrite it. Proceed?`)) {
        return;
      }
    }
    const randomCode = "SH-" + Math.random().toString(36).substring(2, 8).toUpperCase();
    try {
      
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === userId ? { ...u, schoolCode: randomCode } : u
        )
      );
      await setDoc(doc(db, "users", userId), { schoolCode: randomCode }, { merge: true });
      toast({
        title: "School Code Generated",
        description: `Assigned code: ${randomCode}`,
      });

    } catch (err: any) {
      setUsers((prevUsers) =>
        prevUsers.map((u) =>
          u.id === userId ? { ...u, schoolCode: undefined } : u
        )
      );
      toast({
        variant: "destructive",
        title: "Error generating code",
        description: err?.message,
      });
    }
  };

  /* ---------------- CATEGORY ACCESS TOGGLE ---------------- */
  const handleCategoryToggle = async (userId: string, category: string, checked: boolean) => {
    try {
      await setDoc(
        doc(db, "users", userId),
        {
          allowedCategories: {
            [category]: checked,
          },
        },
        { merge: true }
      );
      toast({
        title: "Access Updated",
        description: `${category} access successfully ${checked ? "granted" : "revoked"}.`,
      });
      await refreshUsersAndStats();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error updating permissions",
        description: err?.message,
      });
    }
  };

  /* ---------------- APPROVE REQUEST ---------------- */
  const handleApproveRequest = async (request: SignupRequest) => {
    if (!confirm(`Approve signup request for ${request.full_name} (${request.email})?`)) {
      return;
    }

    setProcessingRequest(request.id);

    try {
      // Guard: new flow requires a uid (set after email verification)
      if (!request.uid) {
        toast({
          variant: "destructive",
          title: "Cannot approve this request",
          description: "This request is from the old signup flow and has no associated account. Please reject it and ask the user to sign up again.",
        });
        setProcessingRequest(null);
        return;
      }

      // Check the user is not already in the users collection
      const existingSnap = await getDocs(
        query(collection(db, "users"), where("email", "==", request.email))
      );
      if (!existingSnap.empty) {
        toast({
          variant: "destructive",
          title: "User already exists",
          description: `A user with email ${request.email} already exists in the system.`,
        });
        setProcessingRequest(null);
        return;
      }

      const initialSchoolData = request.role === "school" ? {
        schoolCode: "SH-" + Math.random().toString(36).substring(2, 8).toUpperCase(),
        allowedCategories: { Prastuti: false, Anubhav: false, Geomagic: false }
      } : {};

      // Firebase Auth account already exists (created when user signed up).
      // Just add the user to the users collection to grant them access.
      await setDoc(doc(db, "users", request.uid), {
        email: request.email,
        full_name: request.full_name || "",
        role: request.role,
        created_at: new Date().toISOString(),
        approved_at: new Date().toISOString(),
        ...initialSchoolData
      });

      // Remove the signup request
      await deleteDoc(doc(db, "signup_requests", request.id));

      toast({
        title: "Request approved!",
        description: `${request.full_name} can now sign in with their credentials.`,
      });

      setActiveTab("users");
      await refreshUsersAndStats();
      await refreshRequests();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error approving request",
        description: err?.message || "An unexpected error occurred.",
      });
    } finally {
      setProcessingRequest(null);
    }
  };

  /* ---------------- REJECT REQUEST ---------------- */
  const handleRejectRequest = async (request: SignupRequest) => {
    if (!confirm(`Reject signup request for ${request.full_name} (${request.email})?`)) {
      return;
    }

    setProcessingRequest(request.id);
    try {
      await deleteDoc(doc(db, "signup_requests", request.id));
      
      toast({
        title: "Request rejected",
        description: `${request.full_name}'s signup request has been rejected.`,
      });
      
      await refreshRequests();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err?.message || "An error occurred",
      });
    } finally {
      setProcessingRequest(null);
    }
  };

  /* ---------------- RECREATE AUTH ACCOUNT ---------------- */
  const handleRecreateAuthAccount = async (userData: UserData) => {
    const tempPassword = prompt(
      `Enter a temporary password for ${userData.full_name} (${userData.email}).\n\nThe user will use this password to sign in and should change it afterwards:`
    );
    
    if (!tempPassword) return;
    
    if (tempPassword.length < 6) {
      toast({
        variant: "destructive",
        title: "Password too short",
        description: "Password must be at least 6 characters.",
      });
      return;
    }

    const currentAdminEmail = user?.email;
    setDeletingUser(userData.id); // Reuse loading state
    
    try {
      // Create Firebase Auth account using secondary auth
      const userCredential = await createUserWithEmailAndPassword(
        secondaryAuth,
        userData.email,
        tempPassword
      );

      // Update display name
      if (userData.full_name) {
        await updateProfile(userCredential.user, {
          displayName: userData.full_name
        });
      }

      // Update the user document in Firestore with the new UID if different
      if (userCredential.user.uid !== userData.id) {
        // Delete old document
        await deleteDoc(doc(db, "users", userData.id));
        
        // Create new document with correct UID
        await setDoc(doc(db, "users", userCredential.user.uid), {
          email: userData.email,
          full_name: userData.full_name,
          role: userData.role,
          created_at: userData.created_at,  
          schoolCode: userData.schoolCode || "",
          allowedCategories: userData.allowedCategories || { Prastuti: false, Anubhav: false, Geomagic: false },
          recreated_at: new Date().toISOString(),
        });
      }

      // Sign out from secondary auth
      await firebaseSignOut(secondaryAuth);

      toast({
        title: "Auth account created",
        description: `${userData.full_name} can now sign in with the temporary password.`,
      });

      await refreshUsersAndStats();
    } catch (err: any) {
      console.error("Error recreating auth:", err);
      
      let errorMessage = err?.message || "An error occurred";
      
      if (err.code === 'auth/email-already-in-use') {
        errorMessage = "Firebase Auth account already exists for this email.";
      } else if (err.code === 'auth/invalid-email') {
        errorMessage = "Invalid email address.";
      }
      
      toast({
        variant: "destructive",
        title: "Error creating auth account",
        description: errorMessage,
      });
    } finally {
      setDeletingUser(null);
    }
  };

  /* ---------------- DELETE USER ---------------- */
  const handleDeleteUser = async (userData: UserData) => {
    if (userData.role === "admin") {
      toast({
        variant: "destructive",
        title: "Cannot delete admin",
        description: "Admin users cannot be deleted.",
      });
      return;
    }

    if (!confirm(`Are you sure you want to delete ${userData.full_name} (${userData.email})?\n\nNote: This will remove them from the system and they won't be able to sign in, but their Firebase Authentication account will remain (client SDK limitation).`)) {
      return;
    }

    setDeletingUser(userData.id);
    try {
      // Delete from users collection
      // Note: Cannot delete from Firebase Auth using client SDK
      // User won't be able to sign in because signIn checks users collection
      await deleteDoc(doc(db, "users", userData.id));
      
      toast({
        title: "User deleted from system",
        description: `${userData.full_name} has been removed and cannot sign in anymore.`,
      });
      
      await refreshUsersAndStats();
    } catch (err: any) {
      toast({
        variant: "destructive",
        title: "Error deleting user",
        description: err?.message || "An error occurred",
      });
    } finally {
      setDeletingUser(null);
    }
  };

  if (loading || role !== "admin") return null;

  /* ---------------- UI ---------------- */
  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-3 sm:py-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div className="flex h-8 w-8 sm:h-10 sm:w-10 items-center justify-center rounded-lg bg-gradient-to-br from-destructive to-destructive/80 shrink-0">
                <Shield className="h-4 w-4 sm:h-5 sm:w-5 text-destructive-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <h1 className="text-base sm:text-xl font-bold truncate">Admin Dashboard</h1>
                <p className="text-xs sm:text-sm text-muted-foreground truncate">{user?.email}</p>
              </div>
            </div>
            <Button variant="outline" onClick={handleSignOut} size="sm" className="gap-1 sm:gap-2 shrink-0">
              <LogOut className="h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Sign Out</span>
              <span className="sm:hidden">Out</span>
            </Button>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 sm:py-6 md:py-8">
        {/* Stats Cards */}
        <div className="grid grid-cols-2 gap-3 sm:gap-4 md:grid-cols-3 lg:grid-cols-5 mb-6 sm:mb-8">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
              <CardTitle className="text-xs sm:text-sm font-medium">Pending</CardTitle>
              <UserPlus className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats.pendingRequests}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Awaiting</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
              <CardTitle className="text-xs sm:text-sm font-medium">Users</CardTitle>
              <Users className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats.totalUsers}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Registered</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
              <CardTitle className="text-xs sm:text-sm font-medium">Teachers</CardTitle>
              <UserCheck className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats.teachers}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Active</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
              <CardTitle className="text-xs sm:text-sm font-medium">Students</CardTitle>
              {/* <img src={logo} className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground"/> */}
              <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats.students}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Learning</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
              <CardTitle className="text-xs sm:text-sm font-medium">Schools</CardTitle>
              {/* <img src={logo} className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground"/> */}
              <GraduationCap className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats.schools}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">Engaged</p>
            </CardContent>
          </Card>

          {/* <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 p-3 sm:p-4">
              <CardTitle className="text-xs sm:text-sm font-medium">Admins</CardTitle>
              <Shield className="h-3 w-3 sm:h-4 sm:w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent className="p-3 sm:p-4 pt-0 sm:pt-0">
              <div className="text-xl sm:text-2xl font-bold">{stats.admins}</div>
              <p className="text-[10px] sm:text-xs text-muted-foreground">System</p>
            </CardContent>
          </Card>
         */}
         </div>
        {/* Main Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <div className="overflow-x-auto -mx-4 px-4">
            <TabsList className="inline-flex w-auto min-w-full sm:w-full">
              <TabsTrigger value="requests" className="gap-1 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-initial">
                <UserPlus className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Signup Requests</span>
                <span className="sm:hidden">Requests</span>
                {stats.pendingRequests > 0 && (
                  <Badge variant="destructive" className="ml-1 px-1.5 py-0 text-xs">
                    {stats.pendingRequests}
                  </Badge>
                )}
              </TabsTrigger>
              <TabsTrigger value="users" className="gap-1 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-initial">
                <Users className="h-3 w-3 sm:h-4 sm:w-4" />
                Users
              </TabsTrigger>
              <TabsTrigger value="content" className="gap-1 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-initial">
                <BookOpen className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Content</span>
                <span className="sm:hidden">Content</span>
              </TabsTrigger>
              <TabsTrigger value="analytics" className="gap-1 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-initial">
                <BarChart className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Analytics</span>
                <span className="sm:hidden">Stats</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1 sm:gap-2 text-xs sm:text-sm flex-1 sm:flex-initial">
                <Settings className="h-3 w-3 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Settings</span>
                <span className="sm:hidden">Config</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Signup Requests Tab */}
          <TabsContent value="requests" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Pending Signup Requests</CardTitle>
                <CardDescription>
                  Review and approve or reject new user signups
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingRequests ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading requests...
                  </div>
                ) : (
                  <div className="space-y-3">
                    {signupRequests.map((request) => (
                      <div
                        key={request.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{request.full_name}</div>
                          <div className="text-sm text-muted-foreground truncate">{request.email}</div>
                          <div className="text-xs text-muted-foreground mt-1">
                            Requested: {new Date(request.created_at).toLocaleDateString()}
                          </div>
                        </div>
                          <Badge
                            variant={
                              request.role === "teacher" 
                                ? "default" 
                                : "secondary"
                            }
                            className="w-full sm:w-auto justify-center"
                          >
                            {request.role}
                          </Badge>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="default"
                              onClick={() => handleApproveRequest(request)}
                              disabled={processingRequest === request.id}
                              className="gap-1 flex-1 sm:flex-initial"
                            >
                              <CheckCircle className="h-4 w-4" />
                              <span className="hidden sm:inline">Approve</span>
                              <span className="sm:hidden">✓</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="destructive"
                              onClick={() => handleRejectRequest(request)}
                              disabled={processingRequest === request.id}
                              className="gap-1 flex-1 sm:flex-initial"
                            >
                              <XCircle className="h-4 w-4" />
                              <span className="hidden sm:inline">Reject</span>
                              <span className="sm:hidden">✗</span>
                            </Button>
                          </div>
                        </div>
                    ))}
                    {signupRequests.length === 0 && (
                      <div className="text-center py-12 text-muted-foreground">
                        <UserPlus className="h-12 w-12 mx-auto mb-4 opacity-50" />
                        <p>No pending signup requests</p>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Users Tab */}
          <TabsContent value="users" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>User Management</CardTitle>
                <CardDescription>
                  View and manage all registered users
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingUsers ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Loading users...
                  </div>
                ) : (
                  <div className="space-y-2">
                    {users.map((user) => (
                      <div
                        key={user.id}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 p-3 sm:p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                      >
                        <div className="flex-1 min-w-0">
                          <div className="font-medium truncate">{user.full_name || "No name"}</div>
                          <div className="text-sm text-muted-foreground truncate">{user.email}</div>
                          {user.role === "school" && (
                              <div className="text-xs font-semibold text-purple-600 mt-1 bg-purple-50 px-2 py-0.5 rounded w-fit" >
                                {user.schoolCode ? `School Code: ${user.schoolCode}` : "No Code Assigned"}
                              </div>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge
                            variant={ 
                              user.role === "admin" 
                                ? "destructive" 
                                : user.role === "teacher" 
                                ? "default" 
                                : "secondary"
                            }
                            className="flex-1 sm:flex-initial justify-center"
                          >
                            {user.role}
                          </Badge>
                          {user.role === "school" && (
                              <Button size="sm" variant="outline" className="h-8 text-xs text-purple-600 border-purple-300" onClick={() => handleGenerateSchoolCode(user.id)}>
                              {user.schoolCode ? "Regenerate Code" : "Generate Code"}
                              </Button>
                            )}  
                          {user.role !== "admin" && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleRecreateAuthAccount(user)}
                                disabled={deletingUser === user.id}
                                className="h-8 gap-1 text-xs shrink-0"
                                title="Recreate Firebase Auth account"
                              >
                                <KeyRound className="h-3 w-3" />
                                <span className="hidden sm:inline">Recreate Auth</span>
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteUser(user)}
                                disabled={deletingUser === user.id}
                                className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 shrink-0"
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </>
                          )}
                        </div> 
                        {/* LIVE CATEGORY MANAGEMENT CHECKBOXES FOR SCHOOL USERS */}
                        {user.role === "school" && (
                          <div className="flex flex-wrap gap-4 items-center mt-1 p-2 bg-slate-50 rounded-md border text-xs">
                            <span className="font-bold text-slate-500 uppercase tracking-wider mr-2">Category Access:</span>
                            <label className="flex items-center gap-1.5 font-medium cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                                checked={user.allowedCategories?.Prastuti || false} 
                                onChange={(e) => handleCategoryToggle(user.id, "Prastuti", e.target.checked)}
                              />
                              Prastuti
                            </label>
                            <label className="flex items-center gap-1.5 font-medium cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                                checked={user.allowedCategories?.Anubhav || false} 
                                onChange={(e) => handleCategoryToggle(user.id, "Anubhav", e.target.checked)}
                              />
                              Anubhav
                            </label>
                            <label className="flex items-center gap-1.5 font-medium cursor-pointer">
                              <input 
                                type="checkbox" 
                                className="rounded text-primary focus:ring-primary h-3.5 w-3.5"
                                checked={user.allowedCategories?.Geomagic || false} 
                                onChange={(e) => handleCategoryToggle(user.id, "Geomagic", e.target.checked)}
                              />
                              Geomagic
                            </label>
                          </div>
                        )} 
                      </div>
                    ))}
                    {users.length === 0 && (
                      <div className="text-center py-8 text-muted-foreground">
                        No users found
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Content Tab */}
          <TabsContent value="content" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Content Management</CardTitle>
                <CardDescription>
                  Manage courses, videos, and learning materials
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <BookOpen className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Content management coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Analytics Tab */}
          <TabsContent value="analytics" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Analytics & Reports</CardTitle>
                <CardDescription>
                  View platform statistics and user activity
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <BarChart className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Analytics dashboard coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>System Settings</CardTitle>
                <CardDescription>
                  Configure platform settings and preferences
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="text-center py-12 text-muted-foreground">
                  <Settings className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>Settings panel coming soon</p>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
