import { describe, it, expect } from 'vitest';
import { parseSize, cpuToQuota, buildHostConfig } from '../../../src/modules/sandbox/executors/dockerHostConfig.js';
import { BUILTIN_HARDENING } from '../../../src/modules/sandbox/executors/hardening.js';

describe('dockerHostConfig (resource-limit config building)', () => {
  it('parseSize converts size strings to bytes', () => {
    expect(parseSize('512m')).toBe(536870912);
    expect(parseSize('1g')).toBe(1073741824);
    expect(parseSize('1024k')).toBe(1048576);
    expect(parseSize(1234)).toBe(1234);
    expect(parseSize('garbage')).toBe(0);
  });

  it('cpuToQuota converts cores to microseconds', () => {
    expect(cpuToQuota('1.0')).toBe(100000);
    expect(cpuToQuota('0.5')).toBe(50000);
    expect(cpuToQuota('2')).toBe(200000);
    expect(cpuToQuota('bad')).toBe(100000);
  });

  it('buildHostConfig applies limits and BR-12 hardening', () => {
    const hc = buildHostConfig({
      resources: { memory: '512m', cpu: '1.0', disk: '1g', pidsLimit: 100 },
      networkEnabled: false,
      binds: ['/a:/workspace:rw'],
      hardening: BUILTIN_HARDENING,
    });
    expect(hc.Memory).toBe(536870912);
    expect(hc.CpuQuota).toBe(100000);
    expect(hc.PidsLimit).toBe(100);
    expect(hc.NetworkMode).toBe('none');
    expect(hc.CapDrop).toEqual(['ALL']);
    expect(hc.CapAdd).toEqual(['CHOWN', 'SETGID', 'SETUID', 'NET_BIND_SERVICE']);
    expect(hc.SecurityOpt).toEqual(['no-new-privileges:true']);
    expect(hc.Privileged).toBe(false);
    expect(hc.ReadonlyRootfs).toBe(true);
    expect(hc.StorageOpt).toEqual({ size: '1073741824' });
  });

  it('buildHostConfig enables network when requested (BR-07)', () => {
    const hc = buildHostConfig({
      resources: { memory: '512m', cpu: '1.0', disk: '1g', pidsLimit: 100 },
      networkEnabled: true,
      binds: [],
      hardening: BUILTIN_HARDENING,
    });
    expect(hc.NetworkMode).toBe('bridge');
  });
});
