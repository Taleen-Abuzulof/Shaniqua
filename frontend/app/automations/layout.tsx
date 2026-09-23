import AppShell from "../../components/AppShell";
import RequireAuth from "../../components/RequireAuth";

export default function AutomationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <RequireAuth>
      <AppShell>{children}</AppShell>
    </RequireAuth>
  );
}
