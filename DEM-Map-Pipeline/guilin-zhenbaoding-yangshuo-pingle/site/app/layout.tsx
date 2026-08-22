import type { Metadata } from "next";
import "./globals.css";

const siteOrigin = process.env.SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "桂林扩展 DEM · 真宝鼎至阳朔平乐交界",
  description:
    "公開瀏覽桂林完整 DEM 三維地形，支援四個 200 平方公里焦點區域的 12.5 米 DEM 與 Gaea 視覺調整。",
  openGraph: {
    title: "桂林扩展 DEM",
    description: "真寶鼎北延至陽朔平樂交界的公開在線地形預覽，含四個 200 平方公里焦點區域。",
    images: [{ url: "/og.png", width: 1672, height: 941 }],
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "桂林扩展 DEM",
    description: "真寶鼎北延至陽朔平樂交界的公開在線地形預覽，含四個 200 平方公里焦點區域。",
    images: ["/og.png"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
