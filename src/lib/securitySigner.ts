/**
 * DirectHub Security Signer
 * HMAC-SHA256 Request Signing & Timestamp Validation
 *
 * Protects sensitive API routes (Escrow, Payments) from:
 * - Replay attacks (timestamp window validation)
 * - Request tampering (HMAC-SHA256 signature verification)
 * - Unauthorized access (shared secret signing)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';

// ── Configuration ────────────────────────────────────────────────────────────

/** Signing secret — falls back to a build-time constant if env var is absent */
const SIGNING_SECRET =
  process.env.REQUEST_SIGNING_SECRET ||
  'directhub-internal-signing-secret-v1';

/** Maximum allowed clock skew between client and server (milliseconds) */
const TIMESTAMP_WINDOW_MS = 5 * 60 * 1000; // 5 minutes

/** Header names used for signed requests */
export const SIGNING_HEADERS = {
  SIGNATURE: 'x-directhub-signature',
  TIMESTAMP: 'x-directhub-timestamp',
  NONCE: 'x-directhub-nonce',
} as const;

// ── Core Signing Utilities ───────────────────────────────────────────────────

/**
 * Builds the canonical string that is signed.
 * Format: `{method}\n{path}\n{timestamp}\n{nonce}\n{bodyHash}`
 */
function buildSigningPayload(
  method: string,
  path: string,
  timestamp: string,
  nonce: string,
  bodyHash: string
): string {
  return [method.toUpperCase(), path, timestamp, nonce, bodyHash].join('\n');
}

/**
 * Computes HMAC-SHA256 of `payload` using `secret`.
 * Returns a hex-encoded digest.
 */
function computeHmac(payload: string, secret: string): string {
  return createHmac('sha256', secret).update(payload, 'utf8').digest('hex');
}

/**
 * Computes SHA-256 hash of a string body.
 * Returns hex digest (used as bodyHash in the signing payload).
 */
function hashBody(body: string): string {
  return createHmac('sha256', '').update(body, 'utf8').digest('hex');
}

// ── Client-Side: Sign a Request ──────────────────────────────────────────────

export interface SignedHeaders {
  [SIGNING_HEADERS.SIGNATURE]: string;
  [SIGNING_HEADERS.TIMESTAMP]: string;
  [SIGNING_HEADERS.NONCE]: string;
}

/**
 * Generates the signing headers for an outgoing request.
 *
 * @param method  HTTP method (GET, POST, …)
 * @param path    URL path (e.g. `/api/escrow/otp`)
 * @param body    Serialised request body string (pass `''` for GET)
 * @param secret  Optional override for the signing secret
 * @returns       Object containing the three signing headers to attach
 *
 * @example
 * ```ts
 * const headers = signRequest('POST', '/api/escrow/otp', JSON.stringify(body));
 * fetch('/api/escrow/otp', { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
 * ```
 */
export function signRequest(
  method: string,
  path: string,
  body: string = '',
  secret: string = SIGNING_SECRET
): SignedHeaders {
  const timestamp = Date.now().toString();
  const nonce = Math.random().toString(36).slice(2) + Date.now().toString(36);
  const bodyHash = hashBody(body);
  const payload = buildSigningPayload(method, path, timestamp, nonce, bodyHash);
  const signature = computeHmac(payload, secret);

  return {
    [SIGNING_HEADERS.SIGNATURE]: signature,
    [SIGNING_HEADERS.TIMESTAMP]: timestamp,
    [SIGNING_HEADERS.NONCE]: nonce,
  };
}

// ── Server-Side: Verify a Request ────────────────────────────────────────────

export interface VerificationResult {
  valid: boolean;
  reason?: string;
}

/**
 * Verifies the HMAC-SHA256 signature and timestamp of an incoming request.
 *
 * @param req     The incoming `NextRequest`
 * @param body    The raw request body string (read before calling this)
 * @param secret  Optional override for the signing secret
 */
export async function verifyRequest(
  req: NextRequest,
  body: string,
  secret: string = SIGNING_SECRET
): Promise<VerificationResult> {
  const signature = req.headers.get(SIGNING_HEADERS.SIGNATURE);
  const timestamp = req.headers.get(SIGNING_HEADERS.TIMESTAMP);
  const nonce = req.headers.get(SIGNING_HEADERS.NONCE);

  // ── 1. Presence check ─────────────────────────────────────────────────────
  if (!signature || !timestamp || !nonce) {
    return { valid: false, reason: 'Missing signing headers' };
  }

  // ── 2. Timestamp window validation (replay-attack prevention) ─────────────
  const requestTime = parseInt(timestamp, 10);
  if (isNaN(requestTime)) {
    return { valid: false, reason: 'Invalid timestamp format' };
  }

  const now = Date.now();
  const delta = Math.abs(now - requestTime);
  if (delta > TIMESTAMP_WINDOW_MS) {
    return {
      valid: false,
      reason: `Request timestamp out of window (delta: ${delta}ms, max: ${TIMESTAMP_WINDOW_MS}ms)`,
    };
  }

  // ── 3. Reconstruct and compare signature ──────────────────────────────────
  const url = new URL(req.url);
  const path = url.pathname + (url.search || '');
  const bodyHash = hashBody(body);
  const payload = buildSigningPayload(req.method, path, timestamp, nonce, bodyHash);
  const expected = computeHmac(payload, secret);

  // Use timing-safe comparison to prevent timing attacks
  try {
    const sigBuf = Buffer.from(signature, 'hex');
    const expBuf = Buffer.from(expected, 'hex');

    if (sigBuf.length !== expBuf.length) {
      return { valid: false, reason: 'Signature length mismatch' };
    }

    const match = timingSafeEqual(sigBuf, expBuf);
    if (!match) {
      return { valid: false, reason: 'Signature mismatch' };
    }
  } catch {
    return { valid: false, reason: 'Signature comparison error' };
  }

  return { valid: true };
}

// ── Middleware Wrapper ────────────────────────────────────────────────────────

type RouteHandler = (req: NextRequest, ...args: any[]) => Promise<NextResponse>;

/**
 * Higher-order function that wraps a Next.js API route handler with
 * HMAC-SHA256 request signing verification.
 *
 * Requests that lack valid signing headers are rejected with HTTP 401.
 * The raw body is buffered once and re-injected so the inner handler
 * can still call `req.json()` or `req.formData()`.
 *
 * @param handler  The original route handler
 * @param options  Optional configuration overrides
 *
 * @example
 * ```ts
 * export const POST = withRequestSigning(async (req) => {
 *   const body = await req.json();
 *   // ...
 * });
 * ```
 */
export function withRequestSigning(
  handler: RouteHandler,
  options: { secret?: string; skipInDev?: boolean } = {}
): RouteHandler {
  return async (req: NextRequest, ...args: any[]): Promise<NextResponse> => {
    // Allow bypassing in local development when explicitly opted in
    if (options.skipInDev && process.env.NODE_ENV === 'development') {
      return handler(req, ...args);
    }

    // Buffer the body so we can both verify it and pass it to the handler
    let rawBody = '';
    try {
      rawBody = await req.text();
    } catch {
      rawBody = '';
    }

    const result = await verifyRequest(req, rawBody, options.secret);

    if (!result.valid) {
      console.warn(
        `[SecuritySigner] Rejected ${req.method} ${req.nextUrl.pathname} — ${result.reason}`
      );
      return NextResponse.json(
        {
          error: 'Request signature invalid or expired',
          code: 'SIGNATURE_INVALID',
          reason: process.env.NODE_ENV !== 'production' ? result.reason : undefined,
        },
        { status: 401 }
      );
    }

    // Re-create a new Request with the buffered body so the handler can read it
    const clonedReq = new NextRequest(req.url, {
      method: req.method,
      headers: req.headers,
      body: rawBody || null,
    });

    return handler(clonedReq, ...args);
  };
}

// ── Utility: Generate a one-time signing secret ───────────────────────────────

/**
 * Generates a cryptographically random signing secret suitable for use as
 * `REQUEST_SIGNING_SECRET` in your `.env` file.
 *
 * Run once during setup:
 * ```bash
 * node -e "const {randomBytes}=require('crypto'); console.log(randomBytes(32).toString('hex'));"
 * ```
 */
export function generateSigningSecret(): string {
  // This is a pure utility — only call from scripts, not from request handlers
  if (typeof require !== 'undefined') {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const { randomBytes } = require('crypto');
      return randomBytes(32).toString('hex');
    } catch {
      // fallback
    }
  }
  return Math.random().toString(36).repeat(4).slice(2, 66);
}
