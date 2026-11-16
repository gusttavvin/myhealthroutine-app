"use client";

import jsQR from "jsqr";
import { Camera, CameraOff, Keyboard, RotateCcw } from "lucide-react";
import { useEffect, useRef, useState } from "react";

type Failure = "blocked" | "none" | "busy" | "unsupported" | "other";

const FAILURE_TEXT: Record<Failure, { title: string; text: string; retry: boolean }> = {
  blocked: {
    title: "A câmera está bloqueada para este site",
    text: "Para liberar: clique no cadeado (ou no ícone de ajustes) à esquerda do endereço do site, escolha Câmera → Permitir e toque em “Abrir a câmera de novo”.",
    retry: true,
  },
  none: {
    title: "Não encontrei nenhuma câmera",
    text: "Este aparelho não tem câmera ou ela está desligada. Digite o código impresso embaixo do QR da etiqueta.",
    retry: true,
  },
  busy: {
    title: "A câmera está sendo usada por outro programa",
    text: "Feche o programa que está usando a câmera (como Teams, Zoom ou Meet) e toque em “Abrir a câmera de novo”.",
    retry: true,
  },
  unsupported: {
    title: "Este navegador não permite usar a câmera",
    text: "Abra o site no Google Chrome, no Edge ou no Safari, ou digite o código impresso na etiqueta.",
    retry: false,
  },
  other: {
    title: "Não consegui abrir a câmera",
    text: "Toque em “Abrir a câmera de novo” ou digite o código impresso na etiqueta.",
    retry: true,
  },
};

function classify(err: unknown): Failure {
  const name = (err as { name?: string })?.name ?? "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") return "blocked";
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || name === "OverconstrainedError") return "none";
  if (name === "NotReadableError" || name === "TrackStartError" || name === "AbortError") return "busy";
  return "other";
}

/**
 * Câmera de verdade: lê o QR da etiqueta sozinha, sem precisar apertar nada.
 * Funciona com a câmera traseira do celular ou com a webcam do computador.
 * Se a câmera não abrir, explica o motivo e permite digitar o código impresso embaixo do QR.
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
  const [failure, setFailure] = useState<Failure>("other");
  const [attempt, setAttempt] = useState(0);
  const [manual, setManual] = useState(false);
  const [typed, setTyped] = useState("");
  const pausedRef = useRef(paused);
  const last = useRef<{ code: string; at: number } | null>(null);
  pausedRef.current = paused;
  const onCodeRef = useRef(onCode);
  onCodeRef.current = onCode;

  useEffect(() => {
    let stream: MediaStream | null = null;
    let timer = 0;
    let stopped = false;
    setState("starting");

    async function open() {
      if (!navigator.mediaDevices?.getUserMedia) throw Object.assign(new Error("sem suporte"), { name: "Unsupported" });
      try {
        // Celular: câmera traseira. Computador: a webcam que existir.
        return await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
      } catch (err) {
        if (classify(err) === "none") return await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        throw err;
      }
    }

    async function start() {
      try {
        stream = await open();
        if (stopped) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        const v = video.current!;
        v.srcObject = stream;
        await v.play();
        setState("on");
        loop();
      } catch (err) {
        if (stopped) return;
        setFailure((err as { name?: string })?.name === "Unsupported" ? "unsupported" : classify(err));
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
      timer = window.setTimeout(loop, 180);
    }

    start();
    return () => {
      stopped = true;
      clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [attempt]);

  const fail = FAILURE_TEXT[failure];

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
              <br />
              <small>Se o navegador perguntar, escolha “Permitir”.</small>
            </p>
          ) : state === "failed" ? (
            <div className="camera-hint camera-fail" role="alert">
              <CameraOff size={30} />
              <strong>{fail.title}</strong>
              <span>{fail.text}</span>
            </div>
          ) : (
            hint
          )}
        </div>
      </div>
      {state === "failed" && fail.retry ? (
        <button type="button" className="btn ghost wide" onClick={() => setAttempt((n) => n + 1)}>
          <RotateCcw size={16} /> Abrir a câmera de novo
        </button>
      ) : null}
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
