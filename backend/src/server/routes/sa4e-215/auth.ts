/**
 * SA4E-215 — Authentication routes.
 * Implements: FR-001 to FR-004, FR-009 to FR-012 (FSD.md)
 * Routes: POST /api/sa4e-215/auth/login, POST /api/sa4e-215/auth/register, POST /api/sa4e-215/auth/logout
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import type { Logger } from 'pino';
import { verify } from '@node-rs/argon2';
import { sign } from 'jose';
import { PrismaClient } from '@prisma/client';

const AUTH_SECRET = new TextEncoder().encode(process.env.AUTH_SECRET || 'change-me-in-production');
const JWT_EXPIRES_IN = '24h';

export function createAuthRoute(prisma: PrismaClient, logger: Logger) {
  const app = new Hono();

  // POST /api/sa4e-215/auth/login
  app.post('/login', async (c: Context) => {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json(
        { success: false, error: { code: 'ERR_001', message: 'Email and password are required' } },
        400
      );
    }

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.password_hash) {
      return c.json(
        { success: false, error: { code: 'ERR_002', message: 'Invalid email or password' } },
        401
      );
    }

    // Verify password using argon2
    const passwordValid = await verify(user.password_hash, password, {
      memoryCost: 2 ** 16,
      timeCost: 2,
      parallelism: 2,
    });

    if (!passwordValid) {
      return c.json(
        { success: false, error: { code: 'ERR_002', message: 'Invalid email or password' } },
        401
      );
    }

    // Sign JWT token
    const token = await sign(
      { sub: user.id, email: user.email, role: user.role },
      AUTH_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return c.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  });

  // POST /api/sa4e-215/auth/register
  app.post('/register', async (c: Context) => {
    const { email, password, role } = await c.req.json();

    if (!email || !password) {
      return c.json(
        { success: false, error: { code: 'ERR_001', message: 'Email and password are required' } },
        400
      );
    }

    // Check if user already exists
    const existingUser = await prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      return c.json(
        { success: false, error: { code: 'ERR_001', message: 'Email already registered' } },
        400
      );
    }

    // Hash password using argon2
    const passwordHash = await hash(password, {
      memoryCost: 2 ** 16,
      timeCost: 2,
      parallelism: 2,
    });

    // Create user
    const user = await prisma.user.create({
      data: {
        email,
        password_hash: passwordHash,
        role: role || 'user',
      },
    });

    // Sign JWT token
    const token = await sign(
      { sub: user.id, email: user.email, role: user.role },
      AUTH_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    return c.json({
      success: true,
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
        },
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      },
    });
  });

  // POST /api/sa4e-215/auth/logout
  app.post('/logout', async (c: Context) => {
    // In a real implementation, you would blacklist the token
    // For this demo, we just return success
    return c.json({
      success: true,
      message: 'Successfully logged out',
    });
  });

  return app;
}

/** Helper: hash password using argon2 */
async function hash(password: string, options: { memoryCost: number; timeCost: number; parallelism: number }) {
  // This is a simplified version - in production use @node-rs/argon2 directly
  const { encode } = await import('@node-rs/argon2');
  return encode(password, options);
}

export type { createAuthRoute };