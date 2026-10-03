import { redirect } from "next/navigation";

// Automations are created from a reel's side panel on the home page.
export default function NewAutomation() {
  redirect("/home");
}
