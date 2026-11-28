import type { CapacitorConfig } from '@capacitor/cli'
const config: CapacitorConfig = {
  appId: 'jp.sereness.match',
  appName: 'Sereness Match',
  webDir: 'dist',
  plugins: { SplashScreen: { launchAutoHide: false, backgroundColor: '#fffcf7' } },
}
export default config
