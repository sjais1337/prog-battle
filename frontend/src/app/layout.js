import { Inter } from "next/font/google";
import "./globals.css";
import { AuthProvider } from '../context/AuthContext'; 
import Nav from "@/components/Nav";

const inter = Inter({ subsets: ["latin"] });

export const metadata = { 
  title: 'Prog Battle' 
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>
          <Nav />
          <main>{children}</main>
        </AuthProvider>
      </body>
    </html>
  );
}