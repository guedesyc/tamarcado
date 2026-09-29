import { WorkspaceMobileNav } from "@/components/workspace-mobile-nav";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <>{children}<WorkspaceMobileNav /></>;
}
