import pino from 'pino';
import crypto from 'crypto';
import { Request } from 'express';

const logger = pino({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  redact: {
    paths: [
      'access_token',
      'refresh_token',
      'headers.authorization',
      'token',
      'code',
      'verification_code',
    ],
    remove: true,
  },
});

export function getCorrelationId(req?: Request): string {
  const headerId = req?.headers['x-correlation-id'];
  if (typeof headerId === 'string' && headerId.trim().length > 0) return headerId;
  if (Array.isArray(headerId) && headerId.length > 0) return headerId[0];
  return crypto.randomUUID();
}

export function maskPhoneNumber(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '*'.repeat(Math.max(0, digits.length - 2)) + digits.slice(-2);
  const last4 = digits.slice(-4);
  const country = digits.startsWith('55') ? '+55' : '';
  return `${country}******${last4}`;
}

export function safe(obj: Record<string, any>): Record<string, any> {
  const clone: Record<string, any> = { ...obj };
  if (clone.access_token) clone.access_token = '[REDACTED]';
  if (clone.refresh_token) clone.refresh_token = '[REDACTED]';
  if (clone.code) clone.code = '[REDACTED]';
  if (clone.verification_code) clone.verification_code = '[REDACTED]';
  if (clone.phone_number) clone.phone_number = maskPhoneNumber(clone.phone_number);
  if (clone.to) clone.to = maskPhoneNumber(clone.to);
  if (clone.from) clone.from = maskPhoneNumber(clone.from);
  return clone;
}

export default logger; 