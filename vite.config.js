import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'
import { validateConfig } from './src/lib/config.js'

// Get build-time git information with fallback handling
function getGitCommit() {
  try {
    return execSync('git rev-parse --short=7 HEAD', { encoding: 'utf8' }).trim()
  } catch {
    return 'dev'
  }
}

function getGitTag() {
  try {
    return execSync('git describe --tags --exact-match', { encoding: 'utf8' }).trim()
  } catch {
    return ''
  }
}

function getAppVersion() {
  try {
    const pkg = JSON.parse(readFileSync('./package.json', 'utf8'))
    return pkg.version || 'dev'
  } catch {
    return 'dev'
  }
}

const defaultConfigPath = process.env.DEFAULT_SETTINGS_FILE
let defaultConfig = defaultConfigPath ? JSON.parse(readFileSync(defaultConfigPath, 'utf8')) : {}
if (defaultConfig.version === 2) defaultConfig = defaultConfig.hosts?.find(h => h.id === defaultConfig.activeHostId)?.config || defaultConfig.hosts?.[0]?.config
validateConfig(defaultConfig)
if (!['retro', 'flight'].includes(process.env.APP_THEME || 'retro')) throw new Error('APP_THEME must be retro or flight')
const gitCommit = getGitCommit()
const gitTag = getGitTag()
const appVersion = getAppVersion()

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  define: {
    __DEFAULT_CONFIG__: JSON.stringify(defaultConfig),
    __APP_THEME__: JSON.stringify(process.env.APP_THEME || 'retro'),
    __APP_VERSION__: JSON.stringify(appVersion),
    __GIT_COMMIT__: JSON.stringify(gitCommit),
    __GIT_TAG__: JSON.stringify(gitTag),
  },
})
