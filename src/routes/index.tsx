import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Boxes,
  Check,
  ChevronRight,
  HandCoins,
  Languages,
  Mic,
  NotebookText,
  RotateCcw,
  Send,
  ShieldCheck,
  ShoppingCart,
  Sparkles,
  Square,
  Upload,
  Volume2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { parseCommand, type Action } from "@/lib/parser";
import {
  addLog,
  describe as describeAction,
  execute,
  load,
  needsConfirm,
  sampleState,
  save,
  todaySales,
  type State,
} from "@/lib/store";
import { useShopAuth } from "@/components/auth-provider";
import { gnaniStatus, speak, transcribe } from "@/lib/gnani.functions";
import { ShopProfile } from "@/components/shop-profile";
import { useServerFn } from "@tanstack/react-start";
import { getShopData, writeShopData } from "@/lib/shop.functions";
import { pricedAction, validateAction } from "@/lib/shop";
import { BackgroundGrid, Spotlight, SpotlightCard } from "@/components/aceternity/spotlight";
import { GradientFrame } from "@/components/aceternity/gradient-frame";
import { WordRotate } from "@/components/aceternity/word-rotate";
import { CountUp } from "@/components/aceternity/count-up";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "DukaanSaathi AI — Bolkar dukaan chalaiye" },
      {
        name: "description",
        content: "Hindi/Hinglish voice assistant for kirana stock, sales and udhaar.",
      },
      { property: "og:title", content: "DukaanSaathi AI" },
      { property: "og:description", content: "Bolkar stock, bikri aur udhaar likhiye." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Dashboard,
});

const LANGS = [
  { code: "hi-IN", label: "हिंदी" },
  { code: "hi-en", label: "Hinglish" },
  { code: "en-IN", label: "English (India)" },
];

const STEPS = [
  {
    icon: Mic,
    title: "Boliye ya likhiye",
    body: "“10 kilo chawal aaya” bas bol dijiye — mic dabakar ya type karke.",
  },
  {
    icon: Languages,
    title: "Hum samajhte hain",
    body: "Command Hindi/Hinglish samajh kar product, quantity aur action mein badalta hai.",
  },
  {
    icon: ShieldCheck,
    title: "Aap pakka kariye",
    body: "Likhe se pehle “Haan / Nahi” — galti se galat entry nahi hogi.",
  },
  {
    icon: NotebookText,
    title: "Sab likh diya",
    body: "Stock, bikri ya udhaar turant update — “aaj ka hisaab” boliye to bataiye bhi.",
  },
];

type Pending = {
  id: string;
  transcript: string;
  source: string;
  action: Action;
  expectedPrice?: number;
} | null;

function Dashboard() {
  const { user, loading: authLoading, accountAvailable, signOut: clerkSignOut } = useShopAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const write = useServerFn(writeShopData);
  const [demoState, setDemoState] = useState<State | null>(null);
  const [profileOpen, setProfileOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testingTts, setTestingTts] = useState(false);
  const [ttsVerified, setTtsVerified] = useState(false);
  const savingRef = useRef(false);
  const shop = useQuery({
    queryKey: ["shop", user?.id],
    queryFn: () => getShopData(),
    enabled: !!user && !authLoading,
  });
  const voice = useQuery({ queryKey: ["gnani-status"], queryFn: gnaniStatus, staleTime: Infinity });
  const speechUnavailable = voice.data?.stt === false;
  const state = user ? (shop.data ?? null) : demoState;
  const [lang, setLang] = useState("hi-IN");

  const [recording, setRecording] = useState(false);
  const [busy, setBusy] = useState(false);
  const [typed, setTyped] = useState("");
  const [pending, setPending] = useState<Pending>(null);
  const [last, setLast] = useState<{
    transcript: string;
    source: string;
    action: Action;
    status: string;
    result: string;
  } | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const chunks = useRef<Blob[]>([]);
  useEffect(() => {
    setDemoState(load());
  }, []);
  useEffect(() => {
    setPending(null);
    setLast(null);
    setProfileOpen(false);
  }, [user?.id]);
  const commit = (s: State) => {
    setDemoState(s);
    save(s);
  };
  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    if (!clerkSignOut) throw new Error("Sign in is unavailable in demo mode.");
    await clerkSignOut();
    await navigate({ to: "/", replace: true });
  }
  async function logOnly(
    text: string,
    source: string,
    action: Action,
    status: string,
    result: string,
  ) {
    if (!state) return;
    if (!user) {
      commit(addLog(state, { transcript: text, source, action: action.action, status, result }));
      return;
    }
    await write({
      data: { id: crypto.randomUUID(), transcript: text, source, action, status, note: result },
    });
    await queryClient.invalidateQueries({ queryKey: ["shop", user.id] });
  }

  function fallbackSpeech(text: string) {
    if ("speechSynthesis" in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === "hi-en" ? "hi-IN" : lang;
      speechSynthesis.speak(u);
    }
  }

  async function testGnaniTts() {
    setTestingTts(true);
    try {
      const result = await speak({
        data: {
          text: "Namaste! DukaanSaathi AI ki awaaz ka test safal raha.",
          language: lang,
        },
      });
      if (!result.ok) throw new Error(result.error);
      await new Audio(`data:${result.mime};base64,${result.audioBase64}`).play();
      setTtsVerified(true);
      toast.success(`Gnani TTS chal raha hai (HTTP ${result.httpStatus}, ${result.bytes} bytes).`);
    } catch (error) {
      setTtsVerified(false);
      toast.error(error instanceof Error ? error.message : "Gnani TTS test fail hua.");
    } finally {
      setTestingTts(false);
    }
  }

  async function sayResult(text: string) {
    if (voice.data?.tts) {
      try {
        const res = await speak({ data: { text: text.slice(0, 1000), language: lang } });
        if (res.ok) {
          try {
            await new Audio(`data:${res.mime};base64,${res.audioBase64}`).play();
          } catch {
            toast.warning("Gnani audio play nahi hua; browser voice use ho rahi hai.");
            fallbackSpeech(text);
          }
          return;
        }
        toast.warning(`${res.error} Browser voice use ho rahi hai.`);
      } catch {
        toast.warning("Gnani TTS tak pahunch nahi paaye. Browser voice use ho rahi hai.");
      }
    }
    fallbackSpeech(text);
  }

  async function handleTranscript(text: string, source: string) {
    if (!state || !text.trim() || savingRef.current || pending) return;
    let action = parseCommand(text);
    const invalid = validateAction(state, action);
    if (action.action === "unknown" || action.missing.length || invalid) {
      const result =
        invalid ??
        (action.action === "unknown"
          ? "Samajh nahi aaya. Jaise boliye: '10 kilo chawal aaya'."
          : `Kuch jaankari chhoot gayi: ${action.missing.join(", ")}. Dobara boliye.`);
      setLast({ transcript: text, source, action, status: "needs_info", result });
      try {
        await logOnly(text, source, action, "needs_info", result);
      } catch {
        toast.error("Activity save nahi hui.");
      }
      void sayResult(result);
      return;
    }
    if (needsConfirm(action)) {
      const product = state.products.find((p) => p.key === action.product);
      action = pricedAction(state, action);
      if (product && !action.unit) action = { ...action, unit: product.unit };
      setPending({
        id: crypto.randomUUID(),
        transcript: text,
        source,
        action,
        ...(product ? { expectedPrice: product.price } : {}),
      });
      setLast({
        transcript: text,
        source,
        action,
        status: "awaiting_confirmation",
        result: describeAction(action),
      });
      return;
    }
    await run(text, source, action);
  }

  async function run(transcript: string, source: string, action: Action, request?: Pending) {
    if (!state || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const status = needsConfirm(action) ? "confirmed" : "answered";
      let result: string;
      if (user) {
        const answer = needsConfirm(action) ? "" : execute(state, action).result;
        result = await write({
          data: {
            id: request?.id ?? crypto.randomUUID(),
            transcript,
            source,
            action,
            status,
            note: answer,
            ...(request?.expectedPrice !== undefined
              ? { expectedPrice: request.expectedPrice }
              : {}),
          },
        });
        await queryClient.invalidateQueries({ queryKey: ["shop", user.id] });
      } else {
        const output = execute(state, action);
        result = output.result;
        if (needsConfirm(action) && output.state === state) throw new Error(result);
        commit(addLog(output.state, { transcript, source, action: action.action, status, result }));
      }
      setLast({ transcript, source, action, status, result });
      setPending(null);
      toast.success(result);
      void sayResult(result);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Record save nahi hua.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function cancelPending() {
    if (!pending || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      await logOnly(pending.transcript, pending.source, pending.action, "cancelled", "Radd kiya");
      setLast({ ...pending, status: "cancelled", result: "Radd kiya" });
      setPending(null);
    } catch {
      toast.error("Radd karne ki activity save nahi hui.");
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  async function startRec() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      // Gnani REST STT accepts only flac/m4a/mp3/wav/aac/ogg — Chrome's default
      // MediaRecorder output (audio/webm) is rejected with 400. Prefer ogg/opus.
      const mime = [
        "audio/ogg;codecs=opus",
        "audio/ogg",
        "audio/mp4",
        "audio/webm;codecs=opus",
      ].find((m) => MediaRecorder.isTypeSupported(m));
      const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
      chunks.current = [];
      rec.ondataavailable = (e) => chunks.current.push(e.data);
      rec.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        void processAudio(new Blob(chunks.current, { type: rec.mimeType }), "Mic (Gnani)", true);
      };
      rec.start();
      recRef.current = rec;
      setRecording(true);
    } catch {
      toast.error("Mic ki permission nahi mili.");
    }
  }
  function stopRec() {
    recRef.current?.stop();
    setRecording(false);
  }

  async function toWav16k(blob: Blob): Promise<Blob> {
    // Gnani REST STT accepts only flac/m4a/mp3/wav/aac/ogg, but browsers record
    // webm (Chrome) or mp4 (Safari). Decode in the browser and re-encode to
    // 16 kHz mono PCM WAV, which Gnani always accepts.
    const buf = await blob.arrayBuffer();
    const Ctx =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctx || typeof OfflineAudioContext === "undefined") {
      throw new Error(
        "Is browser mein mic audio conversion supported nahi hai. Chrome/Edge ya WAV file upload try kijiye.",
      );
    }
    const ctx = new Ctx();
    try {
      let audio: AudioBuffer;
      try {
        audio = await ctx.decodeAudioData(buf);
      } catch {
        throw new Error(
          "Mic recording ko browser mein decode nahi kar paaye. Dobara record kijiye ya WAV file upload karein.",
        );
      }
      const len = Math.max(1, Math.ceil(audio.duration * 16000));
      const offline = new OfflineAudioContext(1, len, 16000);
      const src = offline.createBufferSource();
      src.buffer = audio;
      src.connect(offline.destination);
      src.start();
      const rendered = await offline.startRendering();
      const pcm = rendered.getChannelData(0);
      const wav = new DataView(new ArrayBuffer(44 + pcm.length * 2));
      const w = (o: number, s: string) => {
        for (let i = 0; i < s.length; i++) wav.setUint8(o + i, s.charCodeAt(i));
      };
      w(0, "RIFF");
      wav.setUint32(4, 36 + pcm.length * 2, true);
      w(8, "WAVE");
      w(12, "fmt ");
      wav.setUint32(16, 16, true);
      wav.setUint16(20, 1, true);
      wav.setUint16(22, 1, true);
      wav.setUint32(24, 16000, true);
      wav.setUint32(28, 32000, true);
      wav.setUint16(32, 2, true);
      wav.setUint16(34, 16, true);
      w(36, "data");
      wav.setUint32(40, pcm.length * 2, true);
      for (let i = 0; i < pcm.length; i++)
        wav.setInt16(44 + i * 2, Math.max(-1, Math.min(1, pcm[i] ?? 0)) * 32767, true);
      return new Blob([wav.buffer], { type: "audio/wav" });
    } finally {
      void ctx.close();
    }
  }

  async function processAudio(blob: Blob, source: string, convertMicToWav = false) {
    if (!blob.size) {
      toast.error("Awaaz record nahi hui. Dobara koshish kijiye.");
      return;
    }
    setBusy(true);
    try {
      const sttAudio = convertMicToWav ? await toWav16k(blob) : blob;
      const mime = sttAudio.type.toLowerCase().split(";").at(0) ?? "";
      const supportedFormats = new Set([
        "audio/wav",
        "audio/x-wav",
        "audio/wave",
        "audio/vnd.wave",
        "audio/flac",
        "audio/x-flac",
        "audio/mpeg",
        "audio/mp3",
        "audio/mp4",
        "audio/aac",
        "audio/ogg",
      ]);
      if (!supportedFormats.has(mime)) {
        throw new Error(
          "Yeh audio format Gnani support nahi karta. WAV, MP3, M4A, FLAC, AAC ya OGG file upload kijiye; mic recording apne-aap WAV mein badalti hai.",
        );
      }
      const audioBase64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result ?? "").split(",")[1] ?? "");
        reader.onerror = () => reject(new Error("Audio file padhi nahi ja saki."));
        reader.readAsDataURL(sttAudio);
      });
      const res = await transcribe({
        data: { audioBase64, mime, language: lang === "hi-en" ? "hi-IN" : lang },
      });
      if (!res.ok) {
        toast.warning(`${res.error} Command likhkar dijiye.`);
        return;
      }
      const text = res.text.trim();
      if (!text) {
        toast.warning("Awaaz saaf nahi aayi. Dobara boliye ya command likhiye.");
        return;
      }
      await handleTranscript(text, source);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Awaaz process nahi hui.");
    } finally {
      setBusy(false);
    }
  }

  if (authLoading || (user && shop.isPending))
    return <div className="p-8 text-center text-muted-foreground">Load ho raha hai…</div>;
  if (user && shop.isError)
    return (
      <main className="mx-auto max-w-5xl p-8">
        <h1 className="text-3xl font-bold text-primary">DukaanSaathi AI</h1>
        <p className="mt-4" role="alert">
          Private records load nahi hue.
        </p>
        <Button className="mt-4" onClick={() => shop.refetch()}>
          Dobara koshish
        </Button>
        <Button variant="outline" onClick={signOut}>
          Sign out
        </Button>
      </main>
    );
  if (!state) return <div className="p-8 text-center text-muted-foreground">Load ho raha hai…</div>;
  const { total, count } = todaySales(state);
  const low = state.products.filter((p) => p.qty <= p.low);
  const credits = Object.entries(
    state.credits.reduce<Record<string, number>>(
      (m, c) => ((m[c.customer] = (m[c.customer] ?? 0) + c.amount), m),
      {},
    ),
  );
  const demo = !user;

  return (
    <main className="relative min-h-screen overflow-x-clip pb-16">
      <BackgroundGrid />
      <Spotlight />

      <nav className="sticky top-0 z-40 border-b border-border/60 bg-background/70 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-3 px-4">
          <Link
            to="/"
            className="flex items-center gap-2 font-display text-lg font-bold tracking-tight"
          >
            <span className="inline-flex size-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-secondary text-primary-foreground shadow-lg">
              <Mic className="size-4" />
            </span>
            DukaanSaathi&nbsp;<span className="text-primary">AI</span>
          </Link>
          <div className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a className="transition-colors hover:text-foreground" href="#how">
              Kaise chalta hai
            </a>
            <a className="transition-colors hover:text-foreground" href="#stock">
              Hisaab
            </a>
            <Link className="transition-colors hover:text-foreground" to="/test">
              Test
            </Link>
          </div>
          <div className="flex items-center gap-2">
            <select
              value={lang}
              onChange={(e) => setLang(e.target.value)}
              aria-label="Bhasha"
              className="h-9 rounded-lg border bg-card px-2 text-sm font-semibold"
            >
              {LANGS.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.label}
                </option>
              ))}
            </select>
            {user ? (
              <>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={saving}
                  onClick={() => setProfileOpen(!profileOpen)}
                >
                  Meri profile
                </Button>
                <Button size="sm" variant="outline" disabled={saving} onClick={signOut}>
                  Sign out
                </Button>
              </>
            ) : accountAvailable ? (
              <Button asChild size="sm" className="rounded-full">
                <Link to="/auth">Sign in</Link>
              </Button>
            ) : (
              <span className="rounded-full border px-3 py-1.5 text-sm font-semibold">
                Demo mode
              </span>
            )}
          </div>
        </div>
      </nav>

      {profileOpen && user && (
        <div className="mx-auto max-w-5xl px-4 pt-4">
          <ShopProfile onClose={() => setProfileOpen(false)} />
        </div>
      )}

      <section className="relative mx-auto grid max-w-6xl items-center gap-12 px-4 pb-10 pt-12 sm:pt-16 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16 lg:pb-16 lg:pt-20">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
              <Sparkles className="size-4" /> Dukaan ka smart saathi
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/70 px-3 py-1.5 text-sm text-muted-foreground">
              <span
                className={`size-2 rounded-full ${voice.data?.stt ? "bg-success" : "bg-warning"}`}
              />
              {voice.isPending
                ? "Awaaz check ho rahi hai"
                : voice.data?.tts
                  ? ttsVerified
                    ? "Gnani TTS verified"
                    : "Gnani TTS configured"
                  : "Typed commands taiyaar"}
            </span>
          </div>
          <h1 className="mt-7 max-w-2xl font-display text-5xl font-bold leading-[1.06] tracking-tight sm:text-6xl lg:text-7xl">
            Aap boliye.
            <br />
            Dukaan ka{" "}
            <WordRotate className="text-primary" words={["stock", "bikri", "udhaar", "hisaab"]} />
            <span className="text-primary">.</span>
          </h1>
          <p className="mt-6 max-w-xl text-lg leading-relaxed text-muted-foreground sm:text-xl">
            Hindi ya Hinglish mein likhiye, ya awaaz se batayein. Apne kirana store ka hisaab
            rakhein — seedha, saaf aur aapke control mein.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              asChild
              size="lg"
              className="h-12 rounded-full px-6 text-base shadow-[var(--shadow-mic)]"
            >
              <a href="#app">
                Abhi shuru karein <ChevronRight />
              </a>
            </Button>
            <a
              href="#stock"
              className="inline-flex h-12 items-center gap-2 rounded-full border border-border/70 bg-card/60 px-5 font-semibold transition-colors hover:bg-accent"
            >
              Hisaab dekhein <ArrowDownRight className="size-4" />
            </a>
          </div>
          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="size-4 text-success" /> Har entry par aapki marzi
            </span>
            <span className="inline-flex items-center gap-2">
              <Mic className="size-4 text-primary" /> Hindi aur Hinglish
            </span>
          </div>
          {demo && (
            <p className="mt-6 inline-flex items-center gap-2 rounded-xl border border-warning/30 bg-warning/5 px-3 py-2 text-sm text-warning">
              <AlertTriangle className="size-4 shrink-0" />
              {accountAvailable
                ? "Demo data sirf is browser mein hai."
                : "Local demo — data sirf is browser mein save hota hai."}
            </p>
          )}
        </div>

        <div className="relative mx-auto w-full max-w-lg lg:ml-auto">
          <div
            aria-hidden
            className="absolute -inset-5 rounded-[2rem] bg-gradient-to-br from-primary/20 via-transparent to-secondary/20 blur-2xl"
          />
          <div className="relative overflow-hidden rounded-[1.75rem] border border-border/70 bg-card/90 p-5 shadow-2xl shadow-black/20 backdrop-blur-xl sm:p-7">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">
                  Aapki dukaan, ek nazar mein
                </p>
                <h2 className="mt-1 font-display text-2xl font-bold">Aaj ka hisaab</h2>
              </div>
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold ${demo ? "bg-warning/10 text-warning" : "bg-success/10 text-success"}`}
              >
                <span className={`size-1.5 rounded-full ${demo ? "bg-warning" : "bg-success"}`} />
                {demo ? "BROWSER DEMO" : "PRIVATE DATA"}
              </span>
            </div>

            <div className="mt-6 rounded-2xl border border-border/60 bg-background/70 p-5">
              <p className="text-sm text-muted-foreground">Aaj ki bikri</p>
              <div className="mt-1 flex items-end justify-between gap-3">
                <p className="font-display text-4xl font-bold tracking-tight">
                  ₹{total.toLocaleString("en-IN")}
                </p>
                <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-success/10 px-2.5 py-1 text-xs font-semibold text-success">
                  <ArrowUpRight className="size-3.5" /> {count} bills
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-xl bg-card/80 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Kul udhaar</p>
                  <p className="mt-0.5 font-semibold">
                    ₹
                    {state.credits
                      .reduce((sum, credit) => sum + credit.amount, 0)
                      .toLocaleString("en-IN")}
                  </p>
                </div>
                <div className="rounded-xl bg-card/80 px-3 py-2.5">
                  <p className="text-xs text-muted-foreground">Kam stock</p>
                  <p
                    className={`mt-0.5 font-semibold ${low.length ? "text-warning" : "text-success"}`}
                  >
                    {low.length ? `${low.length} item${low.length === 1 ? "" : "s"}` : "Sab theek"}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-6">
              <div className="mb-3 flex items-center justify-between">
                <h3 className="font-semibold">Stock par nazar</h3>
                <a href="#stock" className="text-sm font-semibold text-primary hover:underline">
                  Sab dekhein
                </a>
              </div>
              <div className="space-y-4">
                {state.products.slice(0, 3).map((product, index) => {
                  const stockPercent =
                    product.qty + product.low > 0
                      ? Math.min(100, Math.round((product.qty / (product.qty + product.low)) * 100))
                      : 0;
                  return (
                    <div key={product.key} className="flex items-center gap-3">
                      <span
                        className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${index === 0 ? "bg-primary/15 text-primary" : index === 1 ? "bg-secondary/15 text-secondary" : "bg-success/10 text-success"}`}
                      >
                        {index === 0 ? (
                          <Boxes className="size-5" />
                        ) : index === 1 ? (
                          <ShoppingCart className="size-5" />
                        ) : (
                          <HandCoins className="size-5" />
                        )}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-3 text-sm">
                          <span className="truncate font-semibold">{product.name}</span>
                          <span
                            className={`shrink-0 ${product.qty <= product.low ? "text-warning" : "text-muted-foreground"}`}
                          >
                            {product.qty} {product.unit}
                          </span>
                        </div>
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div
                            className={`h-full rounded-full ${product.qty <= product.low ? "bg-warning" : "bg-primary"}`}
                            style={{ width: `${stockPercent}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <a
              href="#app"
              className="mt-6 flex items-center justify-between gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3 transition-colors hover:bg-primary/10"
            >
              <span className="flex items-center gap-2.5 text-sm font-semibold">
                <span className="flex size-9 items-center justify-center rounded-full bg-primary text-primary-foreground">
                  <Mic className="size-4" />
                </span>
                Ek command se entry karein
              </span>
              <ChevronRight className="size-4 text-primary" />
            </a>
          </div>
          <div className="absolute -bottom-5 -left-4 hidden items-center gap-2 rounded-xl border border-border/70 bg-card px-4 py-3 shadow-xl sm:flex">
            <ShieldCheck className="size-5 text-success" />
            <span className="text-sm font-semibold">Pehle aapki confirmation</span>
          </div>
        </div>
      </section>

      <section id="app" className="mx-auto mt-12 max-w-5xl scroll-mt-24 px-4 sm:mt-16">
        <GradientFrame>
          <div className="flex flex-col items-center gap-4 p-6 sm:p-10">
            {speechUnavailable && (
              <div
                role="status"
                aria-live="polite"
                className="flex w-full max-w-3xl items-start gap-4 rounded-2xl border border-warning/30 bg-warning/5 p-4 text-left sm:p-5"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-warning/10 text-warning">
                  <AlertTriangle className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-foreground">Gnani awaaz configure nahi hai</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    Mic aur audio file transcribe nahi honge; command likhkar ya sample dabakar try
                    kijiye. Jawab {voice.data.tts ? "Gnani" : "browser"} ki awaaz mein bolenge.
                  </p>
                  <a
                    href="#command-input"
                    className="mt-3 inline-flex items-center gap-1 text-sm font-semibold text-primary hover:underline"
                  >
                    Command type karein <ChevronRight className="size-4" />
                  </a>
                </div>
              </div>
            )}
            {voice.data?.stt && (
              <p
                role="status"
                className="inline-flex items-center gap-2 rounded-full bg-success/10 px-4 py-2 text-sm font-semibold text-success"
              >
                <span className="size-2 rounded-full bg-success" /> Gnani awaaz taiyaar — mic se
                Hindi/Hinglish boliye.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={!voice.data?.tts || testingTts}
                onClick={testGnaniTts}
              >
                {testingTts ? "Gnani awaaz test ho rahi hai…" : "Gnani TTS test karein"}
              </Button>
              <span className="text-sm text-muted-foreground" role="status">
                {voice.data?.tts
                  ? ttsVerified
                    ? "Gnani se audio bana aur play hua."
                    : "Button dabakar live Gnani audio check karein."
                  : "Gnani API key nahi hai; browser voice fallback hai."}
              </span>
            </div>
            <Button
              onClick={recording ? stopRec : startRec}
              disabled={busy || saving || !!pending || speechUnavailable}
              aria-label={
                speechUnavailable
                  ? "Mic unavailable: Gnani awaaz configure nahi hai"
                  : recording
                    ? "Recording rokein"
                    : "Bolna shuru karein"
              }
              className={`mic-button flex size-32 items-center justify-center rounded-full text-primary-foreground transition-transform active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${recording ? "recording" : ""}`}
            >
              {recording ? <Square className="size-12" /> : <Mic className="size-14" />}
            </Button>
            <p className="text-lg font-semibold">
              {busy
                ? "Samajh rahe hain…"
                : recording
                  ? "Bol rahe hain… rokne ke liye dabaiye"
                  : speechUnavailable
                    ? "Awaaz ke liye Gnani setup chahiye"
                    : "Dabaiye aur boliye"}
            </p>
            <div className="flex w-full flex-col gap-2 sm:flex-row">
              <form
                className="flex flex-1 gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleTranscript(typed, demo ? "Typed (demo)" : "Typed");
                  setTyped("");
                }}
              >
                <input
                  id="command-input"
                  value={typed}
                  onChange={(e) => setTyped(e.target.value)}
                  placeholder="ya likhiye: 2 kilo cheeni becha"
                  disabled={saving || !!pending}
                  className="h-12 min-w-0 flex-1 scroll-mt-24 rounded-xl border bg-background px-4 text-lg"
                />
                <Button
                  type="submit"
                  aria-label="Command bhejiye"
                  disabled={saving || !!pending}
                  size="lg"
                  className="h-12 rounded-xl"
                >
                  <Send />
                </Button>
              </form>
              <label
                aria-disabled={speechUnavailable}
                className={`inline-flex h-12 items-center justify-center gap-2 rounded-xl border bg-background px-4 font-semibold transition-colors ${speechUnavailable ? "cursor-not-allowed opacity-40" : "cursor-pointer hover:bg-accent"}`}
              >
                <Upload className="size-5" /> Audio file
                <input
                  type="file"
                  accept="audio/*"
                  disabled={speechUnavailable}
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) processAudio(f, "Audio file (Gnani)");
                    e.target.value = "";
                  }}
                />
              </label>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {[
                "10 kilo chawal aaya",
                "2 kilo cheeni becha",
                "Ramesh ko 200 rupaye udhaar",
                "atta kitna bacha hai",
                "aaj ka hisaab batao",
              ].map((s) => (
                <Button
                  variant="secondary"
                  disabled={saving || !!pending}
                  key={s}
                  onClick={() => handleTranscript(s, demo ? "Sample (demo)" : "Sample")}
                  className="rounded-full bg-accent px-3 py-1.5 text-sm font-semibold text-accent-foreground transition-colors hover:bg-accent/70"
                >
                  {s}
                </Button>
              ))}
            </div>

            {pending && (
              <div className="w-full rounded-2xl border border-primary/60 bg-primary/10 p-5 text-left">
                <p className="text-sm text-muted-foreground">Pakka karein</p>
                <p className="mt-1 text-xl font-bold">{describeAction(pending.action)}</p>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Button
                    size="lg"
                    className="h-14 bg-success text-lg text-success-foreground hover:bg-success/90"
                    disabled={saving}
                    onClick={() => run(pending.transcript, pending.source, pending.action, pending)}
                  >
                    <Check /> Haan
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-14 text-lg"
                    disabled={saving}
                    onClick={cancelPending}
                  >
                    <X /> Nahi
                  </Button>
                </div>
              </div>
            )}

            {last && (
              <div className="grid w-full gap-3 rounded-2xl bg-muted/60 p-5 text-left sm:grid-cols-2">
                <Field label="Aapne kaha" value={`“${last.transcript}”`} sub={last.source} />
                <Field label="Status" value={last.status} />
                <div className="sm:col-span-2">
                  <p className="text-sm text-muted-foreground">Samjha gaya action (JSON)</p>
                  <pre className="mt-1 overflow-x-auto rounded-lg bg-background/60 p-3 text-sm">
                    {JSON.stringify(last.action, null, 2)}
                  </pre>
                </div>
                <div className="flex items-start justify-between gap-2 sm:col-span-2">
                  <Field label="Nateeja" value={last.result} />
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => sayResult(last.result)}
                    aria-label="Suniye"
                  >
                    <Volume2 />
                  </Button>
                </div>
              </div>
            )}
          </div>
        </GradientFrame>
      </section>

      <section className="mx-auto mt-12 grid max-w-5xl gap-4 px-4 sm:grid-cols-3">
        <Stat label="Aaj ki bikri" value={total} prefix="₹" sub={`${count} bills`} />
        <Stat
          label="Kul udhaar"
          value={state.credits.reduce((a, c) => a + c.amount, 0)}
          prefix="₹"
          sub={`${credits.length} grahak`}
        />
        <Stat
          label="Kam stock"
          value={low.length}
          sub={low.map((p) => p.name.split(" ")[1]).join(", ") || "Sab theek"}
          warn={low.length > 0}
        />
      </section>

      <section id="how" className="mx-auto mt-20 max-w-5xl scroll-mt-24 px-4">
        <p className="text-sm font-semibold uppercase tracking-widest text-primary">
          Kaise chalta hai
        </p>
        <h2 className="mt-2 max-w-2xl font-display text-3xl font-bold tracking-tight sm:text-4xl">
          Boliye. Pakka kariye. Likh diya.
        </h2>
        <p className="mt-3 max-w-2xl text-muted-foreground">
          Chaar kadam — na kagaz, na calculator, na bhoolne ki chinta.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <SpotlightCard key={s.title} className="p-5">
              <span className="inline-flex size-9 items-center justify-center rounded-full bg-primary/15 font-display text-lg font-bold text-primary">
                {i + 1}
              </span>
              <s.icon className="mt-4 size-6 text-primary" />
              <h3 className="mt-3 text-lg font-bold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.body}</p>
            </SpotlightCard>
          ))}
        </div>
      </section>

      <div
        id="stock"
        className="mx-auto mt-16 grid max-w-5xl scroll-mt-24 gap-4 px-4 lg:grid-cols-[3fr_2fr]"
      >
        <SpotlightCard className="p-5">
          <h2 className="text-xl font-bold">Stock / सामान</h2>
          <table className="mt-2 w-full text-left">
            <thead className="text-sm text-muted-foreground">
              <tr>
                <th className="py-2">Saaman</th>
                <th>Bacha</th>
                <th>Daam</th>
              </tr>
            </thead>
            <tbody>
              {state.products.map((p) => (
                <tr key={p.key} className="border-t border-border/60">
                  <td className="py-2 font-semibold">{p.name}</td>
                  <td className={p.qty <= p.low ? "font-bold text-destructive" : ""}>
                    {p.qty} {p.unit}
                    {p.qty <= p.low && " ⚠"}
                  </td>
                  <td>
                    ₹{p.price}/{p.unit}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </SpotlightCard>
        <SpotlightCard className="p-5">
          <h2 className="text-xl font-bold">Udhaar khata / उधार</h2>
          <ul className="mt-2 divide-y divide-border/60">
            {credits.map(([n, a]) => (
              <li key={n} className="flex justify-between py-2">
                <span className="font-semibold">{n}</span>
                <span className="font-bold text-destructive">₹{a}</span>
              </li>
            ))}
          </ul>
        </SpotlightCard>
      </div>

      <section className="mx-auto mt-4 max-w-5xl px-4">
        <SpotlightCard className="p-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold">Activity log</h2>
            {demo && (
              <Button
                variant="outline"
                disabled={saving}
                onClick={() => {
                  const s = sampleState();
                  commit(s);
                  setLast(null);
                  setPending(null);
                  toast.success("Demo data reset ho gaya");
                }}
              >
                <RotateCcw /> Reset demo data
              </Button>
            )}
          </div>
          {state.log.length === 0 ? (
            <p className="mt-3 text-muted-foreground">Abhi koi activity nahi.</p>
          ) : (
            <ul className="mt-3 space-y-2 text-sm">
              {state.log.map((l) => (
                <li key={l.id} className="rounded-lg bg-muted/60 p-2">
                  <span className="text-muted-foreground">
                    {new Date(l.at).toLocaleTimeString("en-IN")}
                  </span>{" "}
                  · <b>{l.action}</b> · {l.status} · <i>{l.source}</i>
                  <div>
                    “{l.transcript}” → {l.result}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </SpotlightCard>
      </section>

      <footer className="mt-20 border-t border-border/60 pt-8 text-center text-sm text-muted-foreground">
        <p>DukaanSaathi AI — बोलिए, हम लिखेंगे.</p>
        <p className="mt-1">
          Stock · Bikri · Udhaar ·{" "}
          <Link
            to="/test"
            className="underline decoration-border underline-offset-4 hover:decoration-foreground"
          >
            Test
          </Link>
        </p>
      </footer>
    </main>
  );
}

function Field({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div>
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground">Source: {sub}</p>}
    </div>
  );
}
function Stat({
  label,
  value,
  prefix,
  sub,
  warn,
}: {
  label: string;
  value: number;
  prefix?: string;
  sub: string;
  warn?: boolean;
}) {
  return (
    <SpotlightCard className={warn ? "border-warning/40 bg-warning/10" : ""}>
      <div className="p-5">
        <p className="text-sm text-muted-foreground">{label}</p>
        <p className="mt-1 font-display text-4xl font-bold tracking-tight">
          {prefix}
          <CountUp value={value} />
        </p>
        <p className="mt-1 truncate text-sm text-muted-foreground">{sub}</p>
      </div>
    </SpotlightCard>
  );
}
