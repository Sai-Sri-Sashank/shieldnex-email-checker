// tests/emailCheck.test.js
const request = require('supertest');
const app = require('../index');
const dns = require('dns').promises;

jest.mock('dns', () => ({
  promises: {
    resolveMx: jest.fn(),
    resolve: jest.fn(),
  },
}));

describe('POST /api/check-emails', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('rejects non‑array payload', async () => {
    const res = await request(app).post('/api/check-emails').send({ emails: 'not-an-array' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/must contain an array/);
  });

  test('rejects empty array', async () => {
    const res = await request(app).post('/api/check-emails').send({ emails: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/empty/);
  });

  test('enforces max 100 addresses', async () => {
    const many = Array.from({ length: 101 }, (_, i) => `user${i}@example.com`);
    const res = await request(app).post('/api/check-emails').send({ emails: many });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/Maximum 100/);
  });

  test('detects invalid syntax', async () => {
    const res = await request(app).post('/api/check-emails').send({ emails: ['bad@@example.com'] });
    expect(res.status).toBe(200);
    const result = res.body.results[0];
    expect(result.classification).toBe('likely bounce');
    expect(result.explanation).toMatch(/Invalid email syntax/);
  });

  test('handles domain with MX records', async () => {
    dns.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }]);
    const res = await request(app).post('/api/check-emails').send({ emails: ['good@example.com'] });
    expect(dns.resolveMx).toHaveBeenCalledWith('example.com');
    expect(res.status).toBe(200);
    const result = res.body.results[0];
    expect(result.classification).toBe('unknown');
    expect(result.mxRecords).toContain('mail.example.com');
  });

  test('fallback to A records when no MX', async () => {
    dns.resolveMx.mockRejectedValue(Object.assign(new Error('ENODATA'), { code: 'ENODATA' }));
    dns.resolve.mockResolvedValue(['93.184.216.34']);
    const res = await request(app).post('/api/check-emails').send({ emails: ['fallback@example.org'] });
    expect(dns.resolveMx).toHaveBeenCalled();
    expect(dns.resolve).toHaveBeenCalledWith('example.org');
    const result = res.body.results[0];
    expect(result.classification).toBe('unknown');
    expect(result.mxRecords).toContain('93.184.216.34');
  });

  test('no routing records -> bounce', async () => {
    dns.resolveMx.mockRejectedValue(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }));
    dns.resolve.mockRejectedValue(Object.assign(new Error('ENOTFOUND'), { code: 'ENOTFOUND' }));
    const res = await request(app).post('/api/check-emails').send({ emails: ['norecord@nonexistent.tld'] });
    const result = res.body.results[0];
    expect(result.classification).toBe('likely bounce');
    expect(result.explanation).toMatch(/No MX or A records/);
  });

  test('temporary DNS error results in unknown', async () => {
    dns.resolveMx.mockRejectedValue(Object.assign(new Error('ETIMEOUT'), { code: 'ETIMEOUT' }));
    const res = await request(app).post('/api/check-emails').send({ emails: ['temp@some.tld'] });
    const result = res.body.results[0];
    expect(result.classification).toBe('unknown');
    expect(result.explanation).toMatch(/DNS error/);
  });

  test('deduplicates input while preserving order', async () => {
    dns.resolveMx.mockResolvedValue([{ exchange: 'mail.example.com', priority: 10 }]);
    const res = await request(app).post('/api/check-emails').send({ emails: ['dup@example.com', 'dup@example.com'] });
    expect(res.body.results).toHaveLength(1);
  });
});
