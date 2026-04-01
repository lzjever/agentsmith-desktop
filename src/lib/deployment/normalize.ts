export function normalizeDeploymentBaseUrl(input: string): string {
  const raw = input.trim();
  if (!raw) {
    throw new Error('deployment_url_required');
  }
  const url = new URL(raw.includes('://') ? raw : `https://${raw}`);
  url.hash = '';
  url.search = '';
  url.pathname = '';
  return url.toString().replace(/\/+$/, '');
}
