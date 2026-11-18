import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|icon.svg|apple-icon.png|manifest.webmanifest|icons/|brand/|fonts/|sw.js).*)"],
};
