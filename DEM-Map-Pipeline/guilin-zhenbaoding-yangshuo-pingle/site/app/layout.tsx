import type { Metadata } from "next";
import "./globals.css";

const siteOrigin = process.env.SITE_URL ?? "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteOrigin),
  title: "桂林扩展 DEM · 真宝鼎至阳朔平乐交界",
  description:
    "覆盖真宝鼎北延十五公里至阳朔平乐交界的完整 DEM 三维地形与二维高程预览。",
  openGraph: {
    title: "桂林扩展 DEM",
    description: "真宝鼎北延至阳朔平乐交界的完整在线地形预览。",
    images: [{ url: "/og.png", width: 1672, height: 941 }],
    locale: "zh_CN",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "桂林扩展 DEM",
    description: "真宝鼎北延至阳朔平乐交界的完整在线地形预览。",
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
