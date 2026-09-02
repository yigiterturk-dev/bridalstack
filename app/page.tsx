import { redirect } from "next/navigation";
import { getCurrentUserId } from "@/lib/tenant";

export default async function Home() {
  const userId = await getCurrentUserId();
  if (userId) redirect("/dashboard");
  redirect("/landing");
}
