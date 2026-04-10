// GioHomeStudio — Route protection middleware
// Protects /dashboard/* routes, redirects to /login if no session

export { auth as middleware } from "@/lib/auth";

export const config = {
  matcher: ["/dashboard/:path*"],
};
