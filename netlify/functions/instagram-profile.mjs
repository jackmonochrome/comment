const INSTAGRAM_HOST = 'www.instagram.com';

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

    const [firstSegment] = parsed.pathname.split('/').filter(Boolean);
    if (!firstSegment) return null;
    if (['p', 'reel', 'reels', 'stories', 'explore', 'accounts'].includes(firstSegment)) {
      return null;
    }
    if (!/^[a-zA-Z0-9._]{1,30}$/.test(firstSegment)) return null;

    return {
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

async function fetchInstagramProfileJson(handle, profileUrl) {
  const response = await fetch(
    `https://www.instagram.com/api/v1/users/web_profile_info/?username=${encodeURIComponent(handle)}`,
    {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        accept: '*/*',
        'accept-language': 'en-US,en;q=0.9',
        'x-ig-app-id': '936619743392459',
        referer: profileUrl,
      },
    }
  );

  if (!response.ok) {
    return null;
  }

  const payload = await response.json();
  const user = payload?.data?.user;
  if (!user) {
    return null;
  }

  return {
    handle: user.username || handle,
    profileUrl,
    displayName: user.full_name || user.username || handle,
    avatarUrl: user.profile_pic_url_hd || user.profile_pic_url || null,
  };
}

function getInputFromRequest(request) {
  if (request?.queryStringParameters) {
    return request.queryStringParameters.input || request.queryStringParameters.username || '';
  }

  try {
    const url = new URL(request.url);
    return url.searchParams.get('input') || url.searchParams.get('username') || '';
  } catch {
    return '';
  }
}

export default async function handler(event) {
  try {
    const input = getInputFromRequest(event);
    const parsed = parseInstagramInput(input);

    if (!parsed) {
      return Response.json({ error: 'Invalid Instagram input' }, {
        status: 400,
        headers: {
          'cache-control': 'no-store',
        },
      });
    }

    const apiProfile = await fetchInstagramProfileJson(parsed.handle, parsed.profileUrl);
    if (apiProfile?.avatarUrl) {
      return Response.json(apiProfile, {
        status: 200,
        headers: {
          'cache-control': 'no-store',
        },
      });
    }

    const response = await fetch(parsed.profileUrl, {
      headers: {
        'user-agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        accept: 'text/html,application/xhtml+xml',
        'accept-language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      return Response.json({ error: 'Failed to fetch Instagram profile' }, {
        status: response.status,
        headers: {
          'cache-control': 'no-store',
        },
      });
    }

    const html = await response.text();
    const ogImage =
      extractMeta(html, 'og:image') ||
      extractMeta(html, 'twitter:image', 'name') ||
      extractJsonString(html, 'profile_pic_url') ||
      extractJsonString(html, 'profile_pic_url_hd');
    const ogTitle =
      extractMeta(html, 'og:title') ||
      extractMeta(html, 'twitter:title', 'name') ||
      extractJsonString(html, 'full_name');
    const displayName = extractDisplayName(ogTitle, parsed.handle);

    return Response.json({
      handle: parsed.handle,
      profileUrl: parsed.profileUrl,
      displayName,
      avatarUrl: ogImage,
    }, {
      status: 200,
      headers: {
        'cache-control': 'no-store',
      },
    });
  } catch (error) {
    return Response.json({
      error: error instanceof Error ? error.message : 'Unknown error',
    }, {
      status: 500,
      headers: {
        'cache-control': 'no-store',
      },
    });
  }
}
