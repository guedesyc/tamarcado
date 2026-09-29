/** The deposit is one of the receipts against the agreed service total, never an added fee. */
export function calculateServiceBalance(totalCents: number, receiptsCents: number) {
  const total = Math.max(0, Math.trunc(totalCents));
  const received = Math.max(0, Math.trunc(receiptsCents));
  return { totalCents: total, receivedCents: received, balanceCents: Math.max(0, total - received) };
}
