import { useAuth } from "./hooks/useAuth";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { EmergencyDashboard } from "./EmergencyDashboard";

export default function App() {
  const { user, isLoading, isAuthenticated } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          <p className="text-gray-600">Loading emergency services...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-blue-50 to-indigo-100">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm p-4 flex justify-between items-center border-b shadow-sm">
        <h2 className="text-xl font-semibold text-gray-800">🚨 Emergency Alert System</h2>
        {isAuthenticated && <SignOutButton />}
      </header>
      <main className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-6xl mx-auto">
          <Content user={user} isAuthenticated={isAuthenticated} />
        </div>
      </main>
      <Toaster position="top-right" />
    </div>
  );
}

function Content({ user, isAuthenticated }: { user: any; isAuthenticated: boolean }) {
  return (
    <div className="flex flex-col gap-8">
      <div className="text-center">
        <h1 className="text-5xl font-bold text-gray-800 mb-4">
          🚨 Emergency Alert System
        </h1>
        <p className="text-xl text-gray-600 mb-8">
          Real-time emergency response and team coordination
        </p>
        
        {isAuthenticated ? (
          <div className="bg-white rounded-xl shadow-lg p-6">
            <div className="mb-4 text-left">
              <p className="text-sm text-gray-600">
                Welcome back, <span className="font-semibold">{user?.name || user?.email || 'User'}</span>
              </p>
            </div>
            <EmergencyDashboard user={user} />
          </div>
        ) : (
          <div className="bg-white rounded-xl shadow-lg p-8 max-w-md mx-auto">
            <div className="mb-6">
              <div className="text-6xl mb-4">🚨</div>
              <p className="text-lg text-gray-700 mb-6">
                Sign in to access emergency alerts and team coordination
              </p>
            </div>
            <SignInForm />
          </div>
        )}
      </div>
    </div>
  );
}