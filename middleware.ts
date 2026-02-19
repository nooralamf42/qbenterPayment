import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Define paths that should not be redirected
  const isMaintenancePage = request.nextUrl.pathname === '/maintenance'
  const isStaticAsset = request.nextUrl.pathname.startsWith('/_next') || 
                        request.nextUrl.pathname.includes('.') // for files like favicon.ico, images, etc.

  // If already on maintenance page or requesting static assets, allow
  if (isMaintenancePage || isStaticAsset) {
    return NextResponse.next()
  }

  // Redirect everything else to maintenance page
  return NextResponse.redirect(new URL('/maintenance', request.url))
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
}
