#!/usr/bin/env node
import { migrationCandidates, runImageMigration } from '../server/product-image-migration.mjs'

const raw = process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1]
const limit = raw === 'all' ? 1000 : Math.max(1, Math.min(1000, Number(raw) || 10))
console.log(`External images remaining: ${migrationCandidates().length}`)
const result = await runImageMigration({ limit })
console.log(JSON.stringify(result, null, 2))
if (result.failed) process.exitCode = 1
