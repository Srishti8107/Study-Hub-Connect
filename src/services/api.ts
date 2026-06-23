import { 
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  updateProfile,
  sendPasswordResetEmail,
  confirmPasswordReset,
  verifyPasswordResetCode,
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
  User as FirebaseUser
} from 'firebase/auth';
import { doc, setDoc, getDoc, getDocs, collection, deleteDoc, query, where, arrayUnion, increment, writeBatch } from 'firebase/firestore';
import { auth, db } from '@/config/firebase';

export type AppRole = "admin" | "teacher" | "student";

// Admin emails that can bypass approval and auto-create their accounts
const ADMIN_EMAILS = [
  "admin@lms.com",
  "admin@studyhub.com",
  "admin2026@lms.com",
  // Add more admin emails here as needed
];

// Helper function to check if an email is an admin email
export function isAdminEmail(email: string): boolean {
  return ADMIN_EMAILS.includes(email.toLowerCase());
}

export interface User {
  id: string;
  email?: string | null;
  full_name?: string | null;
  avatar_url?: string | null;
}

export interface Session {
  access_token: string | null;
  user?: User | null;
}

// Convert Firebase User to our User interface
function firebaseUserToUser(firebaseUser: FirebaseUser): User {
  return {
    id: firebaseUser.uid,
    email: firebaseUser.email,
    full_name: firebaseUser.displayName,
    avatar_url: firebaseUser.photoURL,
  };
}

// Get current Firebase user session
export async function getSession(): Promise<Session | null> {
  const user = auth.currentUser;
  if (!user) return null;
  
  const token = await user.getIdToken();
  return {
    access_token: token,
    user: firebaseUserToUser(user),
  };
}

// Send a 6-digit OTP to the given email via EmailJS.
// Returns the generated OTP so the caller can validate it client-side.
export async function sendEmailOTP(email: string): Promise<{ otp?: string; error?: string }> {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
  const templateId = import.meta.env.VITE_EMAILJS_TEMPLATE_ID as string | undefined;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;

  const isPlaceholder = (v?: string) =>
    !v || v.startsWith('your-') || v === '' || v === 'undefined';

  if (isPlaceholder(serviceId) || isPlaceholder(templateId) || isPlaceholder(publicKey)) {
    return { error: 'Email service is not configured. Add your EmailJS credentials to the .env file and restart the dev server.' };
  }

  const otp = Math.floor(100000 + Math.random() * 900000).toString();

  try {
    const emailjs = await import('@emailjs/browser');
    await emailjs.send(
      serviceId!,
      templateId!,
      { to_email: email, otp_code: otp, app_name: 'StudyHub' },
      publicKey!
    );
    return { otp };
  } catch (err: any) {
    const status = err?.status ?? err?.text ?? '';
    const detail = err?.message ?? String(err);
    console.error('EmailJS send failed:', err);
    if (String(status) === '400' || String(detail).toLowerCase().includes('service')) {
      return { error: 'Invalid EmailJS Service ID. Check VITE_EMAILJS_SERVICE_ID in your .env file.' };
    }
    if (String(status) === '401' || String(detail).toLowerCase().includes('public key') || String(detail).toLowerCase().includes('origin')) {
      return { error: 'Invalid EmailJS Public Key or unauthorized origin. Check VITE_EMAILJS_PUBLIC_KEY in your .env file.' };
    }
    if (String(detail).toLowerCase().includes('template')) {
      return { error: 'Invalid EmailJS Template ID. Check VITE_EMAILJS_TEMPLATE_ID in your .env file.' };
    }
    return { error: `Failed to send verification email: ${detail || 'Unknown error'}` };
  }
}

// Notify admin via email that a new signup request is waiting for approval.
// Fire-and-forget — failure is non-fatal but errors ARE logged to console.
async function notifyAdminOfSignupRequest(fullName: string, email: string, role: string) {
  const serviceId = import.meta.env.VITE_EMAILJS_SERVICE_ID as string | undefined;
  const templateId = import.meta.env.VITE_EMAILJS_ADMIN_TEMPLATE_ID as string | undefined;
  const publicKey = import.meta.env.VITE_EMAILJS_PUBLIC_KEY as string | undefined;
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL as string | undefined;

  const isPlaceholder = (v?: string) => !v || v.startsWith('your-') || v === '' || v === 'undefined';
  if (isPlaceholder(serviceId) || isPlaceholder(templateId) || isPlaceholder(publicKey) || isPlaceholder(adminEmail)) {
    console.warn('[AdminNotify] Skipped — one or more env vars are missing:', { serviceId, templateId, publicKey, adminEmail });
    return;
  }

  try {
    const emailjs = await import('@emailjs/browser');
    const result = await emailjs.send(
      serviceId!,
      templateId!,
      {
        to_email: adminEmail,
        name: 'Admin',
        email: email,
        title: 'New Signup Request',
        user_name: fullName || 'Unknown',
        user_email: email,
        user_role: role,
        app_name: 'StudyHub',
      },
      publicKey!
    );
    console.log('[AdminNotify] Email sent successfully:', result.status, result.text);
  } catch (err) {
    console.error('[AdminNotify] Failed to send admin notification email:', err);
  }
}

// Sign up new user (OTP already verified by the caller):
// 1. Creates Firebase Auth account
// 2. Writes signup_request to Firestore for admin approval (in parallel with updateProfile)
// 3. Signs the user out (they must wait for admin approval)
export async function signUp(payload: { 
  email: string; 
  password: string; 
  full_name?: string; 
  role: AppRole 
}): Promise<{ error?: string }> {
  try {
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      payload.email,
      payload.password
    );

    const requestId = `${Date.now()}_${payload.email.replace(/[^a-zA-Z0-9]/g, '_')}`;

    // Run updateProfile and Firestore write in parallel — neither depends on the other
    await Promise.all([
      payload.full_name
        ? updateProfile(userCredential.user, { displayName: payload.full_name })
        : Promise.resolve(),
      setDoc(doc(db, 'signup_requests', requestId), {
        uid: userCredential.user.uid,
        email: payload.email,
        full_name: payload.full_name || '',
        role: payload.role,
        status: 'pending',
        created_at: new Date().toISOString(),
      }),
    ]);

    // Sign out immediately — user must wait for admin approval
    // Notify admin in the background (fire-and-forget)
    notifyAdminOfSignupRequest(payload.full_name || '', payload.email, payload.role);
    await firebaseSignOut(auth);
    return {};
  } catch (err: any) {
    if (err.code === 'auth/email-already-in-use') {
      // Check Firestore queries in parallel to give the most helpful message
      try {
        const [usersSnap, reqSnap] = await Promise.all([
          getDocs(query(collection(db, 'users'), where('email', '==', payload.email))),
          getDocs(query(collection(db, 'signup_requests'), where('email', '==', payload.email))),
        ]);
        // 1. Already an approved user?
        if (!usersSnap.empty) {
          return { error: 'An account with this email already exists. Please go to Sign In.' };
        }
        // 2. Already a pending request?
        if (!reqSnap.empty) {
          return { error: 'A signup request for this email is already pending admin approval. Please wait for the admin to approve your account.' };
        }
        // 3. Firebase Auth account exists but no Firestore data — reuse it
        const credential = await signInWithEmailAndPassword(auth, payload.email, payload.password);
        const requestId = `${Date.now()}_${payload.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
        await setDoc(doc(db, 'signup_requests', requestId), {
          uid: credential.user.uid,
          email: payload.email,
          full_name: payload.full_name || credential.user.displayName || '',
          role: payload.role,
          status: 'pending',
          created_at: new Date().toISOString(),
        });
        notifyAdminOfSignupRequest(payload.full_name || credential.user.displayName || '', payload.email, payload.role);
        await firebaseSignOut(auth);
        return {};
      } catch (innerErr: any) {
        if (innerErr.code === 'auth/wrong-password' || innerErr.code === 'auth/invalid-credential') {
          return { error: 'An account with this email already exists but the password is incorrect. Please sign in with your existing password or use a different email.' };
        }
        return { error: 'An account with this email already exists. Please sign in or use a different email.' };
      }
    }
    if (err.code === 'auth/weak-password') {
      return { error: 'Password is too weak. Please use at least 6 characters.' };
    }
    return { error: err?.message ?? String(err) };
  }
}


// Sign in existing user - verify user is in users collection
export async function signIn(payload: { 
  email: string; 
  password: string 
}): Promise<{ session?: Session; error?: string }> {
  try {
    const userCredential = await signInWithEmailAndPassword(
      auth,
      payload.email,
      payload.password
    );

    // Check if this is an admin email
    const isAdmin = isAdminEmail(payload.email);

    // Verify user exists in users collection (admin-approved users only)
    const userDoc = await getDoc(doc(db, 'users', userCredential.user.uid));
    
    if (!userDoc.exists()) {
      if (isAdmin) {
        // Auto-create admin user in Firestore
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          email: userCredential.user.email,
          full_name: userCredential.user.displayName || 'Admin',
          role: 'admin',
          created_at: new Date().toISOString(),
          approved_at: new Date().toISOString(),
        });
      } else {
        // User authenticated but not approved by admin
        await firebaseSignOut(auth);
        return { error: "Your account is pending admin approval. Please wait for approval before signing in." };
      }
    } else {
      // User exists in Firestore - check if they are an admin
      const userData = userDoc.data();
      const userRole = userData?.role as AppRole;
      
      // If user is an admin, allow them to sign in regardless of approval status
      if (userRole !== 'admin' && !isAdmin) {
        // For non-admin users, they must be in the users collection (already approved)
        // This is already handled by the userDoc.exists() check above
      }
    }

    const token = await userCredential.user.getIdToken();
    const session: Session = {
      access_token: token,
      user: firebaseUserToUser(userCredential.user),
    };

    return { session };
  } catch (err: any) {
    // Provide more user-friendly error messages
    let errorMessage = err?.message ?? String(err);
    
    if (err.code === 'auth/user-not-found') {
      errorMessage = "No account found with this email address. Please sign up or contact your administrator.";
    } else if (err.code === 'auth/wrong-password') {
      errorMessage = "Incorrect password. Please try again.";
    } else if (err.code === 'auth/invalid-email') {
      errorMessage = "Invalid email address format.";
    } else if (err.code === 'auth/user-disabled') {
      errorMessage = "This account has been disabled.";
    } else if (err.code === 'auth/too-many-requests') {
      errorMessage = "Too many failed attempts. Please try again later.";
    } else if (err.code === 'auth/network-request-failed') {
      errorMessage = "Network error. Please check your internet connection.";
    } else if (err.code === 'auth/invalid-credential') {
      // Check if user exists in Firestore but not in Firebase Auth
      try {
        const usersQuery = query(collection(db, 'users'), where('email', '==', payload.email));
        const userSnapshot = await getDocs(usersQuery);
        if (!userSnapshot.empty) {
          errorMessage = "Your account needs to be recreated. Please contact your administrator or sign up again.";
        } else {
          errorMessage = "Invalid email or password. Please check your credentials and try again.";
        }
      } catch {
        errorMessage = "Invalid email or password. Please check your credentials and try again.";
      }
    }
    
    return { error: errorMessage };
  }
}

// Sign out current user
export async function signOut(): Promise<void> {
  await firebaseSignOut(auth);
}

// Get user role from Firestore
export async function getUserRole(userId: string): Promise<AppRole | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return null;
    
    const data = userDoc.data();
    return (data?.role as AppRole) ?? null;
  } catch (err) {
    console.warn("getUserRole failed", err);
    return null;
  }
}

// Get user profile (name, email, role) from Firestore users collection
export async function getUserProfile(userId: string): Promise<(User & { role?: AppRole | null }) | null> {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) return null;

    const data = userDoc.data();
    return {
      id: userId,
      email: data?.email ?? null,
      full_name: data?.full_name ?? null,
      avatar_url: data?.avatar_url ?? null,
      role: (data?.role as AppRole) ?? null,
    };
  } catch (err) {
    console.warn("getUserProfile failed", err);
    return null;
  }
}

// Listen to auth state changes
export function onAuthStateChange(callback: (user: FirebaseUser | null) => void) {
  return onAuthStateChanged(auth, callback);
}

// Get all pending signup requests
export async function getSignupRequests() {
  try {
    const requestsSnapshot = await getDocs(collection(db, 'signup_requests'));
    return requestsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    }));
  } catch (err) {
    console.error("Error fetching signup requests:", err);
    return [];
  }
}

// Approve signup request - create Firebase Auth account and move to users collection
export async function approveSignupRequest(requestId: string, requestData: any, adminEmail: string, adminPassword: string) {
  try {
    // Store user in users collection FIRST before creating auth account
    // This ensures the document exists when auth state listener checks it
    const tempUserId = `temp_${Date.now()}_${requestData.email.replace(/[^a-zA-Z0-9]/g, '_')}`;
    
    // Create user in Firebase Auth (this will auto-sign them in)
    const userCredential = await createUserWithEmailAndPassword(
      auth,
      requestData.email,
      requestData.password
    );

    const userId = userCredential.user.uid;

    // Set the display name on the Firebase Auth user
    await updateProfile(userCredential.user, {
      displayName: requestData.full_name || ''
    });

    // Store user in users collection with actual UID
    await setDoc(doc(db, 'users', userId), {
      email: requestData.email,
      full_name: requestData.full_name || '',
      role: requestData.role,
      created_at: new Date().toISOString(),
      approved_at: new Date().toISOString(),
    });

    // Wait a moment to ensure Firestore write completes
    await new Promise(resolve => setTimeout(resolve, 500));

    // Delete the signup request
    await deleteDoc(doc(db, 'signup_requests', requestId));

    // Sign out the newly created user immediately
    await firebaseSignOut(auth);

    // Wait for sign out to complete
    await new Promise(resolve => setTimeout(resolve, 300));

    // Re-authenticate the admin
    await signInWithEmailAndPassword(auth, adminEmail, adminPassword);

    return { success: true, message: "User approved successfully" };
  } catch (err: any) {
    console.error("Error approving signup:", err);
    return { success: false, error: err?.message ?? String(err) };
  }
}

// Reject signup request - delete from signup_requests
export async function rejectSignupRequest(requestId: string) {
  try {
    await deleteDoc(doc(db, 'signup_requests', requestId));
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message ?? String(err) };
  }
}

// Delete user - remove from Firestore (Note: Cannot delete from Firebase Auth with client SDK)
export async function deleteUser(userId: string, userEmail: string) {
  try {
    // Delete user document from Firestore
    await deleteDoc(doc(db, 'users', userId));
    
    // Note: We cannot delete the user from Firebase Authentication using the client SDK
    // This would require Firebase Admin SDK or a Cloud Function
    // For now, we only remove from Firestore which will prevent login
    
    return { success: true };
  } catch (err: any) {
    console.error("Error deleting user:", err);
    return { success: false, error: err?.message ?? String(err) };
  }
}

// Save video progress for a user
export async function saveVideoProgress(userId: string, videoId: string, currentTime: number, duration: number) {
  try {
    const percentage = duration > 0 ? (currentTime / duration) * 100 : 0;
    const completed = percentage >= 90;

    await setDoc(doc(db, 'video_progress', `${userId}_${videoId}`), {
      userId,
      videoId,
      currentTime,
      duration,
      percentage,
      completed,
      updated_at: new Date().toISOString(),
    }, { merge: true });

    return { success: true };
  } catch (err: any) {
    console.error("Error saving video progress:", err);
    return { success: false, error: err?.message ?? String(err) };
  }
}

// Save completed video marker for a user
export async function saveCompletedVideo(userId: string, videoId: string) {
  try {
    // Avoid double-counting if already marked completed
    const completedRef = doc(db, 'completed_videos', `${userId}_${videoId}`);
    const existing = await getDoc(completedRef);
    if (existing.exists()) {
      return { success: true };
    }

    await setDoc(doc(db, 'completed_videos', `${userId}_${videoId}`), {
      userId,
      videoId,
      completed: true,
      completed_at: new Date().toISOString(),
    }, { merge: true });

    // Also update the user's document with completed video info
    await setDoc(doc(db, 'users', userId), {
      completedVideos: arrayUnion(videoId),
      lastCompletedAt: new Date().toISOString(),
      totalCompletedVideos: increment(1),
    }, { merge: true });

    return { success: true };
  } catch (err: any) {
    console.error("Error saving completed video:", err);
    return { success: false, error: err?.message ?? String(err) };
  }
}

// Get all completed video IDs for a user
export async function getCompletedVideoIds(userId: string) {
  try {
    const completedQuery = query(
      collection(db, 'completed_videos'),
      where('userId', '==', userId)
    );

    const completedSnapshot = await getDocs(completedQuery);
    return completedSnapshot.docs.map((completedDoc) => completedDoc.data().videoId as string);
  } catch (err: any) {
    console.error("Error getting completed videos:", err);
    return [];
  }
}

// Get video progress for a user
export async function getVideoProgress(userId: string, videoId: string) {
  try {
    const progressDoc = await getDoc(doc(db, 'video_progress', `${userId}_${videoId}`));
    if (!progressDoc.exists()) {
      return { currentTime: 0, duration: 0, percentage: 0, completed: false };
    }
    return progressDoc.data();
  } catch (err: any) {
    console.error("Error getting video progress:", err);
    return { currentTime: 0, duration: 0, percentage: 0, completed: false };
  }
}

// Get all video progress for a user
export async function getAllVideoProgress(userId: string) {
  try {
    const progressQuery = query(
      collection(db, 'video_progress'),
      where('userId', '==', userId)
    );
    const progressSnapshot = await getDocs(progressQuery);
    
    const progressMap: Record<string, any> = {};
    progressSnapshot.docs.forEach(doc => {
      const data = doc.data();
      progressMap[data.videoId] = {
        currentTime: data.currentTime,
        duration: data.duration,
        percentage: data.percentage,
        completed: data.completed,
      };
    });
    
    return progressMap;
  } catch (err: any) {
    console.error("Error getting all video progress:", err);
    return {};
  }
}

// Get dashboard data for a user (completed videos list with details)
export async function getUserDashboardData(userId: string) {
  try {
    // Get user doc for completedVideos array
    const userDoc = await getDoc(doc(db, 'users', userId));
    const userData = userDoc.exists() ? userDoc.data() : {};
    const completedVideoIds: string[] = userData?.completedVideos || [];

    // Get all video progress
    const progressQuery = query(
      collection(db, 'video_progress'),
      where('userId', '==', userId)
    );
    const progressSnapshot = await getDocs(progressQuery);
    const progressMap: Record<string, any> = {};
    progressSnapshot.docs.forEach(d => {
      const data = d.data();
      progressMap[data.videoId] = data;
    });

    // Get completed_videos docs for timestamps
    const completedQuery = query(
      collection(db, 'completed_videos'),
      where('userId', '==', userId)
    );
    const completedSnapshot = await getDocs(completedQuery);
    const completedMap: Record<string, string> = {};
    completedSnapshot.docs.forEach(d => {
      const data = d.data();
      completedMap[data.videoId] = data.completed_at || '';
    });

    return {
      completedVideoIds,
      progressMap,
      completedMap,
      totalWatched: Object.keys(progressMap).filter(k => (progressMap[k].percentage || 0) > 0).length,
      totalCompleted: completedVideoIds.length,
      userName: userData?.full_name || userData?.email || '',
      userRole: userData?.role || '',
    };
  } catch (err: any) {
    console.error("Error getting user dashboard data:", err);
    return {
      completedVideoIds: [],
      progressMap: {},
      completedMap: {},
      totalWatched: 0,
      totalCompleted: 0,
      userName: '',
      userRole: '',
    };
  }
}

// --- Class Passcode Management ---

// Get passcode for a specific class (returns null if not set)
export async function getClassPasscode(className: string): Promise<string | null> {
  try {
    const docSnap = await getDoc(doc(db, 'class_passcodes', className));
    if (docSnap.exists()) return docSnap.data().passcode ?? null;
    return null;
  } catch {
    return null;
  }
}

// Get all class passcodes as a map { "Class 8": "pass123", ... }
export async function getAllClassPasscodes(): Promise<Record<string, string>> {
  try {
    const snap = await getDocs(collection(db, 'class_passcodes'));
    const result: Record<string, string> = {};
    snap.docs.forEach(d => { result[d.id] = d.data().passcode ?? ''; });
    return result;
  } catch {
    return {};
  }
}

// Set or update the passcode for a class
export async function setClassPasscode(className: string, passcode: string): Promise<void> {
  try {
    await setDoc(doc(db, 'class_passcodes', className), { passcode, updatedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('setClassPasscode error:', err);
    throw new Error(err?.message ?? 'Firestore write failed');
  }
}

// Remove the passcode for a class (makes it freely accessible)
export async function removeClassPasscode(className: string): Promise<void> {
  try {
    // Keep the doc but clear the passcode so the class appears in the collection
    await setDoc(doc(db, 'class_passcodes', className), { passcode: '', updatedAt: new Date().toISOString() });
  } catch (err: any) {
    console.error('removeClassPasscode error:', err);
    throw new Error(err?.message ?? 'Firestore write failed');
  }
}

// Initialize all classes in Firestore — creates a doc for each class that doesn't exist yet
// Uses batch writes; never overwrites existing passcodes.
export async function initializeClassPasscodes(classNames: string[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    let count = 0;
    for (const cls of classNames) {
      const ref = doc(db, 'class_passcodes', cls);
      const snap = await getDoc(ref);
      if (!snap.exists()) {
        batch.set(ref, { passcode: '', updatedAt: new Date().toISOString() });
        count++;
      }
    }
    if (count > 0) await batch.commit();
  } catch (err) {
    console.error('Failed to initialize class passcodes:', err);
  }
}

// Send a password reset email via Firebase
export async function sendPasswordReset(email: string): Promise<{ error?: string }> {
  try {
    await sendPasswordResetEmail(auth, email.trim(), {
      url: `${window.location.origin}/reset-password?resetDone=true`,
    });
    return {};
  } catch (err: any) {
    let message = err?.message ?? String(err);
    if (err.code === 'auth/user-not-found') {
      message = 'No account found with this email address.';
    } else if (err.code === 'auth/invalid-email') {
      message = 'Invalid email address format.';
    } else if (err.code === 'auth/too-many-requests') {
      message = 'Too many requests. Please try again later.';
    }
    return { error: message };
  }
}


// export async function sendPasswordReset(email: string) {
//   try {
//     console.log("Sending reset email to:", email);

//     await sendPasswordResetEmail(auth, email.trim(), {
//       url: `${window.location.origin}/reset-password?resetDone=true`,
//     });

//     console.log("Firebase accepted the reset request");
//     return {};
//   } catch (err: any) {
//     console.error("Reset email error:", err);
//     return { error: err.message };
//   }
// }

// Reset password using the oobCode from Firebase's password reset email link
export async function resetPasswordWithCode(
  oobCode: string,
  newPassword: string
): Promise<{ error?: string }> {
  try {
    await verifyPasswordResetCode(auth, oobCode);
    await confirmPasswordReset(auth, oobCode, newPassword);
    return {};
  } catch (err: any) {
    let message = err?.message ?? String(err);
    if (err.code === 'auth/expired-action-code') {
      message = 'This reset link has expired. Please request a new one.';
    } else if (err.code === 'auth/invalid-action-code') {
      message = 'This reset link is invalid or has already been used.';
    } else if (err.code === 'auth/weak-password') {
      message = 'Password is too weak. Please use at least 6 characters.';
    } else if (err.code === 'auth/user-not-found' || err.code === 'auth/user-disabled') {
      message = 'This account no longer exists or has been disabled.';
    }
    return { error: message };
  }
}

// Change password for the currently signed-in user (requires re-authentication)
export async function changePassword(
  currentPassword: string,
  newPassword: string
): Promise<{ error?: string }> {
  try {
    const user = auth.currentUser;
    if (!user || !user.email) {
      return { error: 'No authenticated user found. Please sign in again.' };
    }
    // Re-authenticate before changing password
    const credential = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, credential);
    await updatePassword(user, newPassword);
    return {};
  } catch (err: any) {
    let message = err?.message ?? String(err);
    if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      message = 'Current password is incorrect.';
    } else if (err.code === 'auth/weak-password') {
      message = 'New password is too weak. Use at least 6 characters.';
    } else if (err.code === 'auth/too-many-requests') {
      message = 'Too many attempts. Please try again later.';
    } else if (err.code === 'auth/requires-recent-login') {
      message = 'Session expired. Please sign out and sign in again before changing your password.';
    }
    return { error: message };
  }
}

export default {
  getSession,
  signUp,
  signIn,
  signOut,
  getUserRole,
  getUserProfile,
  onAuthStateChange,
  getSignupRequests,
  approveSignupRequest,
  rejectSignupRequest,
  deleteUser,
  saveVideoProgress,
  saveCompletedVideo,
  getVideoProgress,
  getAllVideoProgress,
  getCompletedVideoIds,
  getUserDashboardData,
  getClassPasscode,
  getAllClassPasscodes,
  setClassPasscode,
  removeClassPasscode,
  initializeClassPasscodes,
  sendPasswordReset,
  resetPasswordWithCode,
  changePassword,
  sendEmailOTP,
};
