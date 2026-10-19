import type { Metadata } from "next";
import "./globals.css";
import { ToastProvider } from "@/components/client-ui";

export const metadata: Metadata = {
  title: { default: "Social Purepixel", template: "%s · Social Purepixel" },
  description: "Planear, criar e publicar nas redes sociais de cada marca.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
