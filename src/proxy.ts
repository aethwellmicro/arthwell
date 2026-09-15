import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

// Public paths that never require a session
const PUBLIC_PATHS = ['/login']

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Pass through all Next.js internal requests (_next/data RSC prefetches, etc.)
  if (pathname.startsWith('/_next/')) return NextResponse.next()

  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + '/'))
  const hasSession = request.cookies.has('cls_session')

  // Logged-in user visiting login → send to dashboard
  if (isPublic && hasSession) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Unauthenticated user visiting protected route → send to login
  if (!isPublic && !hasSession) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api        (API routes — auth is handled per-route)
     * - _next      (ALL Next.js internals: static, image, data prefetches, etc.)
     * - favicon.ico, sitemap.xml, robots.txt, arthwell-logo.svg
     */
    '/((?!api|_next|favicon\\.ico|sitemap\\.xml|robots\\.txt|arthwell-logo\\.svg).*)',
  ],
}

