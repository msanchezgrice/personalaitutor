// FOUNDATION-SEED (owner: workstream H, funnel and dashboard). Exists so the
// dashboard nav's typed routes resolve in every worktree; workstream H replaces
// it with the real page and removes this marker.
import { redirect } from "next/navigation";

export default function SeedPage() {
  redirect("/dashboard");
}
