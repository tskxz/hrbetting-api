import Image from "next/image";

export default function Home() {
  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#f8fafc,_#f1f5f9_45%,_#e2e8f0)] px-4 py-10 text-zinc-900 sm:px-6 lg:px-8">
      <main className="mx-auto flex max-w-5xl flex-col gap-8 rounded-[2rem] border border-zinc-200 bg-white/90 p-8 shadow-[0_30px_80px_-30px_rgba(15,23,42,0.35)] backdrop-blur sm:p-10 lg:p-12">
        <section className="flex flex-col items-center gap-6 rounded-[1.5rem] border border-zinc-100 bg-zinc-50/70 p-6 text-center md:flex-row md:items-center md:text-left">
          <div className="flex-shrink-0">
            <Image
              src="/Logo_HR_Betting.png"
              alt="Logo HR Betting"
              width={220}
              height={120}
              priority
            />
          </div>
          <div className="space-y-3">
            <p className="text-sm font-semibold uppercase tracking-[0.35em] text-emerald-600">
              HR Betting API
            </p>
            <h1 className="text-3xl font-semibold leading-tight text-zinc-900 sm:text-4xl">
              API para análise de jogos de futebol e avaliação de probabilidades
            </h1>
            <p className="max-w-2xl text-lg leading-8 text-zinc-600">
              Plataforma pensada para uma aplicação desktop em C# (.NET / WPF), com foco em carregar dados brutos diários, calcular odds e probabilidades para os principais mercados de apostas e medir a taxa de acerto do modelo frente aos resultados finais.
            </p>
          </div>
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          <article className="rounded-[1.25rem] border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Dados diários</h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600">
              Ingestão de informações brutas de partidas para alimentar o fluxo de processamento e análise.
            </p>
          </article>
          <article className="rounded-[1.25rem] border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Odds e probabilidades</h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600">
              Cálculo de estimativas para mercados principais como vitória, empate e over/under.
            </p>
          </article>
          <article className="rounded-[1.25rem] border border-zinc-200 bg-white p-5 shadow-sm">
            <h2 className="text-lg font-semibold text-zinc-900">Avaliação de desempenho</h2>
            <p className="mt-2 text-sm leading-7 text-zinc-600">
              Comparação das previsões do modelo com os resultados finais para medir a taxa de acerto.
            </p>
          </article>
        </section>

        <section className="rounded-[1.5rem] bg-zinc-950 p-6 text-white sm:p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.3em] text-zinc-400">
            Visão do projeto
          </p>
          <p className="mt-3 max-w-3xl text-base leading-8 text-zinc-300">
            A ideia central é criar uma API robusta e escalável que sirva de base para uma aplicação desktop em C# com interface WPF, permitindo análise histórica, integração com fontes de dados e geração de insights para apostas esportivas.
          </p>
        </section>
      </main>
    </div>
  );
}
