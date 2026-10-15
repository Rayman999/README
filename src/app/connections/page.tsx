import { redirect } from "next/navigation";

// Agent connections now live in a tab on the profile page. This keeps old
// links and the OAuth flow's returnTo=/connections working.
export default function ConnectionsPage() {
  redirect("/profile?tab=connections");
}
