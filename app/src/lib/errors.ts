/** Turn an Anchor/wallet/RPC error into a short human string for a toast. */
export function prettifyError(e: unknown): string {
  if (!e) return "Unknown error";
  const err = e as {
    message?: string;
    logs?: string[];
    error?: { errorMessage?: string; errorCode?: { code?: string } };
  };

  // Anchor decoded program error (best case).
  const anchorMsg = err.error?.errorMessage;
  if (anchorMsg) return anchorMsg;

  const message = err.message ?? String(e);
  if (/User rejected|rejected the request|Approval Denied/i.test(message)) {
    return "Transaction rejected in wallet";
  }

  // Simulation logs sometimes carry the human error message.
  const anchorLog = err.logs?.find((l) => l.includes("Error Message:"));
  if (anchorLog) return anchorLog.split("Error Message:")[1].trim();

  return message.length > 160 ? `${message.slice(0, 160)}…` : message;
}
