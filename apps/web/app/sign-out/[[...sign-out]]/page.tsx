import type { Metadata } from "next";
import { BRAND_NAME } from "@/lib/site";
import { SignOutClient } from "./sign-out-client";

export const metadata: Metadata = {
  title: `${BRAND_NAME} | Sign Out`,
  robots: {
    index: false,
    follow: false,
  },
};

export default function SignOutPage() {
  return <SignOutClient />;
}
