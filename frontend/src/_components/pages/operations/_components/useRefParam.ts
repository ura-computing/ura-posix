import { useSearchParams } from "react-router-dom";

/** « Voir détail » from a product's « Traçabilité »: `?ref=` = every line of that one BL / ticket, until its chip is
 *  removed (`clearRef`, back to page 1). */
export function useRefParam(setPage: (page: number) => void) {
  const [params, setParams] = useSearchParams();
  const ref = params.get("ref") ?? "";
  const clearRef = () => {
    setPage(1);
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("ref");
        return next;
      },
      { replace: true },
    );
  };
  return {
    ref,
    clearRef,
  };
}
