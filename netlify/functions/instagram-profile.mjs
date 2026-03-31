const INSTAGRAM_HOST = 'www.instagram.com';
const BROWSER_HEADERS = {
  'user-agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'accept-language': 'en-US,en;q=0.9',
};

function parseInstagramInput(input) {
  const trimmed = String(input || '').trim();
  if (!trimmed) return null;

  const withoutAt = trimmed.replace(/^@+/, '');
  if (/^[a-zA-Z0-9._]{1,30}$/.test(withoutAt)) {
    return {
      handle: withoutAt,
      profileUrl: `https://${INSTAGRAM_HOST}/${withoutAt}/`,
    };
  }

  try {
    const candidate = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    if (!parsed.hostname.toLowerCase().includes('instagram.com')) return null;

    const segments = parsed.pathname.split('/').filter(Boolean);
    const [firstSegment, secondSegment] = segments;
    if (!firstSegment) return null;
    if ((firstSegment === 'p' || firstSegment === 'reel' || firstSegment === 'reels') && secondSegment) {
      return {
        kind: 'media',
        shortcode: secondSegment,
        mediaUrl: `https://${INSTAGRAM_HOST}/${firstSegment}/${secondSegment}/`,
      };
    }
    if (['stories', 'explore', 'accounts'].includes(firstSegment)) return null;
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(firstSegment)) return null;

    return {
      kind: 'profile',
      handle: firstSegment,
      profileUrl: `https://${INSTAGRAM_HOST}/${firstSegment}/`,
    };
  } catch {
    return null;
  }
}

function decodeHtml(value) {
  return value
    .replace(/&amp;/g, '&')
    .replace(/&#064;/g, '@')
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&#x2F;/g, '/')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractMeta(html, key, attr = 'property') {
  const metaTags = html.match(/<meta\b[^>]*>/gi) || [];

  for (const tag of metaTags) {
    const attrRegex = /([:@a-zA-Z0-9_-]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
    const attrs = {};
    let match;

    while ((match = attrRegex.exec(tag))) {
      attrs[match[1].toLowerCase()] = match[3] ?? match[4] ?? '';
    }

    if (attrs[attr] === key && attrs.content) {
      return decodeHtml(attrs.content);
    }
  }

  return null;
}

function extractJsonString(html, key) {
  const patterns = [
    new RegExp(`"${key}"\\s*:\\s*"([^"]+)"`, 'i'),
    new RegExp(`${key}\\\\?":\\\\?"([^"]+)`, 'i'),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) {
      return decodeHtml(match[1].replace(/\\u0026/g, '&').replace(/\\\//g, '/'));
    }
  }

  return null;
}

function extractDisplayName(ogTitle, handle) {
  if (!ogTitle) return handle;
  const match = ogTitle.match(/^(.*?)\s*\(@/);
  return match?.[1]?.trim() || handle;
}

function extractPostDisplayName(ogTitle, handle = '') {
  if (!ogTitle) return handle;
  const match = ogTitle.match(/^(.*?)\s+on\s+Instagram:/i);
  return match?.[1]?.trim() || handle;
}

function extractPostOwnerHandle(ogDescription) {
  if (!ogDescription) return '';
  const match = ogDescription.match(/-\s*([a-zA-Z0-9._]{1,30})\s+on\b/i);
  return match?.[1] || '';
}

function extractImageFromHtml(html, predicates = []) {
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];

  for (const tag of imgTags) {
    const srcMatch = tag.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i);
    const src = srcMatch?.[2] ?? srcMatch?.[3] ?? '';
    if (!src) continue;

    const normalizedSrc = decodeHtml(src);
    if (!normalizedSrc.startsWith('http')) continue;

    if (!predicates.length || predicates.some((predicate) => predicate(tag, normalizedSrc))) {
      return normalizedSrc;
    }
  }

  return null;
}

function extractBestMediaImageFromEmbed(html) {
  const imgTags = html.match(/<img\b[^>]*>/gi) || [];
  let best = null;

  for (const tag of imgTags) {
    const srcMatch = tag.match(/\bsrc\s*=\s*("([^"]*)"|'([^']*)')/i);
    const src = srcMatch?.[2] ?? srcMatch?.[3] ?? '';
    if (!src) continue;

    const normalizedSrc = decodeHtml(src);
    if (!normalizedSrc.startsWith('http')) continue;

    let score = 0;
    if (/profile_pic|s150x150|t51\.82787-19/i.test(normalizedSrc)) score -= 200;
    if (/t51\.82787-15|t51\.71878-15/i.test(normalizedSrc)) score += 40;
    if (/1440|1080|960|750|640|540|480|360|240/i.test(normalizedSrc)) score += 25;

    const widthMatch = tag.match(/\bwidth\s*=\s*("([^"]*)"|'([^']*)')/i);
    const width = Number(widthMatch?.[2] ?? widthMatch?.[3] ?? 0);
    if (width >= 300) score += 30;
    if (width >= 600) score += 40;

    if (!best || score > best.score) {
      best = { src: normalizedSrc, score };
    }
  }

  return best?.src || null;
}

async function fetchHtml(url, headers = {}) {
  const response = await fetch(url, {
    headers: {
      ...BROWSER_HEADERS,
      ...headers,
    },
  });

  if (!response.ok) {
    return {
      ok: false,
      status: response.status,
      url,
      html: '',
    };
  }

  return {
    ok: true,
    status: response.status,
    url,
    html: await response.text(),
  };
}

async function fetchPicukiProfile(handle) {
  const urls = [
    `https://picuki.io/profile/${encodeURIComponent(handle)}/`,
    `https://picuki.io/profile/${encodeURIComponent(handle)}`,
  ];

  for (const url of urls) {
    try {
      const result = await fetchHtml(url);
      if (!result.ok) {
        continue;
      }

      const { html } = result;
      const avatarUrl =
        extractMeta(html, 'og:image') ||
        extractMeta(html, 'twitter:image', 'name') ||
        extractJsonString(html, 'image') ||
        extractImageFromHtml(html, [
          (tag, src) =>
            /profile|avatar|photo|picture/i.test(tag) ||
            /cdninstagram|cdninstagramprofile|profile/i.test(src),
        ]);

      const title =
        extractMeta(html, 'og:title') ||
        extractMeta(html, 'twitter:title', 'name') ||
        extractJsonString(html, 'name');

      if (avatarUrl) {
        return {
          ok: true,
          source: 'picuki',
          handle,
          profileUrl: `https://${INSTAGRAM_HOST}/${handle}/`,
          displayName: extractDisplayName(title, handle),
          avatarUrl,
        };
      }
    } catch {
      // Try the next candidate URL.
    }
  }

  return {
    ok: false,
    source: 'picuki',
  };
}

async function fetchInstagramProfileJson(handle, profileUrl) {
         