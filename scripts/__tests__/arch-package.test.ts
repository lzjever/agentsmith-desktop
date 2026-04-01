import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, normalize } from 'node:path';
import { tmpdir } from 'node:os';
import { afterEach, describe, expect, it } from 'vitest';

import {
  APP_EXECUTABLE_NAME,
  ARCH_PACKAGE_NAME,
  ARCH_PACKAGE_RELEASE,
  DESKTOP_ENTRY_NAME,
  buildArchPkgbuild,
  buildDesktopEntry,
  resolveArchBuildPaths,
  writeArchMetadata,
} from '../arch-package.js';

const tempDirs = [];

function createTempRepo() {
  const dir = mkdtempSync(join(tmpdir(), 'agentsmith-desktop-arch-'));
  tempDirs.push(dir);
  writeFileSync(join(dir, 'package.json'), JSON.stringify({ version: '0.1.0' }), 'utf8');
  return dir;
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
  }
});

describe('arch package helpers', () => {
  it('builds a PKGBUILD with the expected package metadata', () => {
    const pkgbuild = buildArchPkgbuild({ version: '0.1.0' });

    expect(pkgbuild).toContain(`pkgname=${ARCH_PACKAGE_NAME}`);
    expect(pkgbuild).toContain('pkgver=0.1.0');
    expect(pkgbuild).toContain(`pkgrel=${ARCH_PACKAGE_RELEASE}`);
    expect(pkgbuild).toContain("provides=('agentsmith-desktop')");
    expect(pkgbuild).toContain(`install -Dm755 "\${srcdir}/${APP_EXECUTABLE_NAME}" "\${pkgdir}/usr/bin/${APP_EXECUTABLE_NAME}"`);
  });

  it('builds a desktop entry that launches the desktop app by its packaged binary name', () => {
    const desktopEntry = buildDesktopEntry();

    expect(desktopEntry).toContain(`Exec=${APP_EXECUTABLE_NAME}`);
    expect(desktopEntry).toContain(`Icon=${ARCH_PACKAGE_NAME.replace(/-bin$/, '')}`);
    expect(desktopEntry).toContain('Type=Application');
  });

  it('writes PKGBUILD, desktop entry, and fallback SRCINFO when makepkg is unavailable', () => {
    const repoDir = createTempRepo();
    const originalPath = process.env.PATH;
    process.env.PATH = '';

    try {
      const { paths } = writeArchMetadata(repoDir);

      const pkgbuild = readFileSync(paths.pkgbuildPath, 'utf8');
      const srcinfo = readFileSync(paths.srcinfoPath, 'utf8');
      const desktopEntry = readFileSync(paths.desktopEntryPath, 'utf8');

      expect(pkgbuild).toContain('pkgver=0.1.0');
      expect(srcinfo).toContain('makepkg is not available');
      expect(desktopEntry).toContain(`Exec=${APP_EXECUTABLE_NAME}`);
    } finally {
      process.env.PATH = originalPath;
    }
  });

  it('resolves packaging paths under packaging/arch', () => {
    const paths = resolveArchBuildPaths('/tmp/example');

    expect(paths.pkgbuildPath).toBe(normalize('/tmp/example/packaging/arch/PKGBUILD'));
    expect(paths.desktopEntryPath).toBe(normalize(`/tmp/example/packaging/arch/${DESKTOP_ENTRY_NAME}`));
    expect(paths.binarySourcePath).toBe(normalize(`/tmp/example/src-tauri/target/release/${APP_EXECUTABLE_NAME}`));
  });
});
