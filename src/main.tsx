import ReactDOM from "react-dom/client";
import App from "./App";
import { DemoBanner } from "./components/DemoBanner";
import "./styles.css";
import "./coverClip.css";

const isStaticDemo = import.meta.env.MODE === "demo";

if (isStaticDemo) {
  document.title = "OpenMockup Studio Demo · Free Batch Mockup Generator";
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <>
    {isStaticDemo ? <DemoBanner /> : null}
    <App />
  </>,
);
