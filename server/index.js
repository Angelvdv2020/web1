require('dotenv').config();
const fs = require('fs');
const path = require('path');
const express = require('express');

const app = express();
app.disable('etag');
const PORT = Number(process.env.PORT) || 3002;

const publicDir = path.join(__dirname, '..', 'public');
const htmlPath = path.join(publicDir, 'reference-home.html');
const referenceAuthTemplatePathPreferred = path.join(__dirname, '..', '123', 'Главная страница', 'reference-home.html');
const referenceAuthTemplatePath = fs.existsSync(referenceAuthTemplatePathPreferred)
  ? referenceAuthTemplatePathPreferred
  : htmlPath;
const preferredAssetsDir = path.join(__dirname, '..', '123', 'карта мира_files');
const assetsDir = fs.existsSync(preferredAssetsDir)
  ? preferredAssetsDir
  : path.join(publicDir, 'карта мира_files');
const noCacheFileOptions = { etag: false, lastModified: false, cacheControl: false };
const staticMaxAgeMs = Number(process.env.STATIC_MAX_AGE_MS) || 7 * 24 * 60 * 60 * 1000;

const setNoCacheHeaders = (res) => {
  res.setHeader('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0');
  res.setHeader('Pragma', 'no-cache');
  res.setHeader('Expires', '0');
  res.setHeader('Surrogate-Control', 'no-store');
};

const setStaticCacheHeaders = (res, filePath) => {
  if (/\.html?$/i.test(filePath)) {
    setNoCacheHeaders(res);
    return;
  }

  res.setHeader('Cache-Control', `public, max-age=${Math.floor(staticMaxAgeMs / 1000)}, immutable`);
};

const safeDecode = (value) => {
  try {
    return decodeURIComponent(value);
  } catch (_error) {
    return value;
  }
};

const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const assetExtRegex = /\.(css|js|png|jpe?g|webp|gif|svg|ico|woff2?|ttf|eot|otf)(?:[?#].*)?$/i;

const collectAssetPaths = (rootDir, relativeDir = '') => {
  const absoluteDir = path.join(rootDir, relativeDir);
  if (!fs.existsSync(absoluteDir)) {
    return [];
  }

  const entries = fs.readdirSync(absoluteDir, { withFileTypes: true });
  const results = [];
  for (const entry of entries) {
    const nextRelative = relativeDir ? path.posix.join(relativeDir, entry.name) : entry.name;
    if (entry.isDirectory()) {
      results.push(...collectAssetPaths(rootDir, nextRelative));
      continue;
    }
    results.push(nextRelative);
  }

  return results;
};

const assetFileNames = fs.existsSync(assetsDir) ? collectAssetPaths(assetsDir) : [];
const assetNameSet = new Set(assetFileNames);
const normalizedAssetMap = new Map();

const normalizeAssetName = (name) =>
  name
    .replace(/\.Без названия$/i, '')
    .replace(/\(\d+\)(?=\.[^.]+$)/, '')
    .toLowerCase();

const assetNameScore = (name) => {
  let score = 0;
  if (/\.Без названия$/i.test(name)) score += 2;
  if (/\(\d+\)(?=\.[^.]+$)/.test(name)) score += 1;
  return score;
};

for (const fileName of assetFileNames) {
  const key = normalizeAssetName(fileName);
  if (!normalizedAssetMap.has(key)) {
    normalizedAssetMap.set(key, fileName);
    continue;
  }

  const prev = normalizedAssetMap.get(key);
  if (assetNameScore(fileName) < assetNameScore(prev)) {
    normalizedAssetMap.set(key, fileName);
  }
}

const buildAssetNameCandidates = (baseName) => {
  const aliasSet = new Set([baseName]);
  const noryxToZoog = baseName.replace(/noryx/gi, 'zoog');
  const zoogToNoryx = baseName.replace(/zoog/gi, 'noryx');
  aliasSet.add(noryxToZoog);
  aliasSet.add(zoogToNoryx);

  const candidates = [];
  for (const alias of aliasSet) {
    candidates.push(alias);
    candidates.push(`${alias}.Без названия`);
  }

  const ext = path.extname(baseName);
  const stem = ext ? baseName.slice(0, -ext.length) : baseName;

  if (ext) {
    for (let i = 1; i <= 4; i += 1) {
      candidates.push(`${stem}(${i})${ext}`);
      candidates.push(`${stem}(${i})${ext}.Без названия`);
      candidates.push(`${noryxToZoog.slice(0, -(path.extname(noryxToZoog).length || 0))}(${i})${ext}`);
      candidates.push(`${zoogToNoryx.slice(0, -(path.extname(zoogToNoryx).length || 0))}(${i})${ext}`);
    }
  }

  return candidates;
};

const stripVariantSuffixes = (baseName) =>
  baseName
    .replace(/-\d+x\d+(?=\.[^.]+$)/i, '')
    .replace(/-scaled(?=\.[^.]+$)/i, '')
    .replace(/-min(?=\.[^.]+$)/i, '');

const resolveAssetFileName = (requestedPath) => {
  const cleanPath = requestedPath.split('?')[0].split('#')[0];
  const decodedPath = safeDecode(cleanPath);
  const normalizedRequestedPath = decodedPath.replace(/\/+/g, '/').toLowerCase();
  const normalizedRequestPath = decodedPath.replace(/^\/+/, '').replace(/\\/g, '/');
  const baseName = path.basename(normalizedRequestPath);

  // Path-specific overrides for ambiguous "style.css" files from WordPress exports.
  const pathOverrides = [
    ['/wp-content/plugins/zoog-core/../lib/zoog-icons/style.css', 'style.css'],
    ['/wp-content/plugins/zoog-core/assets/css/style.css', 'style(1).css'],
    ['/wp-content/themes/dvpn/style.css', 'style(2).css'],
    ['/wp-content/themes/dvpn/assets/css/style.css', 'style(3).css'],
  ];

  for (const [needle, fileName] of pathOverrides) {
    if (normalizedRequestedPath.includes(needle) && assetNameSet.has(fileName)) {
      return fileName;
    }
  }

  if (!assetExtRegex.test(baseName)) {
    return null;
  }


  if (assetNameSet.has(normalizedRequestPath)) {
    return normalizedRequestPath;
  }

  for (const candidate of buildAssetNameCandidates(baseName)) {
    if (assetNameSet.has(candidate)) {
      return candidate;
    }
  }

  const normalizedExact = normalizedAssetMap.get(normalizeAssetName(baseName));
  if (normalizedExact) {
    return normalizedExact;
  }

  const strippedBase = stripVariantSuffixes(baseName);
  if (strippedBase !== baseName) {
    for (const candidate of buildAssetNameCandidates(strippedBase)) {
      if (assetNameSet.has(candidate)) {
        return candidate;
      }
    }

    const strippedNormalized = normalizedAssetMap.get(normalizeAssetName(strippedBase));
    if (strippedNormalized) {
      return strippedNormalized;
    }
  }

  const ext = path.extname(strippedBase).toLowerCase();
  const stem = strippedBase.slice(0, -ext.length).toLowerCase();
  const fuzzyPrefixes = Array.from(
    new Set([stem, stem.replace(/noryx/g, 'zoog'), stem.replace(/zoog/g, 'noryx')]),
  );

  for (const fileName of assetFileNames) {
    if (path.extname(fileName).toLowerCase() !== ext) {
      continue;
    }

    const normalized = normalizeAssetName(fileName);
    if (fuzzyPrefixes.some((prefix) => normalized.startsWith(prefix))) {
      return fileName;
    }
  }

  return null;
};

const localAssetsUrlPrefix = encodeURI('/карта мира_files/');
const toLocalAssetUrl = (assetFileName) => `${localAssetsUrlPrefix}${encodeURIComponent(assetFileName)}`;

const rewriteAssetUrlToLocal = (urlValue) => {
  if (!assetExtRegex.test(urlValue)) {
    return urlValue;
  }

  let pathname = urlValue;
  if (/^https?:\/\//i.test(urlValue)) {
    try {
      pathname = new URL(urlValue).pathname;
    } catch (_error) {
      return urlValue;
    }
  }

  const localFileName = resolveAssetFileName(pathname);
  if (!localFileName) {
    return urlValue;
  }

  return toLocalAssetUrl(localFileName);
};

// Replace domain only for the user-provided public site links.
const domainSwapPairs = [
  ['https://zgproxy.org/', 'https://noryxvpn.store/'],
  ['https://zgproxy.org/pricing/', 'https://noryxvpn.store/pricing/'],
  ['https://zgproxy.org/features/', 'https://noryxvpn.store/features/'],
  ['https://zgproxy.org/locations/', 'https://noryxvpn.store/locations/'],
  ['https://zgproxy.org/vpn-for-windows/', 'https://noryxvpn.store/vpn-for-windows/'],
  ['https://zgproxy.org/vpn-for-mac/', 'https://noryxvpn.store/vpn-for-mac/'],
  ['https://zgproxy.org/vpn-for-ios/', 'https://noryxvpn.store/vpn-for-ios/'],
  ['https://zgproxy.org/vpn-for-android/', 'https://noryxvpn.store/vpn-for-android/'],
  ['https://zgproxy.org/vpn-for-android-tv/', 'https://noryxvpn.store/vpn-for-android-tv/'],
  ['https://zgproxy.org/vpn-for-blackberry/', 'https://noryxvpn.store/vpn-for-blackberry/'],
  ['https://zgproxy.org/vpn-for-linux/', 'https://noryxvpn.store/vpn-for-linux/'],
  ['https://zgproxy.org/vpn-for-router/', 'https://noryxvpn.store/vpn-for-router/'],
  ['https://zgproxy.org/proxy/', 'https://noryxvpn.store/proxy/'],
  ['https://zgproxy.org/google-chrome-vpn/', 'https://noryxvpn.store/google-chrome-vpn/'],
  ['https://zgproxy.org/what-is-my-ip/', 'https://noryxvpn.store/what-is-my-ip/'],
  ['https://zgproxy.org/dns-leak-test/', 'https://noryxvpn.store/dns-leak-test/'],
  ['https://zgproxy.org/webrtc-leak-test/', 'https://noryxvpn.store/webrtc-leak-test/'],
  ['https://zgproxy.org/blog/', 'https://noryxvpn.store/blog/'],
  ['https://zgproxy.org/faq/', 'https://noryxvpn.store/faq/'],
  ['https://zgproxy.org/help-center/', 'https://noryxvpn.store/help-center/'],
  ['https://zgproxy.org/privacy-policy/', 'https://noryxvpn.store/privacy-policy/'],
  ['https://zgproxy.org/terms-of-service/', 'https://noryxvpn.store/terms-of-service/'],
  ['https://zgproxy.org/refund-policy/', 'https://noryxvpn.store/refund-policy/'],
  ['https://zgproxy.org/contact/', 'https://noryxvpn.store/contact/'],
];


const ruTextReplacements = [
  ['Pricing', 'Цены'],
  ['Features', 'Возможности'],
  ['Locations', 'Локации'],
  ['Contact', 'Контакты'],
  ['My account', 'Мой аккаунт'],
  ['Sign in', 'Вход'],
  ['Sign up', 'Регистрация'],
  ['Register', 'Регистрация'],
  ['Help Center', 'Центр помощи'],
  ['Privacy Policy', 'Политика конфиденциальности'],
  ['Terms of Service', 'Условия использования'],
  ['Refund Policy', 'Политика возврата'],
  ['Blog', 'Блог'],
  ['FAQ', 'Вопросы и ответы'],
  ['Download', 'Скачать'],
  ['Get started', 'Начать'],
];

const replaceCommonTextToRussian = (input) => {
  let out = input;
  for (const [from, to] of ruTextReplacements) {
    out = out.replace(new RegExp(escapeRegex(from), 'g'), to);
  }
  return out;
};

const replaceConfiguredDomainLinks = (input) => {
  let out = input;

  for (const [from, to] of domainSwapPairs) {
    // Raw URL in HTML attributes/text.
    out = out.replace(new RegExp(escapeRegex(from), 'g'), to);

    // Escaped URL inside inline JSON/scripts.
    const fromEscaped = from.replace(/\//g, '\\/');
    const toEscaped = to.replace(/\//g, '\\/');
    out = out.replace(new RegExp(escapeRegex(fromEscaped), 'g'), toEscaped);
  }

  return out;
};

const localizeHtml = (html) => {
  let out = replaceConfiguredDomainLinks(html);
  out = replaceCommonTextToRussian(out);

  // Domain replacements.
  out = out
    .replace(/https?:\/\/app\.zgproxy\.org/gi, 'https://app.noryxvpn.store')
    .replace(/https?:\/\/zgproxy\.org/gi, 'https://noryxvpn.store')
    .replace(/https?:\/\/app\.zoogvpn\.com/gi, 'https://app.noryxvpn.store')
    .replace(/https?:\/\/zoogvpn\.com/gi, 'https://noryxvpn.store')
    .replace(/https?:\/\/(?:www\.)?zoogvpn\.net/gi, 'https://noryxvpn.store')
    .replace(/https?:\/\/zgnet\.vip/gi, 'https://noryxvpn.store')
    .replace(/\/\/zgproxy\.org/gi, '//noryxvpn.store')
    .replace(/\/\/zoogvpn\.com/gi, '//noryxvpn.store')
    .replace(/zgproxy\.org/gi, 'noryxvpn.store')
    .replace(/zoogvpn\.com/gi, 'noryxvpn.store')
    .replace(/zoogvpn\.net/gi, 'noryxvpn.store')
    .replace(/zgnet\.vip/gi, 'noryxvpn.store')
    .replace(/https%3A%2F%2Fzgproxy\.org/gi, 'https%3A%2F%2Fnoryxvpn.store')
    .replace(/https%3A%2F%2Fzoogvpn\.com/gi, 'https%3A%2F%2Fnoryxvpn.store');

  // Force external wp-content/wp-includes assets to local files.
  out = out
    .replace(
      /https?:\/\/(?:www\.)?(?:app\.noryxvpn\.store|noryxvpn\.store|app\.zgproxy\.org|zgproxy\.org|app\.zoogvpn\.com|zoogvpn\.com|(?:www\.)?zoogvpn\.net|zgnet\.vip)\/[^"'<>\\\s)]+/gi,
      (urlValue) => rewriteAssetUrlToLocal(urlValue),
    )
    .replace(/\/(?:wp-content|wp-includes)\/[^"'<>\\\s)]+/gi, (urlValue) => rewriteAssetUrlToLocal(urlValue));

  // Brand name replacements.
  out = out
    .replace(/ZOOGVPN/g, 'NORYXVPN')
    .replace(/ZoogVPN/g, 'NoryxVPN')
    .replace(/zoogvpn/g, 'noryxvpn')
    .replace(/Zoog/g, 'Noryx')
    .replace(/zoog/g, 'noryx');

  // Keep only Russian locale UI signals and force ru language markers.
  out = out
    .replace(/<html([^>]*?)\slang=["'][^"']*["']([^>]*)>/i, '<html$1 lang="ru"$2>')
    .replace(/<link[^>]+hreflang=["'](?!ru|ru-ru)[^"']+["'][^>]*>/gi, '')
    .replace(/<a[^>]*href=["'][^"']*[?&]lang=(?!ru)[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/<option[^>]+value=["'](?!ru)[^"']+["'][^>]*>[\s\S]*?<\/option>/gi, '');

  // Remove logo/favicons everywhere without replacement.
  out = out
    .replace(/<meta[^>]+(?:property|name)=["'](?:og:image(?::secure_url)?|twitter:image)["'][^>]*>/gi, '')
    .replace(/<link[^>]+rel=["'][^"']*(?:icon|apple-touch-icon)[^"']*["'][^>]*>/gi, '')
    .replace(/<meta[^>]+name=["']msapplication-TileImage["'][^>]*>/gi, '')
    .replace(/<div[^>]*\b(?:logo-canonical|elementor-widget-wp-widget-dvpn_logo_widget)\b[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<a[^>]*>\s*<img[^>]*(?:logo|zoog-vpn-logo-dark|noryx-vpn-logo-dark|logo-ZoogVPN|logo-NoryxVPN|zoogvpn_favicon|noryxvpn_favicon|favicon\.ico)[^>]*>\s*<\/a>/gi, '')
    .replace(/<img[^>]*(?:logo|zoog-vpn-logo-dark|noryx-vpn-logo-dark|logo-ZoogVPN|logo-NoryxVPN|zoogvpn_favicon|noryxvpn_favicon|favicon\.ico)[^>]*>/gi, '')
    .replace(/\$\('\.logo-canonical a'\)\.attr\('href',\s*'[^']*'\)\s*;?/gi, '');

  // Payment data/link replacements (preserve content, only rewrite endpoints).
  out = out
    .replace(/https?:\/\/app\.noryxvpn\.store\/checkout(?:-[^"'<>\s]*)?(?:\?[^"'<>\s]*)?/gi, 'https://noryxvpn.store/pricing/')
    .replace(/https:\\\/\\\/app\.noryxvpn\.store\\\/checkout(?:-[^"'<>\s]*)?(?:\\\?[^"'<>\s]*)?/gi, 'https:\\/\\/noryxvpn.store\\/pricing\\/')
    .replace(/\/checkout(?:-[^"'<>\s]*)?(?:\?[^"'<>\s]*)?/gi, '/pricing/');

  // Telegram support block customization.
  out = out
    .replace(/<h4 class="info__name">[^<]*<\/h4>/gi, '<h4 class="info__name">Noryx Support</h4>')
    .replace(/https?:\/\/t\.me\/(?:zoogvpn_support_team_bot|noryxvpn_support_team_bot)/gi, 'https://t.me/NoryxWebBot');

  // Remove floating Telegram support widget (green square bubble).
  out = out
    .replace(/<div class="teleSupport[\s\S]*?teleSupport__send-message[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi, '')
    .replace(/<div class="teleSupport[\s\S]*?(?=<div id="pum-)/gi, '');

  // Remove floating "Exclusive Offer" banner popup from all pages (pum-55233).
  out = out
    .replace(/<div\s+id="pum-55233"[\s\S]*?(?=<script)/gi, '');

  // Remove chat-telegram assets to prevent floating chat bubble injection.
  out = out
    .replace(/<link[^>]*chat-telegram\/assets\/css\/all\.min\.css[^>]*>/gi, '')
    .replace(/<link[^>]*chat-telegram\/assets\/css\/cts-main\.css[^>]*>/gi, '')
    .replace(/<script[^>]*chat-telegram\/assets\/js\/moment-timezone-with-data\.min\.js[^>]*><\/script>/gi, '')
    .replace(/<script[^>]*chat-telegram\/assets\/js\/cts-main\.js[^>]*><\/script>/gi, '');


  // Remove download/contact buttons and related blocks by request.
  out = out
    .replace(/<a[^>]*(?:download|app\s*store|play\s*store|google\s*play|vpn-for-(?:windows|mac|ios|android|linux|router)|contact)[^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/<button[^>]*(?:download|app\s*store|play\s*store|google\s*play|contact)[^>]*>[\s\S]*?<\/button>/gi, '')
    .replace(/<section[^>]*(?:download|contact)[^>]*>[\s\S]*?<\/section>/gi, '')
    .replace(/<div[^>]*(?:download|contact)[^>]*>[\s\S]*?<\/div>/gi, '');

  // Remove only third-party injected widget scripts.
  out = out
    .replace(/<script[^>]*data-site-id="1802"[^>]*><\/script>/gi, '')
    .replace(/<script[^>]*>\s*window\.op=window\.op\|\|function[\s\S]*?<\/script>/gi, '')
    .replace(/<script[^>]*src="\.\/карта мира_files\/op1\.js[^"]*"[^>]*><\/script>/gi, '')
    .replace(/<iframe[^>]*saved_resource\.html[^>]*><\/iframe>/gi, '')
    .replace(/<div id="batBeacon[^>]*>[\s\S]*?<\/div>/gi, '')
    .replace(/<script[^>]*>\(function\(a,c,d\)\{var b=document\.createElement\(d\);[\s\S]*?adscool\.net[\s\S]*?<\/script>/gi, '');

  const injectedHead = '<base href="/">\n<link rel="stylesheet" href="/style/site.css">\n';
  if (!out.includes('/style/site.css')) {
    out = out.replace('</head>', `${injectedHead}</head>`);
  }

  return out;
};

const getLocalizedHtml = (relativePath) => {
  const absolutePath = path.join(publicDir, relativePath);
  if (!fs.existsSync(absolutePath)) {
    return null;
  }

  const raw = fs.readFileSync(absolutePath, 'utf8');
  return localizeHtml(raw);
};

const getBrandedReferenceHtml = () => {
  if (!fs.existsSync(referenceAuthTemplatePath)) {
    return null;
  }

  const raw = fs.readFileSync(referenceAuthTemplatePath, 'utf8');
  return localizeHtml(raw);
};

const sendBrandedReferencePage = (res) => {
  const html = getBrandedReferenceHtml();
  if (!html) {
    setNoCacheHeaders(res);
    res.status(404).type('text/plain').send('Not Found');
    return;
  }

  setNoCacheHeaders(res);
  res.type('html').send(html);
};

const sendLocalizedFile = (res, relativePath) => {
  const html = getLocalizedHtml(relativePath);
  if (!html) {
    setNoCacheHeaders(res);
    res.status(404).type('text/plain').send('Not Found');
    return;
  }
  setNoCacheHeaders(res);
  res.type('html').send(html);
};

app.get('/healthz', (_req, res) => {
  res.status(200).json({ ok: true });
});

app.get('/favicon.ico', (_req, res) => {
  setNoCacheHeaders(res);
  res.status(204).end();
});

// Asset fallback: when copied HTML references legacy WP paths, try matching by filename in local assets.
app.get('*', (req, res, next) => {
  if (!/\.(css|js|png|jpe?g|webp|gif|svg|ico|woff2?|ttf)$/i.test(req.path)) {
    return next();
  }

  const fileName = path.basename(safeDecode(req.path));
  const resolvedFileName = resolveAssetFileName(fileName) || resolveAssetFileName(req.path);
  if (resolvedFileName) {
    const candidate = path.join(assetsDir, resolvedFileName);
    setStaticCacheHeaders(res, resolvedFileName);
    return res.sendFile(candidate, noCacheFileOptions);
  }

  next();
});

const pageRoutes = {
  '/': 'reference-home.html',
  '/ru-ru': 'reference-home.html',

  '/products': 'pages/products.html',
  '/zoogvpn-news': 'pages/blog.html',
  '/features': 'pages/features.html',
  '/pricing': 'pages/pricing.html',
  '/locations': 'pages/locations.html',
  '/network': 'pages/locations.html',

  '/contact': 'pages/contact.html',
  '/my-account': 'pages/my-account.html',
  '/sign-in': 'pages/sign-in.html',
  '/sign-up': 'pages/sign-up.html',
  '/register': 'pages/sign-up.html',
  '/payment-step-3': 'pages/payment-step-3.html',
  '/checkout-step-3': 'pages/payment-step-3.html',

  '/vpn-for-windows': 'pages/vpn-for-windows.html',
  '/products/vpn-for-windows': 'pages/vpn-for-windows.html',
  '/vpn-for-mac': 'pages/vpn-for-mac.html',
  '/products/vpn-for-mac': 'pages/vpn-for-mac.html',
  '/vpn-for-ios': 'pages/vpn-for-ios.html',
  '/products/vpn-for-ios': 'pages/vpn-for-ios.html',
  '/vpn-for-android': 'pages/vpn-for-android.html',
  '/products/vpn-for-android': 'pages/vpn-for-android.html',
  '/vpn-for-android-tv': 'pages/vpn-for-android-tv.html',
  '/products/vpn-for-android-tv': 'pages/vpn-for-android-tv.html',
  '/vpn-for-blackberry': 'pages/vpn-for-blackberry.html',
  '/products/vpn-for-blackberry': 'pages/vpn-for-blackberry.html',
  '/vpn-for-linux': 'pages/vpn-for-linux.html',
  '/products/vpn-for-linux': 'pages/vpn-for-linux.html',
  '/vpn-for-router': 'pages/vpn-for-router.html',
  '/products/vpn-for-router': 'pages/vpn-for-router.html',
  '/proxy': 'pages/proxy.html',
  '/products/proxy': 'pages/proxy.html',
  '/google-chrome-vpn': 'pages/google-chrome-vpn.html',
  '/chrome-vpn-extension': 'pages/google-chrome-vpn.html',

  '/what-is-my-ip': 'pages/what-is-my-ip.html',
  '/dns-leak-test': 'pages/dns-leak-test.html',
  '/webrtc-leak-test': 'pages/webrtc-leak-test.html',

  '/blog': 'pages/blog.html',
  '/faq': 'pages/faq.html',
  '/help-center': 'pages/help-center.html',

  '/privacy-policy': 'pages/privacy-policy.html',
  '/privacy': 'pages/privacy-policy.html',
  '/terms-of-service': 'pages/terms-of-service.html',
  '/terms': 'pages/terms-of-service.html',
  '/refund-policy': 'pages/refund-policy.html',
  '/refund': 'pages/refund-policy.html',
};

const registerPageRoute = (route, filePath) => {
  const variants = route === '/' ? ['/'] : [route, `${route}/`];
  app.get(variants, (_req, res) => {
    sendLocalizedFile(res, filePath);
  });
};

Object.entries(pageRoutes).forEach(([route, filePath]) => {
  registerPageRoute(route, filePath);
});

const specialBrandedRoutes = [
  '/my-account',
  '/my-account/',
  '/sign-in',
  '/sign-in/',
  '/sign-up',
  '/sign-up/',
  '/register',
  '/register/',
  '/payment-step-3',
  '/payment-step-3/',
  '/checkout-step-3',
  '/checkout-step-3/',
];

app.get(specialBrandedRoutes, (_req, res) => {
  sendBrandedReferencePage(res);
});


app.use(
  express.static(publicDir, {
    etag: false,
    lastModified: false,
    maxAge: staticMaxAgeMs,
    immutable: true,
    setHeaders: setStaticCacheHeaders,
  }),
);
app.use(
  '/карта мира_files',
  express.static(assetsDir, {
    etag: false,
    lastModified: false,
    maxAge: staticMaxAgeMs,
    immutable: true,
    setHeaders: setStaticCacheHeaders,
  }),
);

// Return explicit 404 for unknown routes instead of rendering home page everywhere.
app.get('*', (_req, res) => {
  setNoCacheHeaders(res);
  res.status(404).type('text/plain').send('Not Found');
});

app.listen(PORT, () => {
  console.log(`Full HTML project started on http://localhost:${PORT}`);
});
