import { createClient } from '@supabase/supabase-js'
import { isDemoMode, createDemoClient } from './demo'

// I demoläget (?demo=1) skapas ingen riktig klient över huvud taget. Det är
// avsiktligt: då finns det ingen anslutning som skulle kunna nå hushållets
// data, oavsett vilka nycklar bygget råkar innehålla.
const demo = isDemoMode()

// trim() är inte kosmetika. Klistras värdet in i Vercel med en radbrytning
// eller ett mellanslag på slutet följer det med in i bygget, och adressen blir
// ogiltig. createClient klagar inte — den kastar bara när värdet saknas helt,
// inte när det är trasigt — så felet dyker upp först vid första anropet, som
// ett intetsägande "Failed to fetch".
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL || "").trim()
const supabaseAnonKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || "").trim()

// Säg vad som är fel i stället för att låta det bli ett nätverksfel senare.
if (!demo) {
  if (!supabaseUrl || !supabaseAnonKey) {
    console.error("[supabase] VITE_SUPABASE_URL eller VITE_SUPABASE_ANON_KEY saknas i bygget")
  } else {
    try {
      const u = new URL(supabaseUrl)
      if (u.protocol !== "https:") {
        console.error("[supabase] Adressen är inte https:", supabaseUrl)
      }
    } catch {
      console.error("[supabase] Ogiltig VITE_SUPABASE_URL:", JSON.stringify(supabaseUrl))
    }
  }
}

export const supabase = demo
  ? createDemoClient()
  : createClient(supabaseUrl, supabaseAnonKey)

// Används av felmeddelanden i UI:t — adressen är publik, den ligger i bundlen.
export const SUPABASE_URL = supabaseUrl

export const IS_DEMO = demo
