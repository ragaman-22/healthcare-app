import Link from 'next/link'

export default function LegalLayout({ children }: { children: React.ReactNode }) {
  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <Link href="/" className="text-sm font-bold text-brand-700">
        おかねと税金ノート
      </Link>
      <p className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-3 text-xs leading-relaxed text-amber-900">
        これは公開前の下書きです。事業者名・連絡先・料金・準拠法などを確定し、弁護士・税理士等の専門家の確認を受けてから公開してください。
      </p>
      <article className="prose-sm mt-6 space-y-4 text-sm leading-relaxed text-slate-800 [&_h1]:text-xl [&_h1]:font-bold [&_h2]:mt-6 [&_h2]:text-base [&_h2]:font-bold [&_li]:ml-5 [&_li]:list-disc">
        {children}
      </article>
    </main>
  )
}
