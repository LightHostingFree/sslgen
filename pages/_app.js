import Script from 'next/script'
import Head from 'next/head'
import '../styles/globals.css'

export default function App({ Component, pageProps }){
  return (
    <>
      <Head>
        <link rel="icon" href="/favicon.ico" />
        <title>SSL Generator</title>
      </Head>
      <Script src="https://cdn.tailwindcss.com" strategy="beforeInteractive" />
      <Component {...pageProps} />
    </>
  )
}
