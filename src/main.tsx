import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles.css";

const isStaticDemo = import.meta.env.MODE === "demo";

if (isStaticDemo) {
  document.title = "OpenMockup Studio Demo · Free Batch Mockup Generator";
}

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <>
    {isStaticDemo ? (
      <div
        role="status"
        style={{
          padding: "10px 16px",
          textAlign: "center",
          background: "#111827",
          color: "#ffffff",
          fontSize: "14px",
          fontWeight: 600,
          lineHeight: 1.45,
        }}
      >
        Browser demo: PNG, JPG and WebP mockups run locally in this tab. PSD Smart Objects require the local app.{" "}
        <a
          href="https://github.com/SLP-DEV1/OpenMockup-Studio#quick-start"
          style={{ color: "#93c5fd", textDecoration: "underline" }}
        >
          Run the full version
        </a>
      </div>
    ) : null}
    <App />
  </>,
);
