import type { Metadata } from 'next';
import { IBM_Plex_Mono, IBM_Plex_Sans, IBM_Plex_Serif } from 'next/font/google';
import Shell from '@/components/Shell';
import './globals.css';

// Fonts are self-hosted by next/font at build time; nothing loads from a CDN at runtime.
const sans = IBM_Plex_Sans({ subsets: ['latin'], weight: ['400', '500', '600', '700'], variable: '--font-plex-sans' });
const mono = IBM_Plex_Mono({ subsets: ['latin'], weight: ['400', '500', '600'], variable: '--font-plex-mono' });
const serif = IBM_Plex_Serif({ subsets: ['latin'], weight: ['400'], style: ['italic'], variable: '--font-plex-serif' });

export const metadata: Metadata = {
  title: 'Quorvane Submission Desk · Underwriting Submission Intelligence',
  description: 'Example underwriting workbench on synthetic data: extract broker submissions, check appetite and completeness, and rank the best-fit risks with Snowflake Cortex.',
};

// Applies the saved theme before paint so the page does not flash.
const THEME = `try{var t=localStorage.getItem('quorvane-theme');if(!t)t=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light';document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${sans.variable} ${mono.variable} ${serif.variable}`} suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: THEME }} /></head>
      <body><Shell>{children}</Shell></body>
    </html>
  );
}
