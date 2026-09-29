import { WorkspaceMobileNav } from "@/components/workspace-mobile-nav";
import { BackButton, PageTransition } from "@/components/workspace-navigation";
import { Suspense } from "react";

export default function WorkspaceLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={children}><PageTransition><div className="workspace-back-bar"><BackButton/></div>{children}<WorkspaceMobileNav /></PageTransition></Suspense>;
}
