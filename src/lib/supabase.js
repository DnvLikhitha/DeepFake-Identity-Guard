import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://croccrnzjlsextaurohr.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyb2Njcm56amxzZXh0YXVyb2hyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMzODQzMjUsImV4cCI6MjA4ODk2MDMyNX0.SoUdNzCVnf2BInmbx73J4QRLrWU7HaJ9IR6grVK5crY'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
