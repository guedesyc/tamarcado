import Link from "next/link";
import { BookOpen, CalendarDays, CircleDollarSign, CreditCard, House, Image, Inbox, List, Scissors, Settings, Users, HelpCircle, ExternalLink, Globe } from "lucide-react";
import { isExternalWorkspaceLink, workspaceLinks } from "@/lib/workspace-links";

const icons = [House, CalendarDays, Inbox, Users, List, Scissors, HelpCircle, CircleDollarSign, Image, Globe, Settings, CreditCard, BookOpen] as const;

export function WorkspaceMenuLinks({ activePath }: { activePath: string }) {
  return <>{workspaceLinks.map(([label, href], index) => {
    const Icon = icons[index];
    return isExternalWorkspaceLink(href)
      ? <a className="side-link" href={href} target="_blank" rel="noopener noreferrer" key={href}><Icon size={17} aria-hidden="true" />{label}<ExternalLink size={14} aria-hidden="true" /><span className="sr-only">(abre em nova aba no Google Drive)</span></a>
      : <Link className={`side-link ${activePath === href ? "active" : ""}`} href={href} key={href} aria-current={activePath === href ? "page" : undefined}><Icon size={17} aria-hidden="true" />{label}</Link>;
  })}</>;
}
