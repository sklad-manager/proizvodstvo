import type { Metadata } from "next";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export const metadata: Metadata = {
  title: "Proizvodstvo - Система управления",
  description: "Автоматизация учета производства вискозных салфеток",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <link href="https://fonts.googleapis.com/css?family=Open+Sans:300,400,600,700" rel="stylesheet" />
        <link href="/assets/css/nucleo-icons.css" rel="stylesheet" />
        <link href="/assets/css/nucleo-svg.css" rel="stylesheet" />
        <link href="/assets/css/perfect-scrollbar.css" rel="stylesheet" />
        <link href="/assets/css/tooltips.css" rel="stylesheet" />
        <script src="https://kit.fontawesome.com/42d5adcbca.js" crossOrigin="anonymous" async></script>
      </head>
      <body className="m-0 font-sans text-base antialiased font-normal leading-default bg-gray-50 text-slate-500 min-h-screen flex flex-col">
        <div className="absolute w-full bg-blue-500 min-h-75 z-0"></div>

        <main className="relative flex-grow transition-all duration-200 ease-in-out w-full max-w-7xl mx-auto rounded-xl z-10 pt-4">
          <Navbar title="Главное меню" />
          
          <div className="w-full px-6 py-6 mx-auto">
            {children}
          </div>
        </main>
        
        <div className="z-10 bg-white shadow-inner mt-auto">
           <Footer />
        </div>
      </body>
    </html>
  );
}
