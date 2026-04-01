import { copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import process from 'node:process';

export const ARCH_PACKAGE_NAME = 'agentsmith-desktop-bin';
export const ARCH_PACKAGE_RELEASE = '1';
export const APP_EXECUTABLE_NAME = 'agentsmith-desktop';
export const DESKTOP_ENTRY_NAME = 'agentsmith-desktop.desktop';
export const ICON_NAME = 'agentsmith-desktop.png';

export function readDesktopVersion(rootDir) {
  const packageJsonPath = join(rootDir, 'package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf8'));
  if (!packageJson.version || typeof packageJson.version !== 'string') {
    throw new Error('desktop_arch_package_version_missing');
  }
  return packageJson.version;
}

export function buildArchPkgbuild({ version }) {
  return `pkgname=${ARCH_PACKAGE_NAME}
pkgver=${version}
pkgrel=${ARCH_PACKAGE_RELEASE}
pkgdesc='AgentSmith Desktop internal pilot binary package'
arch=('x86_64')
url='https://github.com/lzjever/agentsmith-desktop'
license=('custom')
depends=('gtk3' 'webkit2gtk-4.1')
optdepends=('fuse3: local file-library mount support')
provides=('agentsmith-desktop')
conflicts=('agentsmith-desktop')
source=(
  '${APP_EXECUTABLE_NAME}'
  '${DESKTOP_ENTRY_NAME}'
  '${ICON_NAME}'
)
sha256sums=('SKIP' 'SKIP' 'SKIP')

package() {
  install -Dm755 "\${srcdir}/${APP_EXECUTABLE_NAME}" "\${pkgdir}/usr/bin/${APP_EXECUTABLE_NAME}"
  install -Dm644 "\${srcdir}/${DESKTOP_ENTRY_NAME}" "\${pkgdir}/usr/share/applications/${DESKTOP_ENTRY_NAME}"
  install -Dm644 "\${srcdir}/${ICON_NAME}" "\${pkgdir}/usr/share/icons/hicolor/128x128/apps/${ICON_NAME}"
}
`;
}

export function buildDesktopEntry() {
  return `[Desktop Entry]
Name=AgentSmith Desktop
Comment=Desktop companion app for AgentSmith local file-library mounts
Exec=${APP_EXECUTABLE_NAME}
Icon=agentsmith-desktop
Terminal=false
Type=Application
Categories=Utility;
StartupNotify=true
`;
}

export function resolveArchBuildPaths(rootDir) {
  return {
    rootDir,
    packagingDir: join(rootDir, 'packaging', 'arch'),
    outDir: join(rootDir, 'packaging', 'arch', 'out'),
    distDir: join(rootDir, 'packaging', 'arch', 'out', 'dist'),
    buildDir: join(rootDir, 'packaging', 'arch', 'out', 'build'),
    pkgbuildPath: join(rootDir, 'packaging', 'arch', 'PKGBUILD'),
    srcinfoPath: join(rootDir, 'packaging', 'arch', '.SRCINFO'),
    desktopEntryPath: join(rootDir, 'packaging', 'arch', DESKTOP_ENTRY_NAME),
    iconSourcePath: join(rootDir, 'src-tauri', 'icons', '128x128.png'),
    binarySourcePath: join(rootDir, 'src-tauri', 'target', 'release', APP_EXECUTABLE_NAME),
  };
}

function ensureParentDir(path) {
  mkdirSync(dirname(path), { recursive: true });
}

export function writeArchMetadata(rootDir) {
  const version = readDesktopVersion(rootDir);
  const paths = resolveArchBuildPaths(rootDir);
  const pkgbuild = buildArchPkgbuild({ version });
  const desktopEntry = buildDesktopEntry();

  ensureParentDir(paths.pkgbuildPath);
  writeFileSync(paths.pkgbuildPath, pkgbuild, 'utf8');
  writeFileSync(paths.desktopEntryPath, desktopEntry, 'utf8');

  try {
    const srcinfo = execFileSync('makepkg', ['--printsrcinfo', '-p', paths.pkgbuildPath], {
      cwd: paths.packagingDir,
      encoding: 'utf8',
    });
    writeFileSync(paths.srcinfoPath, srcinfo, 'utf8');
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ENOENT') {
      writeFileSync(
        paths.srcinfoPath,
        '# makepkg is not available on this machine. Regenerate .SRCINFO on Arch-based hosts.\n',
        'utf8',
      );
    } else {
      throw error;
    }
  }

  return { version, paths };
}

export function buildArchPackage(rootDir) {
  const { version, paths } = writeArchMetadata(rootDir);

  if (!existsSync(paths.binarySourcePath)) {
    throw new Error(`desktop_arch_binary_missing:${paths.binarySourcePath}`);
  }
  if (!existsSync(paths.iconSourcePath)) {
    throw new Error(`desktop_arch_icon_missing:${paths.iconSourcePath}`);
  }

  rmSync(paths.buildDir, { recursive: true, force: true });
  mkdirSync(paths.buildDir, { recursive: true });
  mkdirSync(paths.distDir, { recursive: true });

  copyFileSync(paths.pkgbuildPath, join(paths.buildDir, 'PKGBUILD'));
  copyFileSync(paths.desktopEntryPath, join(paths.buildDir, DESKTOP_ENTRY_NAME));
  copyFileSync(paths.iconSourcePath, join(paths.buildDir, ICON_NAME));
  copyFileSync(paths.binarySourcePath, join(paths.buildDir, APP_EXECUTABLE_NAME));

  execFileSync('makepkg', ['--nodeps', '--force', '--cleanbuild', '--nocheck'], {
    cwd: paths.buildDir,
    stdio: 'inherit',
  });

  const packageFiles = execFileSync('makepkg', ['--packagelist', '-p', join(paths.buildDir, 'PKGBUILD')], {
    cwd: paths.buildDir,
    encoding: 'utf8',
  })
    .trim()
    .split('\n')
    .filter(Boolean);

  for (const packageFile of packageFiles) {
    copyFileSync(packageFile, join(paths.distDir, packageFile.split('/').pop()));
  }

  return { version, paths, packageFiles };
}

function main(argv) {
  const command = argv[2] ?? 'metadata';
  const rootDir = resolve(new URL('..', import.meta.url).pathname);

  if (command === 'metadata') {
    const { version, paths } = writeArchMetadata(rootDir);
    console.log(`Generated Arch packaging metadata for ${version} at ${paths.packagingDir}`);
    return;
  }

  if (command === 'build') {
    const { packageFiles, paths } = buildArchPackage(rootDir);
    console.log(`Built Arch package artifacts in ${paths.distDir}`);
    for (const packageFile of packageFiles) {
      console.log(packageFile);
    }
    return;
  }

  throw new Error(`desktop_arch_unknown_command:${command}`);
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv);
}
