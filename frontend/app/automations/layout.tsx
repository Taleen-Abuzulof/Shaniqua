import AppShell from "../../components/AppShell";

export default function AutomationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <AppShell>{children}</AppShell>;
}
