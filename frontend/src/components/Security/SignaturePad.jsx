import { useRef, useState } from 'react';
import { Button } from '../Forms/FormElements';

export default function SignaturePad({ onSave, label = 'Sign here' }) {
  const canvasRef = useRef(null);
  const [drawing, setDrawing] = useState(false);

  const getCtx = () => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const ctx = canvas.getContext('2d');
    ctx.strokeStyle = '#1e40af';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    return ctx;
  };

  const start = (e) => {
    setDrawing(true);
    const ctx = getCtx();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e) => {
    if (!drawing) return;
    e.preventDefault();
    const ctx = getCtx();
    const rect = canvasRef.current.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0]?.clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0]?.clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const end = () => setDrawing(false);

  const clear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const save = () => {
    const data = canvasRef.current.toDataURL('image/png');
    onSave?.(data);
  };

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{label}</p>
      <canvas
        ref={canvasRef}
        width={400}
        height={120}
        className="w-full cursor-crosshair rounded-lg border border-gray-300 bg-white dark:border-gray-600 dark:bg-gray-800"
        onMouseDown={start}
        onMouseMove={draw}
        onMouseUp={end}
        onMouseLeave={end}
        onTouchStart={start}
        onTouchMove={draw}
        onTouchEnd={end}
      />
      <div className="flex gap-2">
        <Button type="button" size="sm" variant="secondary" onClick={clear}>Clear</Button>
        <Button type="button" size="sm" onClick={save}>Save Signature</Button>
      </div>
    </div>
  );
}
