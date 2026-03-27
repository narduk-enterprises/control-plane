#!/usr/bin/env -S pnpm exec tsx

import { copyFile, mkdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

type RootPackageJson = {
  pnpm?: {
    patchedDependencies?: Record<string, string>
  }
}

function getArg(name: string): string {
  const prefix = `${name}=`
  const value = process.argv.find((arg) => arg.startsWith(prefix))?.slice(prefix.length)
  if (!value) {
    throw new Error(`Missing required argument: ${name}`)
  }
  return path.resolve(value)
}

function ensureInsideRoot(rootDir: string, filePath: string): string {
  const relativePath = path.relative(rootDir, filePath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error(`Resolved path escapes root ${rootDir}: ${filePath}`)
  }
  return filePath
}

async function pathExists(filePath: string): Promise<boolean> {
  try {
    await stat(filePath)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return false
    }
    throw error
  }
}

async function readPatchedDependencyPaths(rootDir: string): Promise<string[]> {
  const packageJsonPath = path.join(rootDir, 'package.json')
  const packageJson = JSON.parse(await readFile(packageJsonPath, 'utf8')) as RootPackageJson
  return Object.values(packageJson.pnpm?.patchedDependencies || {})
}

async function main() {
  const sourceDir = getArg('--source-dir')
  const targetDir = getArg('--target-dir')

  const patchPaths = new Set([
    ...(await readPatchedDependencyPaths(sourceDir)),
    ...(await readPatchedDependencyPaths(targetDir)),
  ])

  if (patchPaths.size === 0) {
    console.log('No pnpm patchedDependencies found; nothing to sync.')
    return
  }

  const syncedPaths: string[] = []

  for (const relativePatchPath of patchPaths) {
    if (path.isAbsolute(relativePatchPath)) {
      throw new Error(`patchedDependencies entries must be repo-relative: ${relativePatchPath}`)
    }

    const sourcePath = ensureInsideRoot(sourceDir, path.resolve(sourceDir, relativePatchPath))
    const targetPath = ensureInsideRoot(targetDir, path.resolve(targetDir, relativePatchPath))

    if (!(await pathExists(sourcePath))) {
      throw new Error(
        `Referenced pnpm patch file is missing from source export: ${relativePatchPath}`,
      )
    }

    await mkdir(path.dirname(targetPath), { recursive: true })
    await copyFile(sourcePath, targetPath)
    syncedPaths.push(relativePatchPath)
  }

  console.log(`Synced ${syncedPaths.length} pnpm patch file(s) into ${targetDir}`)
  for (const relativePath of syncedPaths) {
    console.log(`- ${relativePath}`)
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
