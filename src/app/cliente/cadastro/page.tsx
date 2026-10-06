import { CustomerSignupForm } from "@/components/customer-signup-form";
import { customerAccountCreationEnabled } from "@/lib/customer-account-feature";
import { redirect } from "next/navigation";

export default async function CustomerSignupPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (!customerAccountCreationEnabled()) redirect("/cliente/entrar?erro=signup-paused");
  const { erro } = await searchParams;
  return <main className="form-wrap"><CustomerSignupForm error={erro}/></main>;
}
