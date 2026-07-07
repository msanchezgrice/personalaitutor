import type { ReactNode } from "react";
import { ForceDarkTheme } from "@/components/force-dark-theme";

export default function AssessmentLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <ForceDarkTheme />
      {children}
    </>
  );
}
