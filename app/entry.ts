const url = import.meta.env.VITE_SUPABASE_URL
const key = import.meta.env.VITE_SUPABASE_PUBLIC_KEY

if (url || key) {
  void import('./online').then(({ startOnline }) => startOnline(url, key))
} else {
  void import('./main')
}
