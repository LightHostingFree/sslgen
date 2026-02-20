import Script from 'next/script'
import '../styles/globals.css'

export default function App({ Component, pageProps }){
  return (
    <>
      <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
      <Component {...pageProps} />
    </>
  )
}
