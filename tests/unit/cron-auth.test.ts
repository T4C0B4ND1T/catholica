import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { assertCron } from '@/lib/jobs/cron-auth';

describe('assertCron', () => {
  const old = process.env.CRON_SECRET;
  beforeEach(() => {
    process.env.CRON_SECRET = 's3cret';
  });
  afterEach(() => {
    if (old === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = old;
  });

  const req = (h?: string) => new Request('http://x/api/cron/readings', h ? { headers: { authorization: h } } : {});

  it('rejects a missing header with 401', () => {
    expect(assertCron(req())?.status).toBe(401);
  });
  it('rejects a wrong secret', () => {
    expect(assertCron(req('Bearer nope'))?.status).toBe(401);
  });
  it('accepts the right secret', () => {
    expect(assertCron(req('Bearer s3cret'))).toBeNull();
  });
  it('rejects everything when CRON_SECRET is unset', () => {
    delete process.env.CRON_SECRET;
    expect(assertCron(req('Bearer undefined'))?.status).toBe(401);
    expect(assertCron(req('Bearer '))?.status).toBe(401);
  });
});
