import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { GameAudio } from './audio';

function audioParameter() {
  return {
    value: 0,
    cancelScheduledValues: vi.fn(),
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  };
}

function mockAudio(initialState: AudioContextState = 'running') {
  const context = {
    state: initialState,
    currentTime: 0,
    destination: {},
    onstatechange: null as (() => void) | null,
    createGain: vi.fn(() => ({ gain: audioParameter(), connect: vi.fn() })),
    createDynamicsCompressor: vi.fn(() => ({
      threshold: audioParameter(),
      knee: audioParameter(),
      ratio: audioParameter(),
      attack: audioParameter(),
      release: audioParameter(),
      connect: vi.fn(),
    })),
    createOscillator: vi.fn(() => ({
      type: 'sine',
      frequency: audioParameter(),
      connect: vi.fn(),
      start: vi.fn(),
      stop: vi.fn(),
    })),
    resume: vi.fn(async () => {}),
    close: vi.fn(async () => {}),
  };
  const constructor = vi.fn(function () {
    return context;
  });
  vi.stubGlobal('window', { AudioContext: constructor });
  return { context, constructor };
}

describe('presentation audio lifecycle', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('plays allowed autoplay and shares one context/scheduler across repeated unlocks', async () => {
    const { context, constructor } = mockAudio();
    const audio = new GameAudio();
    const changed = vi.fn();
    audio.subscribe(changed);
    expect(await audio.unlock()).toBe(true);
    const firstNoteCount = context.createOscillator.mock.calls.length;
    expect(firstNoteCount).toBeGreaterThan(0);
    expect(audio.playbackState).toBe('playing');
    expect(changed).toHaveBeenLastCalledWith('playing');
    await Promise.all([audio.unlock(), audio.unlock(), audio.unlock()]);
    expect(constructor).toHaveBeenCalledTimes(1);
    expect(vi.getTimerCount()).toBe(1);
    expect(context.createOscillator).toHaveBeenCalledTimes(firstNoteCount);
    audio.destroy();
    expect(vi.getTimerCount()).toBe(0);
    expect(context.close).toHaveBeenCalledTimes(1);
  });

  it('does not create an audio context for a saved mute preference', async () => {
    const { constructor } = mockAudio();
    const audio = new GameAudio();
    audio.setEnabled(false);
    expect(await audio.unlock()).toBe(false);
    expect(audio.playbackState).toBe('muted');
    expect(constructor).not.toHaveBeenCalled();
    expect(vi.getTimerCount()).toBe(0);
  });

  it('reports blocked autoplay honestly and retries from a subsequent gesture', async () => {
    const { context } = mockAudio('suspended');
    context.resume.mockRejectedValueOnce(new Error('User gesture required'));
    const audio = new GameAudio();
    expect(await audio.unlock()).toBe(false);
    expect(audio.playbackState).toBe('waiting');
    expect(vi.getTimerCount()).toBe(0);
    context.resume.mockImplementation(async () => {
      context.state = 'running';
      context.onstatechange?.();
    });
    expect(await audio.unlock()).toBe(true);
    expect(audio.playbackState).toBe('playing');
    expect(vi.getTimerCount()).toBe(1);
    audio.setEnabled(false);
    expect(audio.playbackState).toBe('muted');
    expect(vi.getTimerCount()).toBe(0);
    audio.setEnabled(true);
    expect(audio.playbackState).toBe('playing');
    expect(vi.getTimerCount()).toBe(1);
  });

  it('allows a new gesture to resume while an autoplay request is still pending', async () => {
    const { context } = mockAudio('suspended');
    let finishAutoplay!: () => void;
    context.resume.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) => {
          finishAutoplay = resolve;
        }),
    );
    const audio = new GameAudio();
    const autoplay = audio.unlock();
    expect(audio.playbackState).toBe('waiting');
    context.resume.mockImplementation(async () => {
      context.state = 'running';
    });
    expect(await audio.unlock()).toBe(true);
    finishAutoplay();
    expect(await autoplay).toBe(true);
    expect(vi.getTimerCount()).toBe(1);
  });

  for (const action of ['destroy', 'mute'] as const) {
    it(`does not restart after ${action} during a pending resume`, async () => {
      const { context } = mockAudio('suspended');
      let resolveResume!: () => void;
      context.resume.mockImplementation(
        () =>
          new Promise<void>((resolve) => {
            resolveResume = resolve;
          }),
      );
      const audio = new GameAudio();
      const pending = audio.unlock();
      if (action === 'destroy') audio.destroy();
      else audio.setEnabled(false);
      context.state = 'running';
      context.onstatechange?.();
      resolveResume();
      expect(await pending).toBe(false);
      expect(vi.getTimerCount()).toBe(0);
      expect(context.createOscillator).not.toHaveBeenCalled();
    });
  }

  it('handles missing or failed Web Audio without throwing', async () => {
    vi.stubGlobal('window', {});
    const missing = new GameAudio();
    expect(await missing.unlock()).toBe(false);
    expect(missing.playbackState).toBe('unavailable');
    vi.stubGlobal('window', {
      AudioContext: function () {
        throw new Error('No device');
      },
    });
    const failed = new GameAudio();
    expect(await failed.unlock()).toBe(false);
    expect(failed.playbackState).toBe('unavailable');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('tracks external context suspension and resumes only one music loop', async () => {
    const { context } = mockAudio();
    const audio = new GameAudio();
    await audio.unlock();
    context.state = 'suspended';
    context.onstatechange?.();
    expect(audio.playbackState).toBe('waiting');
    expect(vi.getTimerCount()).toBe(0);
    context.state = 'running';
    context.onstatechange?.();
    context.onstatechange?.();
    expect(audio.playbackState).toBe('playing');
    expect(vi.getTimerCount()).toBe(1);
  });
});
