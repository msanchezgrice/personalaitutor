import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { BRAND_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Sign In`,
  robots: {
    index: false,
    follow: false,
  },
};

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
