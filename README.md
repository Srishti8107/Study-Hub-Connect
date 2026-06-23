# StudyHub - Learning Management System

A modern, full-featured Learning Management System built with React, TypeScript, Firebase, and Tailwind CSS.

## 🚀 Features

### Authentication & User Management
- **Firebase Authentication** - Secure email/password authentication
- **Role-Based Access Control** - Three user roles: Admin, Teacher, Student
- **Admin Panel** - Full-featured admin dashboard with user management
- **Real-time Auth State** - Automatic synchronization across tabs

### Admin Features
- User management dashboard
- Role-based user statistics
- Real-time Firestore data
- Secure role-based routing

### Coming Soon
- Course management
- Video content delivery
- Learning progress tracking
- Teacher content creation tools
- Advanced analytics

## 📋 Prerequisites

- Node.js & npm ([install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating))
- Firebase account (free tier available)

## 🛠️ Quick Setup

### 1. Clone and Install

```sh
# Clone the repository
git clone <YOUR_GIT_URL>

# Navigate to project directory
cd study-hub

# Install dependencies
npm install
```

### 2. Configure Firebase

**Create Firebase Project:**
1. Go to [Firebase Console](https://console.firebase.google.com/)
2. Create a new project
3. Enable Email/Password authentication
4. Create a Firestore database

**Get Firebase Configuration:**
1. Go to Project Settings → General
2. Scroll to "Your apps" → Web app
3. Copy the configuration

**Create `.env` file:**
```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

### 3. Run the Application

```sh
npm run dev
```

Open [http://localhost:5173](http://localhost:5173) in your browser.

## 🔐 Creating the First Admin

### Option 1: Sign Up Then Upgrade (Recommended)
<!-- 1. Navigate to `/auth` and sign up -->
2. Go to Firebase Console → Firestore Database
3. Find your user document
4. Change `role` field to `"admin"`
5. Sign in at `/admin/login`

### Option 2: Manual Creation
See [SETUP_CHECKLIST.md](SETUP_CHECKLIST.md) for detailed steps.

## 📚 Documentation

- **[SETUP_CHECKLIST.md](SETUP_CHECKLIST.md)** - Step-by-step setup guide
- **[FIREBASE_SETUP.md](FIREBASE_SETUP.md)** - Detailed Firebase configuration
- **[MIGRATION_SUMMARY.md](MIGRATION_SUMMARY.md)** - Technical changes overview

## 🗺️ Routes

| Route | Access | Description |
|-------|--------|-------------|
| `/` | Public | Home page with learning content |
| `/auth` | Public | User sign up/sign in (Student/Teacher) |
| `/admin/login` | Public | Admin authentication |
| `/admin` | Admin Only | Admin dashboard |

## 🏗️ Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **Styling**: Tailwind CSS, shadcn/ui
- **Authentication**: Firebase Auth
- **Database**: Cloud Firestore
- **State Management**: React Context
- **Routing**: React Router v6
- **Forms**: React Hook Form + Zod validation

## 📁 Project Structure

```
src/
├── config/
│   └── firebase.ts          # Firebase configuration
├── services/
│   └── api.ts               # Firebase auth wrapper
├── hooks/
│   └── useAuth.tsx          # Authentication hook
├── pages/
│   ├── Auth.tsx             # User authentication
│   ├── AdminLogin.tsx       # Admin login
│   ├── AdminPanel.tsx       # Admin dashboard
│   └── Index.tsx            # Home page
├── components/
│   ├── lms/                 # LMS-specific components
│   └── ui/                  # shadcn/ui components
└── App.tsx                  # Main app with routing
```

## 🧪 Testing

```sh
# Run tests
npm test

# Run tests in watch mode
npm run test:watch
```

## 🏗️ Building for Production

```sh
# Create production build
npm run build

# Preview production build
npm run preview
```

## 🔒 Security

- Firebase Authentication for secure user management
- Firestore security rules for data access control
- Role-based access control (RBAC)
- Environment variables for sensitive data
- Password validation (min 6 characters)

## 📝 License

This project is private and confidential.

## 🆘 Support

For issues or questions:
1. Check the documentation files
2. Review Firebase Console for errors
3. Check browser console for client-side errors
4. Verify `.env` configuration

## 🎯 Roadmap

- [x] Firebase Authentication integration
- [x] Admin panel with user management
- [x] Role-based access control
- [ ] Course management system
- [ ] Video content delivery
- [ ] Teacher content creation
- [ ] Student learning progress
- [ ] Advanced analytics dashboard
- [ ] Email verification
- [ ] Password reset flow

---

**Built with ❤️ using React, Firebase, and Tailwind CSS**
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/REPLACE_WITH_PROJECT_ID) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/features/custom-domain#custom-domain)
