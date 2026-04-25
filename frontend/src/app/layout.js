import "./globals.css";

export const metadata = {
  title: 'JobSniper — Real-time Freelance Job Radar',
  description: 'Find and apply to newly posted freelance jobs in seconds',
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
