import { useAuth } from "./hooks/useAuth";

export function SignOutButton() {
  const { signOut, isAuthenticated } = useAuth();

  if (!isAuthenticated) {
    return null;
  }

  return (
    <button
      className="px-4 py-2 rounded-lg transition-colors bg-blue-500 text-white hover:bg-blue-600"
      onClick={signOut}
    >
      Sign out
    </button>
  );
}