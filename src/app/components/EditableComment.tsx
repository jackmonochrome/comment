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
    exportPng: string;
    exporting: string;
    uploadAvatar: string;
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
    exportPng: 'Export PNG',
    exporting: 'Exporting...',
    uploadAvatar: 'Upload avatar',
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
    exportPng: 'Export PNG',
    exporting: 'Экспорт...',
    uploadAvatar: 'Загрузить аватарку',
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
    exportPng: 'Export PNG',
    exporting: 'Exportando...',
    uploadAvatar: 'Subir avatar',
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
    exportPng: 'Export PNG',
    exporting: 'Export...',
    uploadAvatar: 'Telecharger un avatar',
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
    exportPng: 'Export PNG',
    exporting: 'Exportiere...',
    uploadAvatar: 'Avatar hochladen',
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
            