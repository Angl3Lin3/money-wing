import { useCallback, useEffect, useState } from "react";

// A countdown for "Send a new code" buttons. The server allows one code
// every 30 seconds; this shows the wait on the button instead of letting people tap
// and get nothing.
//   const [secondsLeft, startCooldown] = useCooldown(30);
export function useCooldown(initialSeconds = 0) {
  const [until, setUntil] = useState(() => Date.now() + initialSeconds * 1000);
  const [now, setNow] = useState(() => Date.now());
  const secondsLeft = Math.max(0, Math.ceil((until - now) / 1000));

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [secondsLeft > 0]); // eslint-disable-line react-hooks/exhaustive-deps

  const start = useCallback((seconds: number) => {
    setNow(Date.now());
    setUntil(Date.now() + seconds * 1000);
  }, []);

  return [secondsLeft, start] as const;
}
