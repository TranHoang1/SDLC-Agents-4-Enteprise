/**
 * SA4E-6 — Assemble an ExecutionResult from an OutputBuffer pair.
 * Shared by LocalExecutor and DockerExecutor so output/truncation/binary handling
 * is identical across strategies.
 */

import { OutputBuffer, detectBinary } from '../parsers/OutputBuffer.js';
import type { ExecutionResult } from '../models.js';

export function buildExecutionResult(
  exitCode: number,
  stdoutBuf: OutputBuffer,
  stderrBuf: OutputBuffer,
  sessionId: string,
  duration: number,
  timedOut: boolean,
): ExecutionResult {
  const stdout = stdoutBuf.value;
  const stderr = stderrBuf.value;
  const binary = detectBinary(stdout) || detectBinary(stderr);
  return {
    exitCode: timedOut ? -1 : exitCode,
    stdout: binary ? `[binary output, ${Buffer.byteLength(stdout, 'utf-8')} bytes]` : stdout,
    stderr: binary ? `[binary output, ${Buffer.byteLength(stderr, 'utf-8')} bytes]` : stderr,
    duration,
    truncated: stdoutBuf.truncated || stderrBuf.truncated,
    sessionId,
    timedOut,
    binary,
  };
}
