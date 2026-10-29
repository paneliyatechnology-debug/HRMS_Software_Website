/**
 * Normalizes an avatar URL so that uploaded files store clean relative paths
 * (e.g., "/uploads/profiles/profile-user-123.jpg") instead of absolute localhost URLs.
 * External third-party URLs (such as Unsplash) and already-relative paths are preserved as-is.
 */
export function normalizeAvatarUrl(url?: string | null): string {
  if (!url) return '';
  const trimmed = url.trim();
  if (!trimmed) return '';

  const match = trimmed.match(/\/uploads\/profiles\/([^\s?#]+)/i);
  if (match) {
    return `/uploads/profiles/${match[1]}`;
  }
  return trimmed;
}

