import AppShell from "../../components/AppShell";
import AuthHashHandler from "../../components/AuthHashHandler";
import RequireAuth from "../../components/RequireAuth";

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthHashHandler>
      <RequireAuth>
        <AppShell>{children}</AppShell>
      </RequireAuth>
    </AuthHashHandler>
  );
}
