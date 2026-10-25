import type { Language, PrayerKey } from './types/prayer';

export interface Dict {
  appName: string;
  appNameAr: string;
  nextPrayer: string;
  remaining: string;
  settings: string;
  refresh: string;
  city: string;
  language: string;
  clockFormat: string;
  '12h': string;
  '24h': string;
  calculationMethod: string;
  asrMadhab: string;
  asrStandard: string;
  asrHanafi: string;
  notifications: string;
  notifNone: string;
  notifAtTime: string;
  notif5min: string;
  notif10min: string;
  notificationHint: string;
  alwaysOnTop: string;
  startWithWindows: string;
  launchMinimized: string;
  theme: string;
  themeDark: string;
  themeLight: string;
  themeSystem: string;
  opacity: string;
  resetSettings: string;
  about: string;
  version: string;
  lastUpdated: string;
  connectionOnline: string;
  connectionOffline: string;
  usingCache: string;
  refreshNow: string;
  methodTunisia: string;
  close: string;
  minimize: string;
  showFloatingWidget: string;
  dockExpand: string;
  dockCollapse: string;
  markCompleted: string;
  completed: string;
  errorTitle: string;
  errorNetwork: string;
  errorTimeout: string;
  errorInvalid: string;
  errorParse: string;
  loading: string;
  noData: string;
  countdownTargetTomorrow: string;
  sunrise: string;
}

const fr: Dict = {
  appName: 'Salati Tunisia',
  appNameAr: 'صلاتي تونس',
  nextPrayer: 'Prochaine prière',
  remaining: 'Il reste',
  settings: 'Paramètres',
  refresh: 'Actualiser',
  city: 'Ville',
  language: 'Langue',
  clockFormat: "Format d'heure",
  '12h': '12 h',
  '24h': '24 h',
  calculationMethod: 'Mode de calcul',
  asrMadhab: "Calcul de l'Asr",
  asrStandard: 'Standard (majorité)',
  asrHanafi: 'Hanafi',
  notifications: 'Notifications',
  notifNone: 'Aucune',
  notifAtTime: "À l'heure de la prière",
  notif5min: '5 min avant',
  notif10min: '10 min avant',
  notificationHint:
    "Sur Windows, assurez-vous que les notifications sont autorisées pour l'application (Paramètres Windows → Système → Notifications).",
  alwaysOnTop: 'Toujours au premier plan',
  startWithWindows: 'Démarrer avec Windows',
  launchMinimized: 'Lancer réduit (icône tray)',
  theme: 'Thème',
  themeDark: 'Sombre',
  themeLight: 'Clair',
  themeSystem: 'Système',
  opacity: 'Opacité',
  resetSettings: 'Réinitialiser les paramètres',
  about: 'À propos',
  version: 'Version',
  lastUpdated: 'Mis à jour',
  connectionOnline: 'En ligne',
  connectionOffline: 'Hors ligne',
  usingCache: 'Données en cache (hors ligne)',
  refreshNow: 'Actualiser maintenant',
  methodTunisia: 'Ministère des Affaires religieuses — Tunisie (18° / 18°)',
  close: 'Fermer',
  minimize: 'Masquer dans la barre des tâches',
  showFloatingWidget: 'Widget flottant sur le bureau',
  dockExpand: 'Afficher le widget',
  dockCollapse: "Réduire dans l'icône",
  markCompleted: 'Marquer comme accomplie',
  completed: 'Accomplie',
  errorTitle: 'Impossible de récupérer les horaires',
  errorNetwork: 'Pas de connexion Internet. Vérifiez votre réseau puis réessayez.',
  errorTimeout: 'Le serveur est trop lent. Réessayez.',
  errorInvalid: 'Ville ou date non valide.',
  errorParse: 'Réponse du serveur illisible.',
  loading: 'Chargement…',
  noData: 'Aucun horaire disponible. Actualisez lorsque vous serez en ligne.',
  countdownTargetTomorrow: 'قبل الفجر (demain)',
  sunrise: 'Lever du soleil',
};

const ar: Dict = {
  appName: 'صلاتي تونس',
  appNameAr: 'Salati Tunisia',
  nextPrayer: 'الصلاة القادمة',
  remaining: 'الوقت المتبقي',
  settings: 'الإعدادات',
  refresh: 'تحديث',
  city: 'المدينة',
  language: 'اللغة',
  clockFormat: 'تنسيق الساعة',
  '12h': '12 ساعة',
  '24h': '24 ساعة',
  calculationMethod: 'طريقة الحساب',
  asrMadhab: 'حساب العصر',
  asrStandard: 'الجمهور',
  asrHanafi: 'الحنفي',
  notifications: 'التنبيهات',
  notifNone: 'بدون',
  notifAtTime: 'عند دخول الوقت',
  notif5min: 'قبل 5 دقائق',
  notif10min: 'قبل 10 دقائق',
  notificationHint:
    'على ويندوز، تأكد من السماح بالإشعارات لهذا التطبيق (إعدادات ويندوز ← النظام ← الإشعارات).',
  alwaysOnTop: 'دائمًا في المقدمة',
  startWithWindows: 'التشغيل مع ويندوز',
  launchMinimized: 'التشغيل مخفي (أيقونة النظام)',
  theme: 'المظهر',
  themeDark: 'داكن',
  themeLight: 'فاتح',
  themeSystem: 'النظام',
  opacity: 'الشفافية',
  resetSettings: 'إعادة تعيين الإعدادات',
  about: 'حول التطبيق',
  version: 'الإصدار',
  lastUpdated: 'آخر تحديث',
  connectionOnline: 'متصل',
  connectionOffline: 'غير متصل',
  usingCache: 'بيانات مخزّنة (غير متصل)',
  refreshNow: 'تحديث الآن',
  methodTunisia: 'وزارة الشؤون الدينية — تونس (18° / 18°)',
  close: 'إغلاق',
  minimize: 'إخفاء',
  showFloatingWidget: 'الودجت العائمة على سطح المكتب',
  dockExpand: 'إظهار الودجت',
  dockCollapse: 'طَيّ في الأيقونة',
  markCompleted: 'تحديد كمؤداة',
  completed: 'مؤداة',
  errorTitle: 'تعذر جلب أوقات الصلاة',
  errorNetwork: 'لا يوجد اتصال بالإنترنت. تحقق من الشبكة ثم أعد المحاولة.',
  errorTimeout: 'الخادم بطيء جدًا. أعد المحاولة.',
  errorInvalid: 'مدينة أو تاريخ غير صالح.',
  errorParse: 'تعذر قراءة رد الخادم.',
  loading: 'جارِ التحميل…',
  noData: 'لا توجد أوقات متاحة. قم بالتحديدزد بعد الاتصال بالإنترنت.',
  countdownTargetTomorrow: 'قبل الفجر (غدًا)',
  sunrise: 'الشروق',
};

const en: Dict = {
  appName: 'Salati Tunisia',
  appNameAr: 'صلاتي تونس',
  nextPrayer: 'Next prayer',
  remaining: 'Remaining',
  settings: 'Settings',
  refresh: 'Refresh',
  city: 'City',
  language: 'Language',
  clockFormat: 'Clock format',
  '12h': '12 h',
  '24h': '24 h',
  calculationMethod: 'Calculation method',
  asrMadhab: 'Asr calculation',
  asrStandard: 'Standard (majority)',
  asrHanafi: 'Hanafi',
  notifications: 'Notifications',
  notifNone: 'None',
  notifAtTime: 'At prayer time',
  notif5min: '5 min before',
  notif10min: '10 min before',
  notificationHint:
    'On Windows, make sure notifications are allowed for the app (Windows Settings → System → Notifications).',
  alwaysOnTop: 'Always on top',
  startWithWindows: 'Start with Windows',
  launchMinimized: 'Start minimized to tray',
  theme: 'Theme',
  themeDark: 'Dark',
  themeLight: 'Light',
  themeSystem: 'System',
  opacity: 'Opacity',
  resetSettings: 'Reset settings',
  about: 'About',
  version: 'Version',
  lastUpdated: 'Last updated',
  connectionOnline: 'Online',
  connectionOffline: 'Offline',
  usingCache: 'Using cached data (offline)',
  refreshNow: 'Refresh now',
  methodTunisia: 'Ministry of Religious Affairs — Tunisia (18° / 18°)',
  close: 'Close',
  minimize: 'Hide widget',
  showFloatingWidget: 'Show floating widget',
  dockExpand: 'Show widget',
  dockCollapse: 'Collapse into icon',
  markCompleted: 'Mark as completed',
  completed: 'Completed',
  errorTitle: 'Could not load prayer times',
  errorNetwork: 'No Internet connection. Check your network and try again.',
  errorTimeout: 'The server took too long. Try again.',
  errorInvalid: 'Invalid city or date.',
  errorParse: 'Server response could not be parsed.',
  loading: 'Loading…',
  noData: 'No prayer times available. Refresh once you are online.',
  countdownTargetTomorrow: 'before Fajr (tomorrow)',
  sunrise: 'Sunrise',
};

export const DICTS: Record<Language, Dict> = { fr, ar, en };

/** Dictionary lookup that always returns a Dict (falls back to French). */
export function getDict(lang: Language): Dict {
  return DICTS[lang] ?? fr;
}

export const RADIO_LANGS: { value: Language; label: string }[] = [
  { value: 'fr', label: 'Français' },
  { value: 'ar', label: 'العربية' },
  { value: 'en', label: 'English' },
];

const PRAYER_NAME_FR: Record<PrayerKey, string> = {
  Fajr: 'Fajr',
  Dhuhr: 'Dhuhr',
  Asr: 'Asr',
  Maghrib: 'Maghrib',
  Isha: 'Isha',
};

const PRAYER_NAME_AR: Record<PrayerKey, string> = {
  Fajr: 'الفجر',
  Dhuhr: 'الظهر',
  Asr: 'العصر',
  Maghrib: 'المغرب',
  Isha: 'العشاء',
};

const PRAYER_NAME_EN: Record<PrayerKey, string> = {
  Fajr: 'Fajr',
  Dhuhr: 'Dhuhr',
  Asr: 'Asr',
  Maghrib: 'Maghrib',
  Isha: 'Isha',
};

export function prayerName(key: PrayerKey, lang: Language): string {
  if (lang === 'ar') return PRAYER_NAME_AR[key] ?? key;
  if (lang === 'en') return PRAYER_NAME_EN[key] ?? key;
  return PRAYER_NAME_FR[key] ?? key;
}
