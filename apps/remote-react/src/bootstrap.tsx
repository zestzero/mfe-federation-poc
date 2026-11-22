// Standalone dev only (the shell never loads bootstrap): tokens + preflight the shell would provide.
import "@poc/design-system/standalone.css";
import { createRoot } from "react-dom/client";

const element = document.getElementById("root");
if (element) {
  createRoot(element).render(<main><h1>Fictional React Orders Remote</h1><p>Mount this remote through its federated export.</p></main>);
}
