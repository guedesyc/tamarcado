import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OnboardingForm } from "@/components/onboarding-form";

export default async function OnboardingPage() {
 const supabase=await createClient();
 if(!supabase) redirect("/entrar?erro=config");
 const {data:{user}}=await supabase.auth.getUser();
 if(!user) redirect("/entrar");
 return <main className="form-wrap"><OnboardingForm initialName={String(user.user_metadata.full_name??"")}/></main>;
}
