import '../styles/globals.scss';
import type { AppProps } from 'next/app';
import { MagneticHover } from '../components/ui/MagneticHover';

export default function App({ Component, pageProps }: AppProps) {
  return (
    <>
      <MagneticHover />
      <Component {...pageProps} />
    </>
  );
}
