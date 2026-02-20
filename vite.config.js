import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

function resolveBasePath() {
  if (process.env.GITHUB_ACTIONS !== 'true') {
    return '/'
  }

  const repository = process.env.GITHUB_REPOSITORY
  if (!repository || !repository.includes('/')) {
    return '/'
  }

  const repoName = repository.split('/')[1]
  return `/${repoName}/`
}

// https://vite.dev/config/
export default defineConfig({
  base: resolveBasePath(),
  plugins: [svelte()],
  test: {
    environment: 'jsdom',
    globals: true,
  },
})
