import { withAuth } from "next-auth/middleware"

export default withAuth({
  pages: {
    signIn: "/login",
  },
})

export const config = {
  matcher: [
    // Protect all routes except these public ones
    "/((?!api/auth|login|signup|_next/static|_next/image|favicon.ico).*)",
  ],
}
