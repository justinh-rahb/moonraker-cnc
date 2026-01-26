import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { execSync } from 'child_process'
import { readFileSync } from 'fs'

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

const gitCommit = getGitCommit()
const gitTag = getGitTag()
const appVersion = getAppVersion()

// https://vite.dev/config/
export default defineConfig({
  plugins: [svelte()],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
    __GIT_COMMIT__: JSON.stringify(gitCommit),
    __GIT_TAG__: JSON.stringify(gitTag),
  },
})
