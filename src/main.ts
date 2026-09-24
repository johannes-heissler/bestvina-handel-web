// Entry point of the browser app. The UI is added in phase 7 (see docs/port-notes/README.md);
// until then the page only confirms that the build works.
const app = document.querySelector<HTMLElement>("#app");
if (app) app.textContent = "Bestvina–Handel web port — under construction.";
