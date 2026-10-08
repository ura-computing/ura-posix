/** Prints the page in the light theme (paper is white): dark mode is off while the print window
 *  is open (`window.print` waits until it closes), then back. */
export function printLight(): void {
  const root = document.documentElement;
  const dark = root.classList.contains("dark");
  root.classList.remove("dark");
  try {
    window.print();
  } finally {
    if (dark) root.classList.add("dark");
  }
}
