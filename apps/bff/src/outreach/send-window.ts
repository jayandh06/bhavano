/** Promotional SMS may only be delivered between 09:00 and 21:00 India time (TRAI's
 * telemarketing rules, enforced on the DLT platform). Outside it the operator fails the message
 * with "Invalid SMS Timing on DLT" — the first real send of the agent-invite campaign went out at
 * 07:09 IST and all 32 messages failed that way, while Bhavano had already recorded them as sent.
 * So the runner refuses to start a real SMS run outside the window rather than burn the audience's
 * send slot on messages that cannot be delivered. */
export const SEND_WINDOW_START_HOUR_IST = 9;
export const SEND_WINDOW_END_HOUR_IST = 21;

function hourInIndia(at: Date): number {
  const hour = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Kolkata',
    hour: 'numeric',
    hour12: false,
  }).format(at);
  // "24" is how some runtimes print midnight with hour12:false.
  return Number(hour) % 24;
}

/** True from 09:00:00 up to, but not including, 21:00:00 IST. */
export function isWithinPromotionalSendWindow(at: Date = new Date()): boolean {
  const hour = hourInIndia(at);
  return hour >= SEND_WINDOW_START_HOUR_IST && hour < SEND_WINDOW_END_HOUR_IST;
}

export const SEND_WINDOW_MESSAGE =
  'Promotional SMS can only be sent between 9:00 AM and 9:00 PM IST. Try again inside that window.';
