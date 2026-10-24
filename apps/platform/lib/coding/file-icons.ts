// Maps file names and extensions to vscode-icons icon names (Iconify).
// The actual icon SVG data is bundled as a curated subset and registered at
// runtime (see file-icon.tsx) so we never hit the network and never ship the
// full ~3.5MB icon set to the client.
//
// To regenerate the bundled subset after editing the maps below, run:
//   node scripts/build-file-icons.mjs

// Special, exact-match file names (case-insensitive) → icon name.
// These win over extension matching (e.g. "tsconfig.json" → tsconfig icon).
export const FILENAME_ICONS: Record<string, string> = {
  // Package managers / manifests
  'package.json': 'file-type-npm',
  'package-lock.json': 'file-type-npm',
  'pnpm-lock.yaml': 'file-type-pnpm',
  'pnpm-workspace.yaml': 'file-type-pnpm',
  'yarn.lock': 'file-type-yarn',
  '.yarnrc': 'file-type-yarn',
  '.yarnrc.yml': 'file-type-yarn',
  'bun.lockb': 'file-type-bun',
  'bunfig.toml': 'file-type-bunfig',
  'composer.json': 'file-type-composer',
  'composer.lock': 'file-type-composer',
  'gemfile': 'file-type-bundler',
  'gemfile.lock': 'file-type-bundler',
  'cargo.toml': 'file-type-cargo',
  'cargo.lock': 'file-type-cargo',
  'go.mod': 'file-type-go-package',
  'go.sum': 'file-type-go-package',
  'go.work': 'file-type-go-work',
  'pubspec.yaml': 'file-type-flutter-package',

  // TS/JS config
  'tsconfig.json': 'file-type-tsconfig',
  'tsconfig.base.json': 'file-type-tsconfig',
  'jsconfig.json': 'file-type-jsconfig',

  // Bundlers / build tools
  'vite.config.ts': 'file-type-vite',
  'vite.config.js': 'file-type-vite',
  'webpack.config.js': 'file-type-webpack',
  'rollup.config.js': 'file-type-rollup',
  'esbuild.config.js': 'file-type-esbuild',
  'gulpfile.js': 'file-type-gulp',
  'gruntfile.js': 'file-type-grunt',
  'babel.config.js': 'file-type-babel',
  '.babelrc': 'file-type-babel',
  'turbo.json': 'file-type-turbo',

  // Frameworks
  'next.config.js': 'file-type-next',
  'next.config.mjs': 'file-type-next',
  'next.config.ts': 'file-type-next',
  'nuxt.config.ts': 'file-type-nuxt',
  'astro.config.mjs': 'file-type-astroconfig',
  'svelte.config.js': 'file-type-svelte',
  'vercel.json': 'file-type-vercel',
  'netlify.toml': 'file-type-netlify',
  'capacitor.config.ts': 'file-type-capacitor',

  // Styling
  'tailwind.config.js': 'file-type-tailwind',
  'tailwind.config.ts': 'file-type-tailwind',
  'postcss.config.js': 'file-type-postcssconfig',

  // Linters / formatters
  '.eslintrc': 'file-type-eslint',
  '.eslintrc.js': 'file-type-eslint',
  '.eslintrc.json': 'file-type-eslint',
  'eslint.config.js': 'file-type-eslint',
  'eslint.config.mjs': 'file-type-eslint',
  '.prettierrc': 'file-type-prettier',
  '.prettierrc.js': 'file-type-prettier',
  '.prettierrc.json': 'file-type-prettier',
  '.editorconfig': 'file-type-editorconfig',
  'biome.json': 'file-type-biome',
  '.stylelintrc': 'file-type-stylelint',

  // Testing
  'jest.config.js': 'file-type-jest',
  'jest.config.ts': 'file-type-jest',
  'vitest.config.ts': 'file-type-vitest',
  'cypress.config.js': 'file-type-cypress',
  'playwright.config.ts': 'file-type-playwright',

  // Git / CI / tooling
  '.gitignore': 'file-type-git',
  '.gitattributes': 'file-type-git',
  '.gitmodules': 'file-type-git',
  '.npmignore': 'file-type-npm',
  '.npmrc': 'file-type-npm',
  '.nvmrc': 'file-type-node',
  '.dockerignore': 'file-type-docker',
  'dockerfile': 'file-type-docker',
  'docker-compose.yml': 'file-type-docker',
  'docker-compose.yaml': 'file-type-docker',
  '.gitlab-ci.yml': 'file-type-gitlab',
  'jenkinsfile': 'file-type-jenkins',
  'makefile': 'file-type-config',
  'cmakelists.txt': 'file-type-cmake',
  'procfile': 'file-type-config',

  // Env / docs / meta
  '.env': 'file-type-dotenv',
  '.env.local': 'file-type-dotenv',
  '.env.development': 'file-type-dotenv',
  '.env.production': 'file-type-dotenv',
  'readme.md': 'file-type-markdown',
  'license': 'file-type-license',
  'license.md': 'file-type-license',
  'changelog.md': 'file-type-markdown',
  'codeowners': 'file-type-codeowners',
  'robots.txt': 'file-type-robots',

  // Databases / cloud
  'firebase.json': 'file-type-firebase',
  'prisma.schema': 'file-type-prisma',
  'schema.prisma': 'file-type-prisma',
}

// Extension (lowercase, no dot) → icon name.
export const EXTENSION_ICONS: Record<string, string> = {
  // Web / JS / TS
  js: 'file-type-js',
  mjs: 'file-type-js',
  cjs: 'file-type-js',
  jsx: 'file-type-reactjs',
  ts: 'file-type-typescript',
  mts: 'file-type-typescript',
  cts: 'file-type-typescript',
  tsx: 'file-type-reactts',
  vue: 'file-type-vue',
  svelte: 'file-type-svelte',
  astro: 'file-type-astro',
  html: 'file-type-html',
  htm: 'file-type-html',
  xml: 'file-type-xml',
  svg: 'file-type-svg',
  css: 'file-type-css',
  scss: 'file-type-scss',
  sass: 'file-type-sass',
  less: 'file-type-less',
  styl: 'file-type-stylus',

  // Data / config
  json: 'file-type-json',
  json5: 'file-type-json',
  jsonc: 'file-type-json',
  yaml: 'file-type-yaml',
  yml: 'file-type-yaml',
  toml: 'file-type-toml',
  ini: 'file-type-ini',
  csv: 'file-type-text',
  env: 'file-type-dotenv',
  graphql: 'file-type-graphql',
  gql: 'file-type-graphql',
  proto: 'file-type-protobuf',

  // Backend languages
  py: 'file-type-python',
  pyw: 'file-type-python',
  rb: 'file-type-ruby',
  php: 'file-type-php',
  java: 'file-type-java',
  kt: 'file-type-kotlin',
  kts: 'file-type-kotlin',
  scala: 'file-type-scala',
  go: 'file-type-go',
  rs: 'file-type-rust',
  c: 'file-type-c',
  h: 'file-type-cheader',
  cpp: 'file-type-cpp',
  cc: 'file-type-cpp',
  cxx: 'file-type-cpp',
  hpp: 'file-type-cppheader',
  cs: 'file-type-csharp',
  swift: 'file-type-swift',
  dart: 'file-type-dartlang',
  r: 'file-type-r',
  lua: 'file-type-lua',
  pl: 'file-type-perl',
  ex: 'file-type-elixir',
  exs: 'file-type-elixir',
  erl: 'file-type-erlang',
  clj: 'file-type-clojure',
  hs: 'file-type-haskell',
  ml: 'file-type-ocaml',
  fs: 'file-type-fsharp',
  jl: 'file-type-julia',
  nim: 'file-type-nim',
  zig: 'file-type-zig',
  sol: 'file-type-solidity',

  // Shell / scripts
  sh: 'file-type-shell',
  bash: 'file-type-shell',
  zsh: 'file-type-shell',
  fish: 'file-type-shell',
  ps1: 'file-type-powershell',
  bat: 'file-type-bat',
  cmd: 'file-type-bat',

  // Databases
  sql: 'file-type-sql',
  prisma: 'file-type-prisma',
  db: 'file-type-db',
  sqlite: 'file-type-sqlite',

  // Docs / markup
  md: 'file-type-markdown',
  mdx: 'file-type-mdx',
  markdown: 'file-type-markdown',
  txt: 'file-type-text',
  rtf: 'file-type-text',
  pdf: 'file-type-pdf2',
  tex: 'file-type-tex',
  adoc: 'file-type-asciidoc',

  // Images / media
  png: 'file-type-image',
  jpg: 'file-type-image',
  jpeg: 'file-type-image',
  gif: 'file-type-image',
  webp: 'file-type-image',
  bmp: 'file-type-image',
  ico: 'file-type-favicon',
  avif: 'file-type-image',
  mp3: 'file-type-audio',
  wav: 'file-type-audio',
  mp4: 'file-type-video',
  mov: 'file-type-video',
  webm: 'file-type-video',

  // Fonts
  ttf: 'file-type-font',
  otf: 'file-type-font',
  woff: 'file-type-font',
  woff2: 'file-type-font',

  // Archives / binaries
  zip: 'file-type-zip',
  tar: 'file-type-zip',
  gz: 'file-type-zip',
  rar: 'file-type-zip',

  // Infra
  dockerfile: 'file-type-docker',
  tf: 'file-type-terraform',
  hcl: 'file-type-hashicorp',
  vue3: 'file-type-vue',
}

export const DEFAULT_FILE_ICON = 'default-file'
export const DEFAULT_FOLDER_ICON = 'default-folder'
export const DEFAULT_FOLDER_OPEN_ICON = 'default-folder-opened'

/**
 * Resolve the best vscode-icons icon name for a given file name.
 * Order: exact filename match → compound extension (e.g. .test.ts is handled by
 * extension) → single extension → generic fallback.
 */
export function getFileIconName(fileName: string): string {
  const lower = fileName.toLowerCase().trim()
  if (FILENAME_ICONS[lower]) return FILENAME_ICONS[lower]

  // Dotfiles with no extension (e.g. ".gitignore" handled above; ".foorc")
  const ext = lower.includes('.') ? lower.split('.').pop()! : ''
  if (ext && EXTENSION_ICONS[ext]) return EXTENSION_ICONS[ext]

  // Files literally named like an extension/tool (e.g. "Dockerfile")
  if (EXTENSION_ICONS[lower]) return EXTENSION_ICONS[lower]

  return DEFAULT_FILE_ICON
}
