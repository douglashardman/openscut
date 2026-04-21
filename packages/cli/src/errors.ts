/**
 * SPEC §10.3 exit codes.
 */
export const EXIT = {
  SUCCESS: 0,
  GENERIC: 1,
  CONFIG: 2,
  NETWORK: 3,
  CRYPTO: 4,
  UNRESOLVABLE: 5,
} as const;

export type ExitCode = (typeof EXIT)[keyof typeof EXIT];

export class ScutCliError extends Error {
  constructor(
    message: string,
    public readonly exitCode: ExitCode = EXIT.GENERIC,
  ) {
    super(message);
    this.name = 'ScutCliError';
  }
}

export function fail(message: string, code: ExitCode = EXIT.GENERIC): never {
  throw new ScutCliError(message, code);
}
