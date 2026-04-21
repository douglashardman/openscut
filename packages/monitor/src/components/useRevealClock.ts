import { useEffect, useRef, useState } from 'react';
import { PHASES, PHASE_ORDER, type Phase } from '../phases.js';

export interface RevealClockState {
  phase: Phase;
  progress: number;
}

/**
 * Drives the RevealBox through the phase sequence when `isActive` is
 * true, calls `onDone` once the full cycle completes, and stays idle
 * otherwise. Runs at ~30fps via setInterval; ink re-renders on state
 * change.
 */
export function useRevealClock(isActive: boolean, onDone: () => void): RevealClockState {
  const [phase, setPhase] = useState<Phase>('approach');
  const [tick, setTick] = useState(0);
  const phaseStartedAtRef = useRef<number>(Date.now());
  const doneRef = useRef(onDone);

  useEffect(() => {
    doneRef.current = onDone;
  }, [onDone]);

  useEffect(() => {
    if (!isActive) return;
    setPhase('approach');
    phaseStartedAtRef.current = Date.now();
    setTick((t) => t + 1);
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    const id = setInterval(() => setTick((t) => t + 1), 33);
    return () => clearInterval(id);
  }, [isActive]);

  const duration = PHASES[phase];
  const elapsed = Date.now() - phaseStartedAtRef.current;
  const progress = Math.min(1, elapsed / duration);

  useEffect(() => {
    if (!isActive) return;
    if (progress < 1) return;
    const idx = PHASE_ORDER.indexOf(phase);
    const nextIdx = idx + 1;
    if (nextIdx >= PHASE_ORDER.length) {
      doneRef.current();
      return;
    }
    const next = PHASE_ORDER[nextIdx]!;
    phaseStartedAtRef.current = Date.now();
    setPhase(next);
  }, [tick, progress, phase, isActive]);

  return { phase, progress };
}
