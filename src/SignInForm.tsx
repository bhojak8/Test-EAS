import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { toast } from "sonner";

export function SignInForm() {
  const { signIn, signInAnonymous } = useAuth();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: ""
  });

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    
    try {
      if (flow === "signUp") {
        // For sign up, we need a name
        if (!formData.name.trim()) {
          toast.error("Please enter your name");
          return;
        }
        await signIn(formData.email, formData.password, formData.name);
        toast.success("Account created successfully!");
      } else {
        // For sign in, name is optional
        await signIn(formData.email, formData.password);
        toast.success("Signed in successfully!");
      }
      
      // Clear form
      setFormData({ name: "", email: "", password: "" });
    } catch (error) {
      const toastTitle = flow === "signIn"
        ? "Could not sign in, did you mean to sign up?"
        : "Could not sign up, did you mean to sign in?";
      toast.error(toastTitle);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setSubmitting(true);
    try {
      await signInAnonymous();
      toast.success("Signed in anonymously!");
    } catch (error) {
      toast.error("Failed to sign in anonymously");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="w-full">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {flow === "signUp" && (
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            type="text"
            value={formData.name}
            onChange={(e) => handleInputChange("name", e.target.value)}
            placeholder="Full Name"
            required
            disabled={submitting}
          />
        )}
        <input
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          type="email"
          value={formData.email}
          onChange={(e) => handleInputChange("email", e.target.value)}
          placeholder="Email"
          required
          disabled={submitting}
        />
        <input
          className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
          type="password"
          value={formData.password}
          onChange={(e) => handleInputChange("password", e.target.value)}
          placeholder="Password"
          required
          disabled={submitting}
        />
        <button 
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed" 
          type="submit" 
          disabled={submitting}
        >
          {submitting ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {flow === "signIn" ? "Signing in..." : "Creating account..."}
            </div>
          ) : (
            flow === "signIn" ? "Sign in" : "Sign up"
          )}
        </button>
        <div className="text-center text-sm text-slate-600">
          <span>
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <button
            type="button"
            className="text-blue-500 cursor-pointer hover:text-blue-700 font-medium"
            onClick={() => {
              setFlow(flow === "signIn" ? "signUp" : "signIn");
              setFormData({ name: "", email: "", password: "" });
            }}
            disabled={submitting}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>
      </form>
      <div className="flex items-center justify-center my-4">
        <hr className="flex-grow border-gray-300" />
        <span className="mx-4 text-slate-400 text-sm">or</span>
        <hr className="flex-grow border-gray-300" />
      </div>
      <button 
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed" 
        onClick={handleAnonymousSignIn}
        disabled={submitting}
      >
        {submitting ? (
          <div className="flex items-center">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
            Signing in...
          </div>
        ) : (
          "🎭 Sign in anonymously"
        )}
      </button>
    </div>
  );
}