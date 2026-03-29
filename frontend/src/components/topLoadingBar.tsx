import { useIsFetching } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

export function TopLoadingBar() {
  const isFetching = useIsFetching();
  const loading = isFetching > 0;

  const [visible, setVisible] = useState(false);
  const [width, setWidth] = useState(0);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    timers.current.forEach(clearTimeout);
    timers.current = [];

    if (loading) {
      setVisible(true);
      setWidth(15);
      timers.current.push(setTimeout(() => setWidth(50), 200));
      timers.current.push(setTimeout(() => setWidth(80), 1000));
    } else {
      setWidth(100);
      timers.current.push(
        setTimeout(() => {
          setVisible(false);
          setWidth(0);
        }, 350)
      );
    }

    return () => timers.current.forEach(clearTimeout);
  }, [loading]);

  if (!visible) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] h-[3px] pointer-events-none">
      <div
        className="h-full bg-primary rounded-r-sm"
        style={{
          width: `${width}%`,
          transition: loading ? "width 0.9s ease-out" : "width 0.3s ease-out",
        }}
      />
    </div>
  );
}
