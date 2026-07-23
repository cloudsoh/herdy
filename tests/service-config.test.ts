import { describe, it, expect } from 'vitest';
import { getServiceType, SERVICE_TYPES } from '../src/config/service-config.js';

describe('getServiceType', () => {
  it('detects api suffix', () => {
    expect(getServiceType('auth-api')).toBe('api');
    expect(getServiceType('my-api')).toBe('api');
  });

  it('detects web suffix', () => {
    expect(getServiceType('auth-web')).toBe('web');
    expect(getServiceType('my-web')).toBe('web');
  });

  it('detects cron suffix', () => {
    expect(getServiceType('auth-cron')).toBe('cron');
  });

  it('detects mq suffix', () => {
    expect(getServiceType('messaging-mq')).toBe('mq');
  });

  it('detects ws suffix', () => {
    expect(getServiceType('my-ws')).toBe('ws');
  });

  it('returns null for non-service types', () => {
    expect(getServiceType('common-backend')).toBeNull();
    expect(getServiceType('my-common')).toBeNull();
    expect(getServiceType('auth-common')).toBeNull();
  });

  it('SERVICE_TYPES contains all expected types', () => {
    expect(SERVICE_TYPES).toEqual(['api', 'web', 'cron', 'mq', 'ws']);
  });
});
