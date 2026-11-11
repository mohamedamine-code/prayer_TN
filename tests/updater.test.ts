import { describe, expect, it } from 'vitest';
import {
  classifyUpdaterError,
  initialUpdateState,
  isValidVersion,
  reduceUpdateEvent,
  releaseUrlFor,
  type UpdateState,
} from '../src/shared/updater';

const base = (): UpdateState => ({
  ...initialUpdateState('1.0.0'),
  updaterEnabled: true,
});

describe('isValidVersion', () => {
  it('accepts valid semver tags', () => {
    expect(isValidVersion('1.0.1')).toBe(true);
    expect(isValidVersion('2.10.3')).toBe(true);
    expect(isValidVersion('1.1.0-beta.2')).toBe(true);
    expect(isValidVersion('1.0.0+build.1')).toBe(true);
  });

  it('rejects malformed or hostile versions', () => {
    expect(isValidVersion('')).toBe(false);
    expect(isValidVersion('1.0')).toBe(false);
    expect(isValidVersion('v1.0.1')).toBe(false);
    expect(isValidVersion('abc')).toBe(false);
    expect(isValidVersion('1.0.1<script>')).toBe(false);
    expect(isValidVersion(42)).toBe(false);
    expect(isValidVersion(null)).toBe(false);
  });
});

describe('releaseUrlFor', () => {
  it('builds the GitHub release page URL', () => {
    expect(releaseUrlFor('1.0.1')).toBe(
      'https://github.com/mohamedamine-code/prayer_TN/releases/tag/v1.0.1',
    );
  });
});

describe('reduceUpdateEvent', () => {
  it('idle → checking → notAvailable records lastCheckedAt', () => {
    let s = base();
    s = reduceUpdateEvent(s, { type: 'checking' });
    expect(s.phase).toBe('checking');
    s = reduceUpdateEvent(s, { type: 'notAvailable' });
    expect(s.phase).toBe('notAvailable');
    expect(s.lastCheckedAt).not.toBeNull();
    expect(s.errorMessage).toBeNull();
  });

  it('idle → checking → available stores validated version + notes', () => {
    let s = base();
    s = reduceUpdateEvent(s, { type: 'checking' });
    s = reduceUpdateEvent(s, {
      type: 'available',
      version: '1.0.1',
      notes: 'Fixes',
      url: releaseUrlFor('1.0.1'),
    });
    expect(s.phase).toBe('available');
    expect(s.availableVersion).toBe('1.0.1');
    expect(s.releaseNotes).toBe('Fixes');
  });

  it('refuses an invalid version (invalid release metadata)', () => {
    let s = base();
    s = reduceUpdateEvent(s, { type: 'checking' });
    s = reduceUpdateEvent(s, { type: 'available', version: 'garbage', notes: null, url: null });
    expect(s.phase).toBe('error');
    expect(s.errorKind).toBe('metadata');
    expect(s.availableVersion).toBeNull();
  });

  it('full download flow: available → downloading → progress → downloaded', () => {
    let s = base();
    s = reduceUpdateEvent(s, { type: 'available', version: '1.0.1', notes: null, url: null });
    s = reduceUpdateEvent(s, { type: 'downloadProgress', percent: 25, transferred: 250, total: 1000 });
    expect(s.phase).toBe('downloading');
    expect(s.progressPercent).toBe(25);
    s = reduceUpdateEvent(s, { type: 'downloadProgress', percent: 104, transferred: 1000, total: 1000 });
    expect(s.progressPercent).toBe(100);
    s = reduceUpdateEvent(s, { type: 'downloaded' });
    expect(s.phase).toBe('downloaded');
  });

  it('download progress is ignored unless a download is in flight', () => {
    let s = base();
    s = reduceUpdateEvent(s, { type: 'downloadProgress', percent: 50, transferred: 5, total: 10 });
    expect(s.phase).toBe('idle');
    expect(s.progressPercent).toBe(-1);
  });

  it('a check while downloaded stays downloaded (never clobbers pending install)', () => {
    let s = base();
    s = reduceUpdateEvent(s, { type: 'available', version: '1.0.1', notes: null, url: null });
    s = reduceUpdateEvent(s, { type: 'downloadProgress', percent: 10, transferred: 1, total: 10 });
    s = reduceUpdateEvent(s, { type: 'downloaded' });
    s = reduceUpdateEvent(s, { type: 'checking' });
    expect(s.phase).toBe('downloaded');
    s = reduceUpdateEvent(s, { type: 'notAvailable' });
    expect(s.phase).toBe('downloaded');
  });

  it('an error during download does not erase the pending install state', () => {
    let s = base();
    s = reduceUpdateEvent(s, { type: 'available', version: '1.0.1', notes: null, url: null });
    s = reduceUpdateEvent(s, { type: 'downloadProgress', percent: 10, transferred: 1, total: 10 });
    s = reduceUpdateEvent(s, { type: 'downloaded' });
    s = reduceUpdateEvent(s, { type: 'error', message: 'net::ERR_CONNECTION_RESET' });
    expect(s.phase).toBe('downloaded');
  });

  it('network errors are classified as network', () => {
    let s = base();
    s = reduceUpdateEvent(s, { type: 'error', message: 'getaddrinfo ENOTFOUND api.github.com' });
    expect(s.errorKind).toBe('network');
  });

  it('metadata errors are classified as metadata', () => {
    let s = base();
    s = reduceUpdateEvent(s, { type: 'error', message: 'sha512 checksum mismatch' });
    expect(s.errorKind).toBe('metadata');
    s = base();
    s = reduceUpdateEvent(s, { type: 'error', message: 'Cannot read app-update.yml' });
    expect(s.errorKind).toBe('metadata');
  });
});

describe('classifyUpdaterError', () => {
  it('maps offline/network failures to network', () => {
    expect(classifyUpdaterError('net::ERR_INTERNET_DISCONNECTED')).toBe('network');
    expect(classifyUpdaterError('socket hang up')).toBe('network');
  });

  it('falls back to unknown', () => {
    expect(classifyUpdaterError('something exploded')).toBe('unknown');
  });
});
