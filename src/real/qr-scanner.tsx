"use client";

import jsQR from "jsqr";
import { Camera, CameraOff, Keyboard } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * Câmera de verdade: lê o QR da etiqueta sozinha, sem precisar apertar nada.
 * Se a câmera não abrir, dá para digitar o código impresso embaixo do QR.
 */
export function QrScanner({
  onCode,
  paused,
  big = false,
  hint,
}: {
  onCode: (code: string) => void;
  paused?: boolean;
  big?: boolean;
  hint?: React.ReactNode;
}) {
  const video = useRef<HTMLVideoElement | null>(null);
  const canvas = useRef<HTMLCanvasElement | null>(null);
  const [state, setState] = useState<"starting" | "on" | "failed">("starting");
  const [manual, setManual] = useState(false);
  const [typed, setTyped] = useState("");
  const pausedRef = useRef(paused);
  const last = useRef<{ code: string; at: number } | null>(null);
  pausedRef.current = paused;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;

    async function start() {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (stopped) return;
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        setState("on");
        loop();
      } catch {
        setState("failed");
        setManual(true);
      }
    }

    function loop() {
      if (stopped) return;
      const v = video.current;
      const c = canvas.current;
      if (v && c && v.readyState >= 2 && !pausedRef.current) {
        const w = 480;
        const h = Math.round((v.videoHeight / v.videoWidth) * w) || 360;
        c.width = w;
        c.height = h;
        const ctx = c.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          ctx.drawImage(v, 0, 0, w, h);
          const img = ctx.getImageData(0, 0, w, h);
          const found = jsQR(img.data, w, h, { inversionAttempts: "attemptBoth" });
          if (found?.data) {
            const now = Date.now();
            // evita ler a mesma etiqueta várias vezes seguidas
            if (!last.current || last.current.code !== found.data || now - last.current.at > 4000) {
              last.current = { code: found.data, at: now };
              onCodeRef.current(found.data);
            }
          }
        }
      }
      raf = window.setTimeout(loop, 180) as unknown as number;
    }

    start();
    return () => {
      stopped = true;
      clearTimeout(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, []);

  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  return (
    <div className={`qr ${big ? "big" : ""}`}>
      <div className="viewfinder real">
        <video ref={video} playsInline muted className={state === "on" ? "on" : ""} />
        <span className="corner tl" />
        <span className="corner tr" />
        <span className="corner bl" />
        <span className="corner br" />
        {state === "on" && !paused ? <span className="scanline" /> : null}
        <div className="viewfinder-content">
          {/* Lendo ou com erro: a mensagem da leitura tem prioridade, mesmo sem câmera. */}
          {paused ? (
            hint
          ) : state === "starting" ? (
            <p className="camera-hint">
              <Camera size={30} /> Abrindo a câmera…
            </p>
          ) : state === "failed" ? (
            <p className="camera-hint">
              <CameraOff size={30} /> Não consegui abrir a câmera.
              <br />
              Permita o uso da câmera ou digite o código da etiqueta.
            </p>
          ) : (
            hint
          )}
        </div>
      </div>
      <canvas ref={canvas} hidden />
      {manual ? (
        <form
          className="manual-code"
          onSubmit={(e) => {
            e.preventDefault();
            if (typed.trim()) onCode(typed.trim());
          }}
        >
          <label>
            <span>Código impresso na etiqueta</span>
            <input value={typed} onChange={(e) => setTyped(e.target.value.toUpperCase())} placeholder="Ex.: K7Q2M9XA" autoCapitalize="characters" />
          </label>
          <button type="submit" className="btn primary">
            Ler código
          </button>
        </form>
      ) : (
        <button type="button" className="manual-toggle" onClick={() => setManual(true)}>
          <Keyboard size={16} /> Digitar o código da etiqueta
        </button>
      )}
    </div>
  );
}
