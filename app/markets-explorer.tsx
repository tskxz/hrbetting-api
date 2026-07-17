"use client";

import { useState } from "react";
import { Check, Copy } from "lucide-react";

type Category = "Resultado" | "Dupla hipótese" | "Golos";

type Market = {
  code: string;
  description: string;
  category: Category;
};

const markets: Market[] = [
  { code: "1", description: "Vitória da equipa da casa", category: "Resultado" },
  { code: "2", description: "Vitória da equipa de fora", category: "Resultado" },
  { code: "1X", description: "Dupla hipótese casa ou empate", category: "Dupla hipótese" },
  { code: "X2", description: "Dupla hipótese fora ou empate", category: "Dupla hipótese" },
  { code: "Over 0.5 HT", description: "Mais de 0.5 golos na 1ª parte", category: "Golos" },
  { code: "Over 1.5 FT", description: "Mais de 1.5 golos no jogo", category: "Golos" },
  { code: "Over 2.5 FT", description: "Mais de 2.5 golos no jogo", category: "Golos" },
  { code: "BTTS (Y)", description: "Ambas as equipas marcam", category: "Golos" },
];

const filters: Array<"Todos" | Category> = [
  "Todos",
  "Resultado",
  "Dupla hipótese",
  "Golos",
];

export function MarketsExplorer() {
  const [active, setActive] = useState<"Todos" | Category>("Todos");
  const [copied, setCopied] = useState<string | null>(null);

  const visible =
    active === "Todos"
      ? markets
      : markets.filter((market) => market.category === active);

  async function copyCode(code: string) {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(code);
      setTimeout(() => setCopied((current) => (current === code ? null : current)), 1500);
    } catch {
      // clipboard indisponível, ignorar silenciosamente
    }
  }

  return (
    <section className="w-full">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-xl font-semibold tracking-tight text-foreground">
            Mercados suportados
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {visible.length} mercado{visible.length === 1 ? "" : "s"} disponíve
            {visible.length === 1 ? "l" : "is"} para análise
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map((filter) => {
            const isActive = active === filter;
            return (
              <button
                key={filter}
                type="button"
                onClick={() => setActive(filter)}
                aria-pressed={isActive}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition-colors ${
                  isActive
                    ? "border-accent bg-accent text-accent-foreground"
                    : "border-border bg-muted text-muted-foreground hover:border-accent/50 hover:text-foreground"
                }`}
              >
                {filter}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        {visible.map((market, index) => {
          const isCopied = copied === market.code;
          return (
            <button
              key={market.code}
              type="button"
              onClick={() => copyCode(market.code)}
              style={{ animationDelay: `${index * 40}ms` }}
              className="animate-fade-up group flex items-center gap-4 rounded-md border border-border bg-card p-4 text-left transition-all duration-200 hover:-translate-y-0.5 hover:border-accent/60 hover:shadow-lg hover:shadow-accent/5 focus:outline-none focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent/40"
            >
              <code className="shrink-0 rounded-md bg-muted px-2.5 py-1.5 font-mono text-xs font-medium text-accent ring-1 ring-inset ring-border transition-colors group-hover:ring-accent/40">
                {market.code}
              </code>
              <span className="flex-1 text-sm text-foreground/90">
                {market.description}
              </span>
              <span
                aria-hidden="true"
                className="shrink-0 text-muted-foreground transition-colors group-hover:text-accent"
              >
                {isCopied ? <Check className="size-4" /> : <Copy className="size-4" />}
              </span>
              <span className="sr-only">
                {isCopied ? "Código copiado" : `Copiar código ${market.code}`}
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
