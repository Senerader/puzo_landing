// Apply saved appearance before the first paint, including with restricted storage.
try {
  const theme = localStorage.getItem("puzo-theme");
  if (theme === "light" || theme === "dark")
    document.documentElement.dataset.theme = theme;
} catch {
  /* The default theme also works without browser storage. */
}
