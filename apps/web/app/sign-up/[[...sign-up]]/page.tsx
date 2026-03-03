import type { Metadata } from "next";
import { SignUp } from "@clerk/nextjs";
import { dark } from "@clerk/themes";
import { BRAND_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Sign Up`,
  robots: {
    index: false,
    follow: false,
  },
};

function safeRedirect(input?: string) {
  if (!input || typeof input !== "string") return "/onboarding/";
  if (!input.startsWith("/")) return "/onboarding/";
  return input;
}

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const params = await searchParams;
  const forceRedirectUrl = safeRedirect(params?.redirect_url);

  return (
    <main className="min-h-screen bg-[#0f111a] text-white flex items-center justify-center px-6 py-10">
      <SignUp
        routing="path"
        path="/sign-up"
        forceRedirectUrl={forceRedirectUrl}
        fallbackRedirectUrl="/onboarding/"
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
