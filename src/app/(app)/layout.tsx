import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Shell, type ContextItem } from "@/components/Shell";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data }, { count }] = await Promise.all([
    supabase.from("contexts").select("id, name, color").eq("archived", false).order("position", { ascending: true }),
    supabase
      .from("responsibilities")
      .select("id", { count: "exact", head: true })
      .is("context_id", null)
      .neq("state", "concluida"),
  ]);

  return (
    <Shell contexts={(data ?? []) as ContextItem[]} email={user.email ?? ""} inbox={count ?? 0}>
      {children}
    </Shell>
  );
}
