import type { Metadata } from "next";
import { Poppins, Montserrat } from "next/font/google";
import "./globals.scss";
import { Providers } from "@/app/providers";
import { Toaster } from "sonner";

const montserrat = Montserrat({
  subsets: ["latin"],
  weight: ["200", "300", "400", "500"],
  variable: "--font-montserrat",
  display: "swap",
});

export const metadata: Metadata = {
  title: "WorkCore",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk">
      <body
        className={`${montserrat.variable} ${montserrat.variable} antialiased`}
      >
        <Providers>
          {children}
          <Toaster
            theme="light"
            position="bottom-center"
            duration={1500}
          ></Toaster>
          <div id="modal-root" />
        </Providers>
      </body>
    </html>
  );
}
