import { NextResponse, type NextRequest } from "next/server";

/**
 * Optional HTTP Basic auth. Set APP_PASSWORD (and optionally APP_USERNAME,
 * default "admin") to require a login for every page and API route.
 */
export function proxy(request: NextRequest) {
  const password = process.env.APP_PASSWORD;
  if (!password) return NextResponse.next();

  const username = process.env.APP_USERNAME || "admin";
  const header = request.headers.get("authorization");
  if (header?.startsWith("Basic ")) {
    try {
      const [user, ...rest] = atob(header.slice(6)).split(":");
      if (user === username && rest.join(":") === password) {
        return NextResponse.next();
      }
    } catch {}
  }
  return new NextResponse("Authentication required", {
    status: 401,
    headers: { "WWW-Authenticate": 'Basic realm="MediaShelf", charset="UTF-8"' },
  });
}

export const config = {
  matcher: "/((?!_next/static|_next/image|favicon.ico).*)",
};
