import { useEffect, useMemo, useRef, useState } from 'react';
import { Heart, Download, ExternalLink, Upload, Globe } from 'lucide-react';
import { toPng } from 'html-to-image';
import { ImageWithFallback } from './figma/ImageWithFallback';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Textarea } from './ui/textarea';
import { Label } from './ui/label';
import { VerifiedBadge } from './VerifiedBadge';

type SupportedLanguage = 'en' | 'ru' | 'es' | 'fr' | 'de';

interface CommentData {
  instagramUrl: string;
  username: string;
  isVerified: boolean;
  timeAgo: string;
  commentText: string;
  likes: number;
  avatarUrl: string;
}

const INSTAGRAM_URL = 'https://www.instagram.com/wdmchk/';
const DEMO_INSTAGRAM_ACCOUNT = 'https://www.instagram.com/ladygaga';
const AVATAR_CACHE_KEY = 'commentmaker-avatar-cache-v1';

const LANGUAGE_OPTIONS: Array<{ value: SupportedLanguage; label: string }> = [
  { value: 'en', label: 'English' },
  { value: 'ru', label: 'Русский' },
  { value: 'es', label: 'Español' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
];

const TRANSLATIONS: Record<
  SupportedLanguage,
  {
    editMode: string;
    exportPng: string;
    exporting: string;
    uploadAvatar: string;
    uploadAnotherAvatar: string;
    avatarUrl: string;
    applyAvatarUrl: string;
    instagramHint: string;
    username: string;
    verified: string;
    time: string;
    comment: string;
    likes: string;
    reply: string;
    developedBy: string;
    language: string;
  }
> = {
  en: {
    editMode: 'Edit mode',
    exportPng: 'Export PNG',
    exporting: 'Exporting...',
    uploadAvatar: 'Upload avatar',
    uploadAnotherAvatar: 'Upload another avatar',
    avatarUrl: 'Instagram account',
    applyAvatarUrl: 'Apply',
    instagramHint: '(auto)',
    username: 'Username',
    verified: 'Verified account',
    time: 'Time',
    comment: 'Comment text',
    likes: 'Likes',
    reply: 'Reply',
    developedBy: 'Developed by',
    language: 'Language',
  },
  ru: {
    editMode: 'Режим редактирования',
    exportPng: 'Export PNG',
    exporting: 'Экспорт...',
    uploadAvatar: 'Загрузить аватар',
    uploadAnotherAvatar: 'Загрузить другую аватарку',
    avatarUrl: 'Instagram аккаунт',
    applyAvatarUrl: 'Применить',
    instagramHint: '(авто)',
    username: 'Имя пользователя',
    verified: 'Верифицированный аккаунт',
    time: 'Время',
    comment: 'Текст комментария',
    likes: 'Количество лайков',
    reply: 'Ответить',
    developedBy: 'Разработал',
    language: 'Язык',
  },
  es: {
    editMode: 'Modo de edicion',
    exportPng: 'Export PNG',
    exporting: 'Exportando...',
    uploadAvatar: 'Subir avatar',
    uploadAnotherAvatar: 'Subir otro avatar',
    avatarUrl: 'Cuenta de Instagram',
    applyAvatarUrl: 'Aplicar',
    instagramHint: '(auto)',
    username: 'Nombre de usuario',
    verified: 'Cuenta verificada',
    time: 'Tiempo',
    comment: 'Texto del comentario',
    likes: 'Me gusta',
    reply: 'Responder',
    developedBy: 'Desarrollado por',
    language: 'Idioma',
  },
  fr: {
    editMode: 'Mode edition',
    exportPng: 'Export PNG',
    exporting: 'Export...',
    uploadAvatar: 'Telecharger un avatar',
    uploadAnotherAvatar: 'Telecharger un autre avatar',
    avatarUrl: 'Compte Instagram',
    applyAvatarUrl: 'Appliquer',
    instagramHint: '(auto)',
    username: "Nom d'utilisateur",
    verified: 'Compte verifie',
    time: 'Temps',
    comment: 'Texte du commentaire',
    likes: 'Likes',
    reply: 'Repondre',
    developedBy: 'Developpe par',
    language: 'Langue',
  },
  de: {
    editMode: 'Bearbeitungsmodus',
    exportPng: 'Export PNG',
    exporting: 'Exportiere...',
    uploadAvatar: 'Avatar hochladen',
    uploadAnotherAvatar: 'Anderes Avatar hochladen',
    avatarUrl: 'Instagram-Konto',
    applyAvatarUrl: 'Anwenden',
    instagramHint: '(auto)',
    username: 'Benutzername',
    verified: 'Verifiziertes Konto',
    time: 'Zeit',
    comment: 'Kommentartext',
    likes: 'Likes',
    reply: 'Antworten',
    developedBy: 'Entwickelt von',
    language: 'Sprache',
  },
};

function detectLanguage(): SupportedLanguage {
  if (typeof navigator === 'undefined') {
    return 'en';
  }

  const candidates = [...(navigator.languages || []), navigator.language]
    .filter(Boolean)
    .map((lang) => lang.toLowerCase());

  for (const candidate of candidates) {
    if (candidate.startsWith('ru')) return 'ru';
    if (candidate.startsWith('es')) return 'es';
    if (candidate.startsWith('fr')) return 'fr';
    if (candidate.startsWith('de')) return 'de';
    if (candidate.startsWith('en')) return 'en';
  }

  return 'en';
}

function defaultTimeAgo(language: SupportedLanguage): string {
  switch (language) {
    case 'ru':
      return '2 дн.';
    case 'es':
      return '2 d.';
    case 'fr':
      return 'il y a 2 j';
    case 'de':
      return 'vor 2 T.';
    default:
      return '2d';
  }
}

async function toDataUrlFromRemoteUrl(url: string): Promise<string> {
  const response = await fetch(url, { mode: 'cors' });
  if (!response.ok) {
    throw new Error('Failed to fetch image');
  }

  const blob = await response.blob();
  return await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to convert image'));
    reader.readAsDataURL(blob);
  });
}

function proxyAvatarUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed || trimmed.startsWith('data:') || trimmed.startsWith('blob:')) {
    return trimmed;
  }

  try {
    const parsed = new URL(trimmed);
    const cleanUrl = `${parsed.host}${parsed.pathname}${parsed.search}`;
    return `https://images.weserv.nl/?url=${encodeURIComponent(cleanUrl)}&w=512&h=512&fit=cover&output=jpg`;
  } catch {
    return trimmed;
  }
}

function parseInstagramInput(input: string): { handle: string; profileUrl: string; fromUrl: boolean } | null {
  const trimmed = input.trim();
  if (!trimmed) return null;

  const withoutAt = trimmed.replace(/^@+/, '');
  if (/^[a-zA-Z0-9._]{1,30}$/.test(withoutAt)) {
    return {
      handle: withoutAt,
      profileUrl: buildInstagramProfileUrl(withoutAt),
      fromUrl: false,
    };
  }

  try {
    const candidate = trimmed.startsWith('http') ? trimmed : `https://${trimmed}`;
    const parsed = new URL(candidate);
    const hostname = parsed.hostname.toLowerCase();
    if (!hostname.includes('instagram.com')) return null;

    const [firstSegment] = parsed.pathname.split('/').filter(Boolean);
    if (!firstSegment) return null;
    if (['p', 'reel', 'reels', 'stories', 'explore', 'accounts'].includes(firstSegment)) {
      return null;
    }

    if (!/^[a-zA-Z0-9._]{1,30}$/.test(firstSegment)) {
      return null;
    }

    const normalizedPath = `/${firstSegment}/`;
    const profileUrl = `${parsed.protocol}//${parsed.host}${normalizedPath}`;
    return {
      handle: firstSegment,
      profileUrl,
      fromUrl: true,
    };
  } catch {
    return null;
  }
}

function buildInstagramProfileUrl(handle: string): string {
  return `https://www.instagram.com/${handle}/`;
}

function buildInstagramAvatarUrl(handle: string): string {
  return '';
}

function readAvatarCache(): Record<string, string> {
  if (typeof window === 'undefined') return {};

  try {
    const raw = window.localStorage.getItem(AVATAR_CACHE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function writeAvatarCache(cache: Record<string, string>) {
  if (typeof window === 'undefined') return;

  try {
    window.localStorage.setItem(AVATAR_CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Ignore localStorage write failures.
  }
}

function getCachedAvatar(handle: string): string | null {
  const cache = readAvatarCache();
  return cache[handle.toLowerCase()] || null;
}

function cacheAvatar(handle: string, avatarUrl: string) {
  if (!handle || !avatarUrl) return;
  const cache = readAvatarCache();
  cache[handle.toLowerCase()] = avatarUrl;
  writeAvatarCache(cache);
}

async function fetchInstagramProfile(input: string): Promise<{
  handle: string;
  profileUrl: string;
  displayName?: string;
  avatarUrl?: string;
} | null> {
  const response = await fetch(
    `/.netlify/functions/instagram-profile?input=${encodeURIComponent(input)}&t=${Date.now()}`
  );

  if (!response.ok) {
    return null;
  }

  return await response.json();
}

function wrapCanvasText(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let currentLine = '';

  for (const word of words) {
    const nextLine = currentLine ? `${currentLine} ${word}` : word;
    if (ctx.measureText(nextLine).width <= maxWidth) {
      currentLine = nextLine;
    } else {
      if (currentLine) lines.push(currentLine);
      currentLine = word;
    }
  }

  if (currentLine) lines.push(currentLine);
  return lines.length ? lines : [''];
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function drawHeartIcon(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  const topCurveHeight = size * 0.3;
  ctx.beginPath();
  ctx.moveTo(x + size / 2, y + size);
  ctx.bezierCurveTo(x + size / 2, y + size * 0.78, x, y + size * 0.58, x, y + topCurveHeight);
  ctx.bezierCurveTo(x, y, x + size * 0.25, y, x + size / 2, y + topCurveHeight);
  ctx.bezierCurveTo(x + size * 0.75, y, x + size, y, x + size, y + topCurveHeight);
  ctx.bezierCurveTo(x + size, y + size * 0.58, x + size / 2, y + size * 0.78, x + size / 2, y + size);
  ctx.stroke();
}

async function loadImageElement(src: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    if (!src.startsWith('data:') && !src.startsWith('blob:')) {
      image.crossOrigin = 'anonymous';
    }
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Image failed to load'));
    image.src = src;
  });
}

function drawCoverImage(
  ctx: CanvasRenderingContext2D,
  image: CanvasImageSource,
  dx: number,
  dy: number,
  dWidth: number,
  dHeight: number,
  sWidth: number,
  sHeight: number
) {
  const scale = Math.max(dWidth / sWidth, dHeight / sHeight);
  const cropWidth = dWidth / scale;
  const cropHeight = dHeight / scale;
  const sx = Math.max(0, (sWidth - cropWidth) / 2);
  const sy = Math.max(0, (sHeight - cropHeight) / 2);
  ctx.drawImage(image, sx, sy, cropWidth, cropHeight, dx, dy, dWidth, dHeight);
}

async function exportCommentCardPng(
  data: CommentData,
  isLiked: boolean,
  replyLabel: string,
  isMobile: boolean,
  squareCorners = false
): Promise<File> {
  const scale = 2;
  const width = isMobile ? 356 : 624;
  const padding = isMobile ? 16 : 24;
  const avatarSize = isMobile ? 52 : 64;
  const gap = isMobile ? 12 : 16;
  const rightColumn = isMobile ? 32 : 44;
  const contentWidth = width - padding * 2 - avatarSize - gap - rightColumn;

  const measureCanvas = document.createElement('canvas');
  const measureCtx = measureCanvas.getContext('2d');
  if (!measureCtx) {
    throw new Error('Canvas is unavailable');
  }

  const usernameFont = isMobile ? '500 15px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' : '500 16px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const metaFont = isMobile ? '400 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' : '400 16px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const commentFont = isMobile ? '400 14px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' : '400 18px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  const replyFont = isMobile ? '400 14px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' : '400 16px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  measureCtx.font = commentFont;
  const lines = wrapCanvasText(measureCtx, data.commentText, contentWidth);

  const lineHeight = isMobile ? 20 : 26;
  const headerHeight = isMobile ? 16 : 20;
  const replyHeight = isMobile ? 16 : 20;
  const commentHeight = lines.length * lineHeight;
  const bodyHeight = headerHeight + (isMobile ? 8 : 10) + commentHeight + (isMobile ? 14 : 18) + replyHeight;
  const innerHeight = Math.max(avatarSize, bodyHeight);
  const height = padding * 2 + innerHeight;

  const canvas = document.createElement('canvas');
  canvas.width = width * scale;
  canvas.height = height * scale;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('Canvas is unavailable');
  }

  ctx.scale(scale, scale);
  ctx.clearRect(0, 0, width, height);

  if (squareCorners) {
    ctx.beginPath();
    ctx.rect(0, 0, width, height);
    ctx.closePath();
  } else {
    drawRoundedRect(ctx, 0, 0, width, height, 28);
  }
  ctx.fillStyle = 'rgb(24, 24, 27)';
  ctx.fill();

  try {
    const avatar = await loadImageElement(data.avatarUrl);
    ctx.save();
    ctx.beginPath();
    ctx.arc(padding + avatarSize / 2, padding + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    drawCoverImage(
      ctx,
      avatar,
      padding,
      padding,
      avatarSize,
      avatarSize,
      avatar.naturalWidth || avatar.width,
      avatar.naturalHeight || avatar.height
    );
    ctx.restore();
  } catch {
    ctx.save();
    ctx.beginPath();
    ctx.arc(padding + avatarSize / 2, padding + avatarSize / 2, avatarSize / 2, 0, Math.PI * 2);
    ctx.closePath();
    ctx.fillStyle = '#3f3f46';
    ctx.fill();
    ctx.restore();
  }

  const contentX = padding + avatarSize + gap;
  const contentY = padding;
  const rightX = width - padding - rightColumn;

  ctx.textBaseline = 'top';

  ctx.font = usernameFont;
  ctx.fillStyle = '#ffffff';
  ctx.fillText(data.username, contentX, contentY);
  const usernameWidth = ctx.measureText(data.username).width;

  let timeX = contentX + usernameWidth + (isMobile ? 8 : 10);
  if (data.isVerified) {
    const badgeX = contentX + usernameWidth + 8;
    const badgeSize = isMobile ? 14 : 14;
    const badgeY = contentY + (isMobile ? 1 : 2);
    ctx.beginPath();
    ctx.arc(badgeX + badgeSize / 2, badgeY + badgeSize / 2, badgeSize / 2, 0, Math.PI * 2);
    ctx.fillStyle = '#5B9FED';
    ctx.fill();
    ctx.strokeStyle = '#18181B';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(badgeX + 4.5, badgeY + 7.5);
    ctx.lineTo(badgeX + 6.2, badgeY + 9.2);
    ctx.lineTo(badgeX + 9.8, badgeY + 5.3);
    ctx.stroke();
    timeX = badgeX + badgeSize + (isMobile ? 6 : 6);
  }

  ctx.font = metaFont;
  ctx.fillStyle = '#a1a1aa';
  ctx.fillText(data.timeAgo, timeX, contentY);

  ctx.font = commentFont;
  ctx.fillStyle = '#ffffff';
  lines.forEach((line, index) => {
    ctx.fillText(line, contentX, contentY + (isMobile ? 24 : 30) + index * lineHeight);
  });

  ctx.font = replyFont;
  ctx.fillStyle = '#a1a1aa';
  ctx.fillText(replyLabel, contentX, contentY + (isMobile ? 24 : 30) + commentHeight + (isMobile ? 14 : 18));

  ctx.strokeStyle = isLiked ? '#ef4444' : '#a1a1aa';
  ctx.lineWidth = 2;
  const heartSize = isMobile ? 16 : 22;
  const heartX = rightX + (isMobile ? 8 : 10);
  const heartY = contentY + (isMobile ? 2 : 2);
  drawHeartIcon(ctx, heartX, heartY, heartSize);
  if (isLiked) {
    ctx.fillStyle = '#ef4444';
    drawHeartIcon(ctx, heartX, heartY, heartSize);
    ctx.fill();
  }

  ctx.font = isMobile
    ? '400 11px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
    : '400 14px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
  ctx.fillStyle = '#e4e4e7';
  ctx.textAlign = 'center';
  ctx.fillText(String(data.likes), rightX + (isMobile ? 16 : 21), contentY + (isMobile ? 24 : 34));
  ctx.textAlign = 'start';

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
  if (!blob) {
    throw new Error('Failed to create PNG');
  }

  return new File([blob], `${data.username || 'comment'}-comment.png`, {
    type: 'image/png',
  });
}

export function EditableComment() {
  const [language, setLanguage] = useState<SupportedLanguage>('en');
  const [isLiked, setIsLiked] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const mobilePreviewRef = useRef<HTMLDivElement>(null);
  const mobileCardRef = useRef<HTMLDivElement>(null);
  const exportDesktopRef = useRef<HTMLDivElement>(null);
  const exportMobileRef = useRef<HTMLDivElement>(null);
  const [avatarUrlDraft, setAvatarUrlDraft] = useState(DEMO_INSTAGRAM_ACCOUNT);
  const [avatarRenderUrl, setAvatarRenderUrl] = useState('');
  const [mobileCardHeight, setMobileCardHeight] = useState(0);
  const [mobileCardWidth, setMobileCardWidth] = useState(0);
  const isMobileViewport =
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 640px)').matches : false;
  const [data, setData] = useState<CommentData>({
    instagramUrl: INSTAGRAM_URL,
    username: 'Lady Gaga',
    isVerified: true,
    timeAgo: defaultTimeAgo('en'),
    commentText: 'I really love your content. Please post more.',
    likes: 777,
    avatarUrl: proxyAvatarUrl(
      'https://images.unsplash.com/photo-1614283233556-f35b0c801ef1?crop=entropy&cs=tinysrgb&fit=max&fm=jpg&ixid=M3w3Nzg4Nzd8MHwxfHNlYXJjaHwxfHxwcm9maWxlJTIwcG9ydHJhaXR8ZW58MXx8fHwxNzc0ODQ3ODgxfDA&ixlib=rb-4.1.0&q=80&w=1080&utm_source=figma&utm_medium=referral'
    ),
  });

  useEffect(() => {
    const detected = detectLanguage();
    setLanguage(detected);
    setData((prev) => ({ ...prev, timeAgo: defaultTimeAgo(detected) }));
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const params = new URLSearchParams(window.location.search);
    const instagramUrl =
      params.get('ig') || params.get('instagram') || params.get('instagramUrl') || '';
    const avatarUrl = params.get('avatar') || params.get('avatarUrl') || '';
    const username = params.get('username') || params.get('name') || '';

    if (!instagramUrl && !avatarUrl && !username) {
      return;
    }

    const parsedInstagram = instagramUrl ? parseInstagramInput(instagramUrl) : null;
    const normalizedInstagramUrl = parsedInstagram?.profileUrl || instagramUrl || data.instagramUrl;

    setData((prev) => ({
      ...prev,
      instagramUrl: normalizedInstagramUrl,
      username: username || parsedInstagram?.handle || prev.username,
      avatarUrl: avatarUrl ? proxyAvatarUrl(avatarUrl) : prev.avatarUrl,
    }));

    if (instagramUrl) {
      setAvatarUrlDraft(normalizedInstagramUrl);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    if (!data.avatarUrl) {
      setAvatarRenderUrl('');
      return;
    }

    if (data.avatarUrl.startsWith('data:') || data.avatarUrl.startsWith('blob:')) {
      setAvatarRenderUrl(data.avatarUrl);
      return;
    }

    toDataUrlFromRemoteUrl(data.avatarUrl)
      .then((result) => {
        if (!cancelled) {
          setAvatarRenderUrl(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setAvatarRenderUrl(data.avatarUrl);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [data.avatarUrl]);

  useEffect(() => {
    if (!mobileCardRef.current) return;
    const element = mobileCardRef.current;
    const updateSize = () => {
      setMobileCardHeight(element.offsetHeight);
      setMobileCardWidth(element.offsetWidth);
    };
    updateSize();

    const observer = new ResizeObserver(updateSize);
    observer.observe(element);
    return () => observer.disconnect();
  }, [data, isLiked, language]);

  const t = useMemo(() => TRANSLATIONS[language], [language]);

  const handleLike = () => {
    setIsLiked((prevLiked) => {
      setData((prevData) => ({
        ...prevData,
        likes: prevLiked ? prevData.likes - 1 : prevData.likes + 1,
      }));
      return !prevLiked;
    });
  };

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        const nextAvatar = reader.result as string;
        setData((prev) => ({ ...prev, avatarUrl: nextAvatar }));

        const currentHandle =
          parseInstagramInput(avatarUrlDraft)?.handle || parseInstagramInput(data.instagramUrl)?.handle;
        if (currentHandle) {
          cacheAvatar(currentHandle, nextAvatar);
        }
      };
      reader.readAsDataURL(file);
    }
  };

  const applyAvatarUrl = async () => {
    const trimmed = avatarUrlDraft.trim();
    if (!trimmed) return;

    const instagramInput = parseInstagramInput(trimmed);
    if (instagramInput) {
      const profile = await fetchInstagramProfile(trimmed).catch(() => null);
      const resolvedAvatar = profile?.avatarUrl || getCachedAvatar(instagramInput.handle);

      setData((prev) => ({
        ...prev,
        instagramUrl: profile?.profileUrl || instagramInput.profileUrl,
        username: profile?.displayName || profile?.handle || instagramInput.handle,
        avatarUrl: resolvedAvatar || prev.avatarUrl,
      }));

      if (profile?.avatarUrl) {
        cacheAvatar(instagramInput.handle, profile.avatarUrl);
      }

      setAvatarUrlDraft(profile?.profileUrl || instagramInput.profileUrl);
      return;
    }

    try {
      setData((prev) => ({ ...prev, avatarUrl: proxyAvatarUrl(trimmed) }));
      setAvatarUrlDraft(trimmed);
    } catch {
      try {
        const parsed = new URL(trimmed);
        parsed.searchParams.set('cb', Date.now().toString());
        setData((prev) => ({ ...prev, avatarUrl: proxyAvatarUrl(parsed.toString()) }));
        setAvatarUrlDraft(parsed.toString());
      } catch {
        setData((prev) => ({ ...prev, avatarUrl: trimmed }));
        setAvatarUrlDraft(trimmed);
      }
    }
  };

  const handleExportPng = async () => {
    try {
      setIsExporting(true);
      const exportData = {
        ...data,
        avatarUrl: avatarRenderUrl || data.avatarUrl,
      };

      const canUseShareSheet =
        isMobileViewport &&
        typeof navigator !== 'undefined' &&
        'share' in navigator &&
        'canShare' in navigator;

      if (canUseShareSheet) {
        const file = await exportCommentCardPng(exportData, isLiked, t.reply, false, true);
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `${data.username || 'comment'} comment`,
          });
          return;
        }
      }

      const exportTarget = exportDesktopRef.current;
      if (!exportTarget) return;
      const dataUrl = await toPng(exportTarget, {
        cacheBust: true,
        pixelRatio: 2,
        backgroundColor: 'transparent',
      });

      const link = document.createElement('a');
      link.download = `${data.username || 'comment'}-comment.png`;
      link.href = dataUrl;
      link.click();
    } finally {
      setIsExporting(false);
    }
  };

  const mobileScale = isMobileViewport ? 0.5 : 1;

  const renderCommentCard = (withShadow: boolean) => (
    <div
      className={`w-[624px] rounded-[32px] bg-zinc-900 p-6 text-white ${withShadow ? 'shadow-[0_24px_60px_rgba(24,24,27,0.18)]' : ''}`}
    >
      <div className="flex gap-4">
        <div className="shrink-0">
          <ImageWithFallback
            key={avatarRenderUrl || data.avatarUrl}
            src={avatarRenderUrl || data.avatarUrl}
            alt={data.username}
            className="h-16 w-16 rounded-full object-cover"
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center gap-2">
            <span className="truncate text-base font-medium leading-none text-white">{data.username}</span>
            {data.isVerified && <VerifiedBadge className="h-5 w-5 shrink-0" />}
            <span className="shrink-0 text-base text-zinc-400">{data.timeAgo}</span>
          </div>

          <p className="mb-4 text-lg leading-relaxed text-white">{data.commentText}</p>

          <button className="text-base text-zinc-400">{t.reply}</button>
        </div>

        <div className="flex shrink-0 flex-col items-center gap-1.5 pt-3">
          <button onClick={handleLike} className="transition-all hover:scale-110">
            <Heart
              className={`h-6 w-6 ${
                isLiked ? 'fill-red-500 text-red-500' : 'text-zinc-400 hover:text-red-400'
              }`}
            />
          </button>
          <span className="text-sm text-zinc-200">{data.likes}</span>
        </div>
      </div>
    </div>
  );

  const commentCard = renderCommentCard(true);
  const exportCard = renderCommentCard(false);

  return (
    <div className="mx-auto flex min-h-[100svh] w-full max-w-[420px] flex-col justify-center px-3 py-1 sm:min-h-0 sm:max-w-2xl sm:px-6 sm:pb-6 sm:pt-1">
      <div className="mb-2 flex items-center justify-between gap-2 text-[10px] text-zinc-400 sm:mb-4 sm:text-sm">
        <a
          className="inline-flex min-w-0 items-center gap-1 truncate text-zinc-400 transition-colors hover:text-zinc-600"
          href={data.instagramUrl}
          target="_blank"
          rel="noreferrer"
        >
          <span className="truncate tracking-normal">
            {t.developedBy} <span className="font-medium uppercase tracking-[0.24em]">WDMCHK</span>
          </span>
          <ExternalLink className="h-3 w-3 opacity-40" />
        </a>

        <div className="flex shrink-0 items-center gap-1 rounded-full border border-zinc-200 bg-white/80 px-2 py-1 text-[10px] text-zinc-500 sm:gap-2 sm:px-3 sm:py-1.5 sm:text-xs">
          <Globe className="h-3 w-3 sm:h-3.5 sm:w-3.5" />
          <span className="hidden sm:inline">{t.language}</span>
          <select
            className="bg-transparent text-zinc-600 outline-none"
            value={language}
            onChange={(e) => {
              const nextLanguage = e.target.value as SupportedLanguage;
              setLanguage(nextLanguage);
              setData((prev) => ({ ...prev, timeAgo: defaultTimeAgo(nextLanguage) }));
            }}
          >
            {LANGUAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:gap-6">
        <div className="order-1">
          <div className="hidden sm:block">{commentCard}</div>
          <div
            ref={mobilePreviewRef}
            className="mx-auto sm:hidden"
            style={{
              width: mobileCardWidth ? Math.ceil(mobileCardWidth * mobileScale) : 337,
              height: mobileCardHeight ? Math.ceil(mobileCardHeight * mobileScale) : 220,
            }}
          >
            <div
              ref={mobileCardRef}
              className="origin-top-left"
              style={{ transform: `scale(${mobileScale})`, width: '624px' }}
            >
              {commentCard}
            </div>
          </div>
        </div>

        <div className="order-2 mb-1 space-y-3 rounded-lg border border-zinc-200 bg-white p-3 sm:mb-0 sm:space-y-4 sm:p-6">
          <div>
            <Label htmlFor="avatar">
              {t.avatarUrl} <span className="text-zinc-400">{t.instagramHint}</span>
            </Label>
            <div className="mt-2 flex gap-3">
              <Input
                id="avatar"
                value={avatarUrlDraft}
                onChange={(e) => setAvatarUrlDraft(e.target.value)}
                onFocus={(e) => e.currentTarget.select()}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    applyAvatarUrl();
                  }
                }}
                placeholder="https://instagram.com/username or @username"
              />
              <Button type="button" variant="outline" className="h-8 shrink-0 rounded-full px-3 text-xs sm:h-10 sm:px-4 sm:text-sm" onClick={applyAvatarUrl}>
                {t.applyAvatarUrl}
              </Button>
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3">
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
              <Button
                type="button"
                variant="outline"
                className="h-8 rounded-full px-3 text-xs sm:h-10 sm:px-4 sm:text-sm"
                onClick={() => avatarInputRef.current?.click()}
              >
                <Upload className="h-4 w-4" />
                {t.uploadAnotherAvatar}
              </Button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="username">{t.username}</Label>
            <Input
              id="username"
              value={data.username}
              onChange={(e) => setData({ ...data, username: e.target.value })}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-zinc-700">
            <input
              type="checkbox"
              checked={data.isVerified}
              onChange={(e) => setData({ ...data, isVerified: e.target.checked })}
              className="h-4 w-4 rounded border-zinc-300"
            />
            <span>{t.verified}</span>
          </label>

          <div className="grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-2 sm:gap-3">
            <div className="space-y-2">
              <Label htmlFor="time">{t.time}</Label>
              <Input
                id="time"
                value={data.timeAgo}
                onChange={(e) => setData({ ...data, timeAgo: e.target.value })}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="likes">{t.likes}</Label>
              <Input
                id="likes"
                type="number"
                value={data.likes}
                onChange={(e) => setData({ ...data, likes: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="comment">{t.comment}</Label>
            <Textarea
              id="comment"
              value={data.commentText}
              onChange={(e) => setData({ ...data, commentText: e.target.value })}
              rows={isMobileViewport ? 2 : 3}
            />
          </div>
        </div>

        <div className="order-3 flex justify-center pt-1 sm:pt-0">
          <Button
            className="h-9 rounded-full bg-zinc-900 px-4 text-sm text-white hover:bg-zinc-800 sm:h-10"
            onClick={handleExportPng}
            disabled={isExporting}
          >
            <Download className="h-4 w-4" />
            {isExporting ? t.exporting : t.exportPng}
          </Button>
        </div>
      </div>

      <div className="pointer-events-none fixed left-[-4000px] top-0 opacity-0">
        <div ref={exportDesktopRef}>{exportCard}</div>
        <div
          ref={exportMobileRef}
          style={{
            width: mobileCardWidth ? Math.ceil(mobileCardWidth * mobileScale) : 337,
            height: mobileCardHeight ? Math.ceil(mobileCardHeight * mobileScale) : 220,
            overflow: 'hidden',
          }}
        >
          <div
            className="origin-top-left"
            style={{ transform: `scale(${mobileScale})`, width: '624px' }}
          >
            {exportCard}
          </div>
        </div>
      </div>
    </div>
  );
}
