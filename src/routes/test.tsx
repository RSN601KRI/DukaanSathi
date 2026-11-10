import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { parseCommand, type ActionType } from "@/lib/parser";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/test")({
  head: () => ({
    meta: [
      { title: "Command Test — DukaanSaathi AI" },
      { name: "description", content: "Compare Hindi/Hinglish commands with expected actions." },
      { property: "og:title", content: "Command Test — DukaanSaathi AI" },
      { property: "og:description", content: "Hindi/Hinglish command parser test bench." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TestPage,
});

const CASES: { text: string; expected: ActionType }[] = [
  { text: "10 kilo chawal aaya", expected: "add_stock" },
  { text: "पांच लीटर दूध आया", expected: "add_stock" },
  { text: "2 kilo cheeni becha 90 rupaye", expected: "record_sale" },
  { text: "teen packet biscuit beche", expected: "record_sale" },
  { text: "Ramesh ko 500 rupaye udhaar", expected: "add_credit" },
  { text: "सुनीता का 200 रुपये उधार लिखो", expected: "add_credit" },
  { text: "atta kitna bacha hai", expected: "get_stock" },
  { text: "तेल कितना बचा है", expected: "get_stock" },
  { text: "aaj ka hisaab batao", expected: "get_daily_summary" },
  { text: "doodh becha", expected: "record_sale" },
];

function TestPage() {
  const [custom, setCustom] = useState("");
  const results = CASES.map((c) => ({ ...c, got: parseCommand(c.text) }));
  const pass = results.filter((r) => r.got.action === r.expected).length;
  return (
    <main className="mx-auto max-w-4xl px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-extrabold text-primary">Command Test</h1>
        <Button asChild variant="outline">
          <Link to="/">← Dashboard</Link>
        </Button>
      </div>
      <p className="mt-2 text-lg font-semibold">
        {pass}/{CASES.length} pass
      </p>
      <div className="mt-4 space-y-2">
        {results.map((r) => {
          const ok = r.got.action === r.expected;
          return (
            <div
              key={r.text}
              className={`rounded-xl border-2 p-3 ${ok ? "border-success bg-success/10" : "border-destructive bg-destructive/10"}`}
            >
              <p className="font-semibold">“{r.text}”</p>
              <p className="text-sm">
                Expected <b>{r.expected}</b> · Got <b>{r.got.action}</b> {ok ? "✓" : "✗"}
              </p>
              <code className="text-xs text-muted-foreground">{JSON.stringify(r.got)}</code>
            </div>
          );
        })}
      </div>
      <h2 className="mt-8 text-xl font-bold">Apna command try kijiye</h2>
      <input
        value={custom}
        onChange={(e) => setCustom(e.target.value)}
        placeholder="e.g. 4 kilo dal aaya"
        className="mt-2 h-12 w-full rounded-xl border bg-card px-4 text-lg"
      />
      {custom && (
        <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-sm">
          {JSON.stringify(parseCommand(custom), null, 2)}
        </pre>
      )}
    </main>
  );
}
