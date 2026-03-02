import { NextRequest, NextResponse } from 'next/server';
import { jwtVerify } from 'jose';

const secret = new TextEncoder().encode(process.env.JWT_SECRET || 'dev-secret-key-change-in-production');

interface JwtPayload {
  email: string;
  role: string;
  clientId?: number;
}

async function verifyAndDecode(token: string): Promise<JwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as JwtPayload;
  } catch {
    return null;
  }
}

// Portaalin suojatut sivut
const portalProtectedPaths = ['/tiimi', '/arkisto'];
// Portaalin julkiset sivut
const portalPublicPaths = ['/portal/login', '/portal/verify'];

export async function middleware(request: NextRequest) {
  const token = request.cookies.get('token')?.value;
  const pathname = request.nextUrl.pathname;

  // 1. Portaalin julkiset sivut (/portal/login, /portal/verify)
  if (portalPublicPaths.some((p) => pathname.startsWith(p))) {
    if (token) {
      const decoded = await verifyAndDecode(token);
      if (decoded && decoded.role === 'company') {
        return NextResponse.redirect(new URL('/tiimi', request.url));
      }
    }
    return NextResponse.next();
  }

  // 2. Portaalin suojatut sivut (/tiimi, /arkisto)
  if (portalProtectedPaths.some((p) => pathname.startsWith(p))) {
    if (!token) {
      return NextResponse.redirect(new URL('/portal/login', request.url));
    }
    const decoded = await verifyAndDecode(token);
    if (!decoded) {
      const response = NextResponse.redirect(new URL('/portal/login', request.url));
      response.cookies.delete('token');
      return response;
    }
    if (decoded.role !== 'company') {
      return NextResponse.redirect(new URL('/portal/login', request.url));
    }
    return NextResponse.next();
  }

  // 3. Admin-kirjautumissivu (/login) -- olemassa oleva logiikka
  if (pathname === '/login') {
    if (token) {
      const decoded = await verifyAndDecode(token);
      if (decoded) {
        return NextResponse.redirect(new URL('/', request.url));
      }
    }
    return NextResponse.next();
  }

  // 4. Admin-sivut (kaikki muut) -- olemassa oleva logiikka
  if (!token) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  const decoded = await verifyAndDecode(token);
  if (!decoded) {
    const response = NextResponse.redirect(new URL('/login', request.url));
    response.cookies.delete('token');
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico).*)'],
};
