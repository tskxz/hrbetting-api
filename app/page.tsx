import Image from "next/image";

const markets = [
  { code: "1", description: "Vitória da equipa da casa" },
  { code: "2", description: "Vitória da equipa de fora" },
  { code: "1X", description: "Dupla hipótese casa ou empate" },
  { code: "X2", description: "Dupla hipótese fora ou empate" },
  { code: "Over 0.5 HT", description: "Mais de 0.5 golos na 1ª parte" },
  { code: "Over 1.5 FT", description: "Mais de 1.5 golos no jogo" },
  { code: "Over 2.5 FT", description: "Mais de 2.5 golos no jogo" },
  { code: "BTTS (Y)", description: "Ambas as equipas marcam" },
];

export default function Home() {
  return (
    <div className="min-h-screen bg-zinc-50 px-4 py-12 text-zinc-900 sm:px-6 lg:px-8">
      <main className="mx-auto flex max-w-3xl flex-col gap-10">
        {/* Header */}
        <header className="flex flex-col items-center gap-5 text-center">
          <Image
            src="/Logo_HR_Betting.png"
            alt="Logo HR Betting"
            width={200}
            height={110}
            priority
          />
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl text-balance">
              HR Betting API
            </h1>
            <p className="mx-auto max-w-xl leading-relaxed text-zinc-600 text-pretty">
              API para análise de jogos de futebol e cálculo de probabilidades,
              utilizada por uma aplicação desktop em C# (.NET / WPF).
            </p>
          </div>
        </header>

        {/* Mercados suportados */}
        <section className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm sm:p-8">
          <h2 className="text-xl font-semibold text-zinc-900">
            Mercados suportados
          </h2>
          <div className="mt-6 overflow-hidden rounded-xl border border-zinc-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-zinc-500">
                  <th className="px-4 py-3 font-medium">Mercado</th>
                  <th className="px-4 py-3 font-medium">Descrição</th>
                </tr>
              </thead>
              <tbody>
                {markets.map((market) => (
                  <tr
                    key={market.code}
                    className="border-b border-zinc-100 last:border-0"
                  >
                    <td className="px-4 py-3 align-middle">
                      <code className="rounded-md bg-zinc-100 px-2 py-1 font-mono text-xs text-zinc-700">
                        {market.code}
                      </code>
                    </td>
                    <td className="px-4 py-3 align-middle text-zinc-600">
                      {market.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
