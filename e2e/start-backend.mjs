// Starts the backend for the E2E run on its own database, rebuilt from scratch every time.
//   1. build the API into e2e/.backend (so a running dev API, which locks its own bin folder, is no problem)
//   2. drop + migrate + seed the E2E database (`--seed-only --reset`, Development only)
//   3. run the API on E2E_API_PORT
// Override with E2E_BACKEND_DIR (the backend's BE folder) and E2E_DB_CONNECTION.
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const here = path.dirname(fileURLToPath(import.meta.url))
const backendDir = process.env.E2E_BACKEND_DIR ?? path.resolve(here, '../../Self-Storage-Facility-BACKEND/BE')
const out = path.join(here, '.backend')
const port = process.env.E2E_API_PORT ?? '5208'
const env = {
  ...process.env,
  ASPNETCORE_ENVIRONMENT: 'Development',
  ConnectionStrings__DefaultConnection: process.env.E2E_DB_CONNECTION
    ?? 'Server=localhost\\SQLEXPRESS;Database=StorEase_E2E;Trusted_Connection=True;TrustServerCertificate=True;MultipleActiveResultSets=True',
  // Tests run billing on purpose (with a chosen date); the background job would race them.
  Billing__RunInBackground: 'false',
}

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, env, stdio: 'inherit', shell: process.platform === 'win32' })
  if (result.status !== 0) {
    console.error(`E2E backend: "${cmd} ${args.join(' ')}" failed.`)
    process.exit(result.status ?? 1)
  }
}

run('dotnet', ['build', path.join(backendDir, 'StorEase.Api'), '-nologo', '-v', 'q', '-o', out], backendDir)
run('dotnet', ['StorEase.Api.dll', '--seed-only', '--reset'], out)

const api = spawn('dotnet', ['StorEase.Api.dll', '--urls', `http://localhost:${port}`], { cwd: out, env, stdio: 'inherit', shell: process.platform === 'win32' })
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { api.kill(); process.exit(0) })
api.on('exit', (code) => process.exit(code ?? 0))
