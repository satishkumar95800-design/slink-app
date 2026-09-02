import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = ['/admin', '/users', '/students', '/classes', '/fees', '/student-fees', '/payments', '/reports', '/receipts', '/dev'];

// Named "middleware" export — Next.js 16 deprecates this file in favor of proxy.ts.
// Run `npx @next/codemod@canary middleware-to-proxy .` to migrate automatically.
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const isProtected = PROTECTED_PREFIXES.some(
    (p) => pathname === p || pathname.startsWith(`${p}/`),
  );

  if (!isProtected) {
    return NextResponse.next();
  }

  const authed = request.cookies.get('slink_authed');
  if (!authed?.value) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next|favicon.ico|.*\\..*).*)'],
};
