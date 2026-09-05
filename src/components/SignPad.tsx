import { useRef } from "react";

type SignPadProps = {
  onSignedChange: (signed: boolean) => void;
  onClear?: () => void;
};

export function SignPad({ onSignedChange, onClear }: SignPadProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  function paint(e: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    ctx.strokeStyle = "#39ff14";
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY);
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    onSignedChange(false);
    onClear?.();
  }

  return (
    <div className="w-full min-w-0">
      <p className="text-sm font-medium">Zet je handtekening</p>
      <p className="mt-1 text-xs leading-5 text-mute">
        Teken met je vinger of muis.
      </p>
      <canvas
        ref={canvasRef}
        width={360}
        height={160}
        role="img"
        aria-label="Handtekening"
        className="mt-3 w-full max-w-full min-w-0 touch-none rounded-2xl border border-line bg-panel"
        onPointerDown={(e) => {
          drawing.current = true;
          canvasRef.current?.getContext("2d")?.beginPath();
          paint(e);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          paint(e);
          onSignedChange(true);
        }}
        onPointerUp={() => {
          drawing.current = false;
        }}
        onPointerLeave={() => {
          drawing.current = false;
        }}
      />
      <button
        type="button"
        onClick={clear}
        className="mt-2 text-xs text-mute"
      >
        Wis handtekening
      </button>
    </div>
  );
}