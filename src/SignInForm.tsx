import { useState } from "react";
import { useAuth } from "./hooks/useAuth";
import { toast } from "sonner";

export function SignInForm() {
  const { signIn, signInAnonymous } = useAuth();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setSubmitting(true);
    
    const formData = new FormData(e.currentTarget);
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;
    const name = flow === "signUp" ? (formData.get("name") as string) : undefined;

    try {
      await signIn(email, password, name);
      toast.success(flow === "signIn" ? "Signed in successfully!" : "Account created successfully!");
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

  return (
    <div className="w-full">
      <form className="flex flex-col gap-4" onSubmit={handleSubmit}>
        {flow === "signUp" && (
          <input
            className="input-field"
            type="text"
            name="name"
            placeholder="Full Name"
            required
          />
        )}
        <input
          className="input-field"
          type="email"
          name="email"
          placeholder="Email"
          required
        />
        <input
          className="input-field"
          type="password"
          name="password"
          placeholder="Password"
          required
        />
        <button className="auth-button" type="submit" disabled={submitting}>
          {flow === "signIn" ? "Sign in" : "Sign up"}
        </button>
        <div className="text-center text-sm text-slate-600">
          <span>
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <button
            type="button"
            className="text-blue-500 cursor-pointer"
            onClick={() => setFlow(flow === "signIn" ? "signUp" : "signIn")}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>
      </form>
      <div className="flex items-center justify-center my-3">
        <hr className="my-4 grow" />
        <span className="mx-4 text-slate-400 ">or</span>
        <hr className="my-4 grow" />
      </div>
      <button 
        className="auth-button" 
        onClick={handleAnonymousSignIn}
        disabled={submitting}
      >
        Sign in anonymously
      </button>
    </div>
  );
}