// Mirrors the codebase's long-standing `err?.message ?? err` pattern for
// turning a caught `unknown` into something safe to put in a JSON response,
// without needing an `any`-typed catch binding.
export function getErrorMessage(error: unknown): unknown {
  if (error && typeof error === "object" && "message" in error) {
    return (error as { message: unknown }).message;
  }
  return error;
}

// MongoDB duplicate-key error (E11000) — used across the reaction-toggle
// repositories' insert-after-failed-delete retry loop.
export function isDuplicateKeyError(error: unknown): boolean {
  return (
    !!error &&
    typeof error === "object" &&
    "code" in error &&
    (error as { code: unknown }).code === 11000
  );
}
