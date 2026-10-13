import "./globals.css";

export const metadata = {
  title: "그림 음악 벽",
  description: "영아들이 전자칠판에서 손으로 그린 그림이 음악이 되고, 배경 위에 둥둥 전시돼요.",
};

export const viewport = { width: "device-width", initialScale: 1, maximumScale: 1, userScalable: false, themeColor: "#9b5de5" };

export default function RootLayout({ children }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Jua&display=swap" rel="stylesheet" />
      </head>
      <body>{children}</body>
    </html>
  );
}
