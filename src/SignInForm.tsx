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
    
    // Validate form data
    if (!formData.email.trim()) {
      toast.error("Please enter your email");
      return;
    }
    
    if (!formData.password.trim()) {
      toast.error("Please enter your password");
      return;
    }
    
    if (flow === "signUp" && !formData.name.trim()) {
      toast.error("Please enter your name");
      return;
    }
    
    setSubmitting(true);
    
    try {
      if (flow === "signUp") {
        await signIn(formData.email, formData.password, formData.name);
        toast.success("🎉 Account created successfully!");
      } else {
        await signIn(formData.email, formData.password);
        toast.success("✅ Signed in successfully!");
      }
      
      // Clear form on success
      setFormData({ name: "", email: "", password: "" });
    } catch (error: any) {
      console.error('Sign in error:', error);
      const errorMessage = error?.message || 'An error occurred';
      
      if (flow === "signIn") {
        toast.error(`Sign in failed: ${errorMessage}. Did you mean to sign up?`);
      } else {
        toast.error(`Sign up failed: ${errorMessage}. Did you mean to sign in?`);
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleAnonymousSignIn = async () => {
    setSubmitting(true);
    try {
      await signInAnonymous();
      toast.success("🎭 Signed in anonymously!");
    } catch (error: any) {
      console.error('Anonymous sign in error:', error);
      toast.error("Failed to sign in anonymously");
    } finally {
      setSubmitting(false);
    }
  };

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const switchFlow = () => {
    setFlow(flow === "signIn" ? "signUp" : "signIn");
    setFormData({ name: "", email: "", password: "" });
  };

  return (
    <div className="w-full">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {flow === "signUp" && (
          <div>
            <input
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
              type="text"
              value={formData.name}
              onChange={(e) => handleInputChange("name", e.target.value)}
              placeholder="Full Name"
              required={flow === "signUp"}
              disabled={submitting}
            />
          </div>
        )}
        
        <div>
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            type="email"
            value={formData.email}
            onChange={(e) => handleInputChange("email", e.target.value)}
            placeholder="Email"
            required
            disabled={submitting}
          />
        </div>
        
        <div>
          <input
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm placeholder-gray-400 focus:outline-none focus:ring-blue-500 focus:border-blue-500"
            type="password"
            value={formData.password}
            onChange={(e) => handleInputChange("password", e.target.value)}
            placeholder="Password"
            required
            disabled={submitting}
          />
        </div>
        
        <button 
          className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
          type="submit" 
          disabled={submitting}
        >
          {submitting ? (
            <div className="flex items-center">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
              {flow === "signIn" ? "Signing in..." : "Creating account..."}
            </div>
          ) : (
            flow === "signIn" ? "🔐 Sign in" : "🎉 Create account"
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
            className="text-blue-500 cursor-pointer hover:text-blue-700 font-medium transition-colors"
            onClick={switchFlow}
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
        className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-gray-600 hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors" 
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