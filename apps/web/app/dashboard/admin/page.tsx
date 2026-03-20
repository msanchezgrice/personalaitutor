import { redirect } from "next/navigation";

export default function DashboardAdminIndexPage() {
  redirect("/dashboard/admin/signups");
}
