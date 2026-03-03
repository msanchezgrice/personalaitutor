import type { Metadata } from "next";
import { SignIn } from "@clerk/nextjs";
import { experimental__simple as clerkSimple } from "@clerk/themes";
import { BRAND_NAME } from "@/lib/site";

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Sign In`,
  robots: {
    index: false,
    follow: false,
  },
};

function safeRedirect(input?: string) {
  if (!input || typeof input !== "string") return "/dashboard/";
  if (!input.startsWith("/")) return "/dashboard/";
  return input;
}

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ redirect_url?: string }>;
}) {
  const params = await searchParams;
  const forceRedirectUrl = safeRedirect(params?.redirect_url);

  return (
    <main className="min-h-screen bg-[#eef3f2] text-[#0f172a] flex items-center justify-center px-6 py-10">
      <SignIn
        routing="path"
        path="/sign-in"
        forceRedirectUrl={forceRedirectUrl}
        fallbackRedirectUrl="/dashboard/"
        appearance={{
          baseTheme: clerkSimple,
          variables: {
            colorPrimary: "#10b981",
            colorBackground: "#f8fafc",
            colorInputBackground: "#ffffff",
            colorText: "#0f172a",
            colorTextSecondary: "#475569",
          },
        }}
      />
    </main>
  );
}
