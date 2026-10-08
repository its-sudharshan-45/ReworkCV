import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/hooks/useAuth';
import { ProtectedRoute } from '@/layouts/ProtectedRoute';
import { PublicOnlyRoute } from '@/layouts/PublicOnlyRoute';
import { Loader2 } from 'lucide-react';

// Lazy-loaded routes for code-splitting
const HomePage = lazy(() => import('@/pages/Home').then((m) => ({ default: m.HomePage })));
const LoginPage = lazy(() => import('@/pages/Login').then((m) => ({ default: m.LoginPage })));
const SignupPage = lazy(() => import('@/pages/Signup').then((m) => ({ default: m.SignupPage })));
const AuthCallbackPage = lazy(() => import('@/pages/AuthCallback').then((m) => ({ default: m.AuthCallbackPage })));
const ForgotPasswordPage = lazy(() => import('@/pages/ForgotPassword').then((m) => ({ default: m.ForgotPasswordPage })));
const ResetPasswordPage = lazy(() => import('@/pages/ResetPassword').then((m) => ({ default: m.ResetPasswordPage })));
const ResumeAnalysisPage = lazy(() => import('@/pages/ResumeAnalysis').then((m) => ({ default: m.ResumeAnalysisPage })));
const ReportPage = lazy(() => import('@/pages/Report').then((m) => ({ default: m.ReportPage })));
const NotFoundPage = lazy(() => import('@/pages/NotFound').then((m) => ({ default: m.NotFoundPage })));

function RouteFallback() {
  return (
    <div className="flex h-screen w-screen items-center justify-center bg-[#F7FAF8] dark:bg-slate-950">
      <Loader2 className="h-8 w-8 animate-spin text-[#16A36A]" />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<RouteFallback />}>
          <Routes>
            {/* Public Landing */}
            <Route path="/" element={<HomePage />} />

            {/* Public Auth Routes */}
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/signup" element={<SignupPage />} />
              <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            </Route>

            {/* Password reset must stay reachable with a recovery session,
                which counts as authenticated — keep it outside PublicOnlyRoute. */}
            <Route path="/reset-password" element={<ResetPasswordPage />} />

            {/* OAuth Callback */}
            <Route path="/auth/callback" element={<AuthCallbackPage />} />

            {/* Protected Routes — ReworkCV has 3 pages:
                main analysis, report, and in-report cover letters */}
            <Route element={<ProtectedRoute />}>
              <Route path="/analysis" element={<ResumeAnalysisPage />} />
              <Route path="/resume/report/:resumeId/:analysisId" element={<ReportPage />} />

              {/* Legacy / Removed-area Redirects */}
              <Route path="/dashboard" element={<Navigate to="/analysis" replace />} />
              <Route path="/history" element={<Navigate to="/analysis" replace />} />
              <Route path="/cover-letters" element={<Navigate to="/analysis" replace />} />
              <Route path="/settings" element={<Navigate to="/analysis" replace />} />
              <Route path="/profile" element={<Navigate to="/analysis" replace />} />
              <Route path="/profile/resumes" element={<Navigate to="/analysis" replace />} />
              <Route path="/resume" element={<Navigate to="/analysis" replace />} />
              <Route path="/resume/*" element={<Navigate to="/analysis" replace />} />
              <Route path="/resume-builder" element={<Navigate to="/analysis" replace />} />
              <Route path="/saved" element={<Navigate to="/analysis" replace />} />
              <Route path="/notifications" element={<Navigate to="/analysis" replace />} />
            </Route>

            {/* Catch-all 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
