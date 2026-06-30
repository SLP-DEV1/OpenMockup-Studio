import { forwardRef } from "react";

export const PhotopeaFrame = forwardRef<HTMLIFrameElement>(function PhotopeaFrame(_, ref) {
  return (
    <div className="photopea-shell">
      <iframe ref={ref} title="Photopea Renderer" />
    </div>
  );
});
