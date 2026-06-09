import { Nunito } from 'next/font/google';
import './globals.css';

const nunito = Nunito({
  subsets: ['latin'],
  weight: ['400', '600', '700', '800', '900'],
  variable: '--font-nunito',
});

export const metadata = {
  title: 'Undercover',
  description: "Complete your mission. Don't get caught.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className={nunito.variable}>
        {children}
      </body>
    </html>
  );
}
