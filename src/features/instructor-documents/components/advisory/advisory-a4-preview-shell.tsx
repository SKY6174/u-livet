import React from "react";
import {
  ADVISORY_A4_HEIGHT_PX,
  getAdvisoryA4PreviewScale
} from "../../features/committee/utils/advisory-a4-preview";

interface AdvisoryA4PreviewShellProps {
  children: React.ReactNode;
  hostRef: React.RefObject<HTMLDivElement | null>;
}

export function AdvisoryA4PreviewShell({ children, hostRef }: AdvisoryA4PreviewShellProps) {
  const canvasRef = React.useRef<HTMLDivElement>(null);
  const [layout, setLayout] = React.useState({ scale: 1, height: ADVISORY_A4_HEIGHT_PX });

  React.useLayoutEffect(() => {
    const shell = hostRef.current;
    const canvas = canvasRef.current;
    if (!shell || !canvas) return;

    const updateLayout = () => {
      const styles = window.getComputedStyle(shell);
      const horizontalPadding = Number.parseFloat(styles.paddingLeft) + Number.parseFloat(styles.paddingRight);
      const scale = getAdvisoryA4PreviewScale(shell.clientWidth, horizontalPadding);
      const sourceHeight = Math.max(ADVISORY_A4_HEIGHT_PX, canvas.scrollHeight);
      const nextLayout = { scale, height: sourceHeight * scale };
      setLayout(current => current.scale === nextLayout.scale && current.height === nextLayout.height
        ? current
        : nextLayout);
    };

    const frameId = window.requestAnimationFrame(updateLayout);
    const observer = new ResizeObserver(updateLayout);
    observer.observe(shell);
    observer.observe(canvas);
    return () => {
      window.cancelAnimationFrame(frameId);
      observer.disconnect();
    };
  }, [hostRef]);

  return (
    <div ref={hostRef} className="advisory-opinion-preview-shell advisory-a4-preview-shell">
      <div className="advisory-a4-preview-stage" style={{ height: `${layout.height}px` }}>
        <div
          ref={canvasRef}
          className="advisory-a4-preview-canvas"
          style={{ transform: `scale(${layout.scale})` }}
        >
          {children}
        </div>
      </div>
    </div>
  );
}
