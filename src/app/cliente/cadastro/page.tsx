import { CustomerSignupForm } from "@/components/customer-signup-form";

export default async function CustomerSignupPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  return <main className="form-wrap"><CustomerSignupForm error={erro}/></main>;
}
