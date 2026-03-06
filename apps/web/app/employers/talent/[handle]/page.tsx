import { redirect } from "next/navigation";

export default async function TalentDetailPage({ params }: { params: Promise<{ handle: string }> }) {
  const { handle } = await params;
  redirect(("/u/" + handle + "/") as never);
}
