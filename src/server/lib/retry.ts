import pRetry from "p-retry";

export async function retryWithBackoff<T>(fn: () => Promise<T>) {
  return pRetry(fn, {
    retries: 3,
    factor: 2,
    minTimeout: 500,
    maxTimeout: 4000,
  });
}
