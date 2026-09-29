import { SignupForm } from "@/components/signup-form";

export default async function SignupPage({searchParams}:{searchParams:Promise<{erro?:string}>}) {
  const {erro}=await searchParams;
  return <main className="form-wrap"><SignupForm error={erro}/></main>;
}
