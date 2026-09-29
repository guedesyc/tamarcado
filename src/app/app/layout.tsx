import { PageTransition } from "@/components/workspace-navigation";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>;
}
