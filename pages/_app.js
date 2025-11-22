import Head from 'next/head'
import '../styles/globals.css'
import { ClerkProvider } from '@clerk/nextjs'

export default function App({ Component, pageProps }){
  return (
    <ClerkProvider {...pageProps}>
      <Head><script src="https://cdn.tailwindcss.com"></script></Head>
      <Component {...pageProps} />
    </ClerkProvider>
  )
}
