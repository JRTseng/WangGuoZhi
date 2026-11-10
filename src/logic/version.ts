/**
 * 組出畫面上顯示的版本字串。
 * 例：formatVersion('0.1.0', 'a1b2c3d') → 'v0.1.0+a1b2c3d'
 * 沒有 git hash（例如不在 git repo 裡建置）時只顯示版本號。
 */
export function formatVersion(version: string, gitHash?: string | null): string {
  const v = version.trim() || '0.0.0';
  const hash = gitHash?.trim();
  return hash ? `v${v}+${hash}` : `v${v}`;
}
