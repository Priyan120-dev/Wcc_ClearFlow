import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';

export const SESSION_COOKIE_NAME = 'wcc_clearflow_session';

/**
 * Retrieves the current visitor's session UUID from cookies,
 * or generates a new one.
 */
export function getOrCreateSessionId(req: NextRequest, res?: NextResponse): string {
  const cookie = req.cookies.get(SESSION_COOKIE_NAME);
  if (cookie?.value) {
    return cookie.value;
  }

  // Generate a cryptographically secure isolated UUID for this visitor
  const newSessionId = crypto.randomUUID();
  if (res) {
    res.cookies.set(SESSION_COOKIE_NAME, newSessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });
  }
  return newSessionId;
}
