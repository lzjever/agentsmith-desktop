const RESERVED = new Set(['A', 'B']);

export function allocateDriveLetter(usedLetters: string[]): string | null {
  const used = new Set(usedLetters.map((value) => value.trim().toUpperCase()));
  for (let code = 'Z'.charCodeAt(0); code >= 'D'.charCodeAt(0); code -= 1) {
    const letter = String.fromCharCode(code);
    if (RESERVED.has(letter)) continue;
    if (used.has(letter)) continue;
    return letter;
  }
  return null;
}
