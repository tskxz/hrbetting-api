import Image from "next/image";
import { MarketsExplorer } from "./markets-explorer";

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden px-4 py-16 sm:px-6 lg:px-8">
      {/* Subtle accent glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-80 bg-[radial-gradient(60%_100%_at_50%_0%,rgba(34,197,94,0.14),transparent)]"
      />

      <main className="mx-auto flex max-w-3xl flex-col gap-14">
        {/* Header */}
        <header className="animate-fade-up flex flex-col items-center gap-6 text-center">
          <div className="rounded-2xl border border-border bg-card/60 p-4 shadow-lg shadow-black/20 backdrop-blur">
            <Image
              src="/Logo_HR_Betting.png"
              alt="Logo HR Betting"
              width={180}
              height={100}
              priority
            />
          </div>

          <span className="inline-flex items-center gap-2 rounded-full border border-border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-accent" />
            API + Desktop C# / WPF
          </span>

          <div className="space-y-3">
            <h1 className="text-balance text-3xl font-semibold tracking-tight text-foreground sm:text-4xl">
              HR Betting API
            </h1>
            <p className="mx-auto max-w-xl text-pretty leading-relaxed text-muted-foreground">
              A análise dos jogos e o cálculo de probabilidades são feitos
              pela aplicação desktop HR Betting (C# / WPF). Este site é a
              ponte para o Telegram: entrega dos sinais, o bot e o sistema
              de subscrição premium.
            </p>
          </div>
        </header>

        {/* Mercados suportados */}
        <MarketsExplorer />

        <footer className="text-center text-xs text-muted-foreground">
          Toque num mercado para copiar o respetivo código.
        </footer>
      </main>
    </div>
  );
}
