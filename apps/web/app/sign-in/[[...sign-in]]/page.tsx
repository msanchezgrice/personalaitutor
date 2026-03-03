import { SignIn } from "@clerk/nextjs";
import { dark } from "@clerk/themes";

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-[#0f111a] text-white flex items-center justify-center px-6 py-10">
      <SignIn
        routing="path"
        path="/sign-in"
        afterSignInUrl="/dashboard/"
        appearance={{
          baseTheme: dark,
          variables: {
            colorPrimary: "#4f46e5",
            colorBackground: "#0f111a",
            colorInputBackground: "#111827",
            colorText: "#f3f4f6",
          },
        }}
      />
    </main>
  );
}
