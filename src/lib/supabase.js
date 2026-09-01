import { createClient } from '@supabase/supabase-js'
import { isDemoMode, createDemoClient } from './demo'

// I demoläget (?demo=1) skapas ingen riktig klient över huvud taget. Det är
// avsiktligt: då finns det ingen anslutning som skulle kunna nå hushållets
// data, oavsett vilka nycklar bygget råkar innehålla.
const demo = isDemoMode()

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = demo
  ? createDemoClient()
  : createClient(supabaseUrl, supabaseAnonKey)

export const IS_DEMO = demo
