import type { Metadata } from "next";
import { ChatOnboardingPrototype } from "./chat-onboarding-prototype";

export const metadata: Metadata = {
  title: "Chat Onboarding Prototype",
  description: "Voice-first onboarding prototype with a live avatar surface, structured notes, and a generated learning-plan preview.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function ChatOnboardingPrototypePage() {
  return <ChatOnboardingPrototype />;
}
