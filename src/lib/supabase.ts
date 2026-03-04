import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://hbnydksqtfvnerkskuum.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imhibnlka3NxdGZ2bmVya3NrdXVtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5NDcxNjYsImV4cCI6MjA4NzUyMzE2Nn0.teP7sUz-fyUsYEGCu2HOXy1eaCIHxqAyFN_xo4X3I9Q'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)