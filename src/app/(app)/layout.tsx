import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell, type ContextItem } from "@/components/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data } = await supabase
    .from("contexts")
    .select("id, name, color")
    .eq("archived", false)
    .order("position", { ascending: true });

  return (
    <Shell contexts={(data ?? []) as ContextItem[]} email={user.email ?? ""}>
      {children}
    </Shell>
  );
}
