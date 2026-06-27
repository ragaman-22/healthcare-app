import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HealthLink - 健康管理アプリ",
  description: "パーソナルヘルスレコード管理サービス",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="bg-gray-50 antialiased">{children}</body>
    </html>
  );
}
