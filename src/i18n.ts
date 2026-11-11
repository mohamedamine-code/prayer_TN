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
  fontSize: string;
  fontSmall: string;
  fontMedium: string;
  fontBig: string;
  opacity: string;
  resetSettings: string;
  about: string;
  version: string;
  lastUpdated: string;
  updaterSection: string;
  updaterCheck: string;
  updaterChecking: string;
  updaterUpToDate: string;
  updaterAvailable: string;
  updaterDownloading: string;
  updaterDownloaded: string;
  updaterDownload: string;
  updaterRestartInstall: string;
  updaterLater: string;
  updaterReleaseNotes: string;
  updaterNewVersion: string;
  updaterLastCheck: string;
  updaterAutoHint: string;
  updaterDisabled: string;
  updaterErrorNetwork: string;
  updaterErrorMetadata: string;
  updaterErrorUnknown: string;
  updaterProgressOf: string;
  connectionOnline: string;
  connectionOffline: string;
  usingCache: string;
  refreshNow: string;
  methodTunisia: string;
  close: string;
  minimize: string;
  maximizeRestore: string;
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
  iqama: string;
  iqamaConfig: string;
  iqamaDelayHint: string;
  iqamaNotConfigured: string;
  iqamaResetDefaults: string;
  minutes: string;
  plusDelay: string;
  minusDelay: string;
  iqamaUnavailable: string;
  iqamaErrorInvalid: string;
  iqamaErrorMin: string;
  iqamaErrorMax: string;
  iqamaFocus: string;
  iqamaFocusHint: string;
  focusDuration: string;
  focusTitle: string;
  focusMsg: string;
  focusEndEarly: string;
  focusRemaining: string;
  focusUntilIqama: string;
  locSection: string;
  locToggle: string;
  locPermission: string;
  locPermGranted: string;
  locPermDeclined: string;
  locPermNotAsked: string;
  locNever: string;
  locRefresh: string;
  locLastCity: string;
  locLastUpdate: string;
  locManualBtn: string;
  locManualHint: string;
  locClear: string;
  locPermTitle: string;
  locPermBody: string;
  locPermPrivacy: string;
  locPermLater: string;
  locAllow: string;
  locNotNow: string;
  locActive: string;
  locDetecting: string;
  locLocked: string;
  locUnavailable: string;
  locErrPermission: string;
  locErrUnavailable: string;
  locErrTimeout: string;
  locErrUnsupported: string;
  locWindowsHint: string;
  locDenyTitle: string;
  locDenyBody: string;
  locRetry: string;
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
  fontSize: 'Taille du texte',
  fontSmall: 'Petite',
  fontMedium: 'Moyenne',
  fontBig: 'Grande',
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
  maximizeRestore: 'Agrandir / Restaurer',
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
  iqama: 'Iqama',
  iqamaConfig: "Configuration de l'Iqama",
  iqamaDelayHint: 'Délai minimum entre l’heure de la prière et l’Iqama : 5 minutes.',
  iqamaNotConfigured: 'non configurée',
  iqamaResetDefaults: 'Réinitialiser les délais',
  minutes: 'min',
  plusDelay: 'Augmenter le délai',
  minusDelay: 'Réduire le délai',
  iqamaUnavailable: 'Iqama indisponible',
  iqamaErrorInvalid: 'Nombre entier de minutes requis.',
  iqamaErrorMin: '5 minutes minimum.',
  iqamaErrorMax: '120 minutes maximum.',
  iqamaFocus: 'Mode focus Iqama',
  iqamaFocusHint:
    'À l’adhan, le widget flottant passe en mode focus jusqu’à l’Iqama (compte à rebours dédié + notification). Une seule notification par prière par jour.',
  focusDuration: 'Durée du focus',
  focusTitle: 'Focus Iqama',
  focusMsg: 'Prenez un moment pour la prière.',
  focusEndEarly: 'Terminer le focus',
  focusRemaining: 'Temps restant',
  focusUntilIqama: 'Temps avant l’Iqama',
  locSection: 'Localisation automatique',
  locToggle: 'Localisation automatique',
  locPermission: 'Statut de permission',
  locPermGranted: 'Autorisée',
  locPermDeclined: 'Refusée',
  locPermNotAsked: 'Non demandée',
  locNever: 'jamais',
  locRefresh: 'Actualiser ma position',
  locLastCity: 'Dernière position détectée',
  locLastUpdate: 'Dernière mise à jour',
  locManualBtn: 'Utiliser la sélection manuelle de ville',
  locManualHint:
    'Quand la localisation automatique est désactivée, la prière utilise la ville choisie ci-dessus.',
  locClear: 'Effacer la position enregistrée',
  locPermTitle: '📍 Activer la localisation automatique',
  locPermBody:
    'Salati Tunisia souhaite accéder à votre position pour calculer des horaires de prière précis selon votre emplacement actuel.',
  locPermPrivacy:
    'Vos coordonnées restent sur cet appareil et ne servent qu’au calcul des horaires.',
  locPermLater: 'Vous pourrez activer la localisation plus tard dans Paramètres.',
  locAllow: 'Autoriser la localisation',
  locNotNow: 'Pas maintenant',
  locActive: 'Position active',
  locDetecting: 'Détection de la position…',
  locLocked: 'Localisation : autorisation requise',
  locUnavailable: 'Position indisponible',
  locErrPermission: "L'accès à la localisation a été refusé.",
  locErrUnavailable: 'La position n’a pas pu être déterminée. Réessayez plus tard.',
  locErrTimeout: 'Détection de position trop lente. Réessayez.',
  locErrUnsupported: 'La géolocalisation n’est pas prise en charge sur cet appareil.',
  locWindowsHint:
    'Vérifiez aussi Windows : Paramètres → Confidentialité → Localisation (service activé + autorisé pour les applications).',
  locDenyTitle: 'Localisation refusée',
  locDenyBody:
    'Les horaires utilisent la ville sélectionnée manuellement. Vous pouvez réessayer la localisation automatique ou autoriser la géolocalisation dans les réglages Windows.',
  locRetry: 'Réessayer la localisation',
  updaterSection: 'Mises à jour',
  updaterCheck: 'Rechercher des mises à jour',
  updaterChecking: 'Recherche de mise à jour…',
  updaterUpToDate: 'Vous avez la dernière version',
  updaterAvailable: 'Nouvelle version disponible',
  updaterDownloading: 'Téléchargement de la mise à jour…',
  updaterDownloaded: 'Mise à jour prête à installer',
  updaterDownload: 'Télécharger la mise à jour',
  updaterRestartInstall: 'Redémarrer et installer',
  updaterLater: 'Plus tard',
  updaterReleaseNotes: 'Notes de version',
  updaterNewVersion: 'Nouvelle version',
  updaterLastCheck: 'Dernière vérification',
  updaterAutoHint: 'Vérification automatique toutes les 6 heures après le lancement.',
  updaterDisabled: 'Mises à jour désactivées (environ. de développement).',
  updaterErrorNetwork: 'Impossible de vérifier. Vérifiez votre connexion Internet.',
  updaterErrorMetadata: 'Informations de mise à jour invalides sur le serveur.',
  updaterErrorUnknown: 'La vérification de mise à jour a échoué.',
  updaterProgressOf: 'sur',
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
  fontSize: 'حجم الخط',
  fontSmall: 'صغير',
  fontMedium: 'متوسط',
  fontBig: 'كبير',
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
  maximizeRestore: 'تكبير / استعادة',
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
  iqama: 'الإقامة',
  iqamaConfig: 'إعداد الإقامة',
  iqamaDelayHint: 'الحد الأدنى للفاصل بين وقت الصلاة والإقامة: 5 دقائق.',
  iqamaNotConfigured: 'غير مضبوطة',
  iqamaResetDefaults: 'إعادة تعيين التأخيرات',
  minutes: 'د',
  plusDelay: 'زيادة التأخير',
  minusDelay: 'تقليص التأخير',
  iqamaUnavailable: 'الإقامة غير متوفرة',
  iqamaErrorInvalid: 'المرجو إدخال عدد صحيح من الدقائق.',
  iqamaErrorMin: 'الحد الأدنى 5 دقائق.',
  iqamaErrorMax: 'الحد الأقصى 120 دقيقة.',
  iqamaFocus: 'وضع التركيز للإقامة',
  iqamaFocusHint:
    'من وقت الأذان إلى وقت الإقامة ينتقل الودجت العائم إلى وضع التركيز (عدّاد مخصص + إشعار). إشعار واحد فقط لكل صلاة في اليوم.',
  focusDuration: 'مدة التركيز',
  focusTitle: 'تركيز الإقامة',
  focusMsg: 'خصص وقتا للصلاة.',
  focusEndEarly: 'إنهاء التركيز',
  focusRemaining: 'الوقت المتبقي',
  focusUntilIqama: 'حتى الإقامة',
  locSection: 'الموقع التلقائي',
  locToggle: 'الموقع التلقائي',
  locPermission: 'حالة الإذن',
  locPermGranted: 'مسموح',
  locPermDeclined: 'مرفوض',
  locPermNotAsked: 'لم يُطلب',
  locNever: 'أبدًا',
  locRefresh: 'تحديث موقعي',
  locLastCity: 'آخر موقع تم اكتشافه',
  locLastUpdate: 'آخر تحديث',
  locManualBtn: 'استخدام اختيار المدينة اليدوي',
  locManualHint: 'عند تعطيل الموقع التلقائي تُستخدم المدينة المحددة أعلاه لحساب الأوقات.',
  locClear: 'مسح الموقع المحفوظ',
  locPermTitle: '📍 تمكين الموقع التلقائي',
  locPermBody: 'يرغب تطبيق صلاتي تونس في الوصول إلى موقعك لحساب أوقات الصلاة بدقة حسب موقعك الحالي.',
  locPermPrivacy: 'تبقى إحداثياتك على هذا الجهاز وتُستخدم فقط لحساب أوقات الصلاة',
  locPermLater: 'يمكنك تمكين الموقع لاحقًا من الإعدادات.',
  locAllow: 'السماح بالموقع',
  locNotNow: 'ليس الآن',
  locActive: 'الموقع نشط',
  locDetecting: 'جارٍ تحديد الموقع…',
  locLocked: 'الموقع: مطلوب الإذن',
  locUnavailable: 'الموقع غير متوفر',
  locErrPermission: 'تم رفض الوصول إلى الموقع.',
  locErrUnavailable: 'تعذر تحديد الموقع. أعد المحاولة لاحقًا.',
  locErrTimeout: 'تحديد الموقع كان بطيئًا جدًا. أعد المحاولة.',
  locErrUnsupported: 'تحديد الموقع غير مدعوم على هذا الجهاز.',
  locWindowsHint: 'تحقق أيضًا من ويندوز: الإعدادات ← الخصوصية ← الموقع (تفعيل الخدمة والسماح للتطبيقات).',
  locDenyTitle: 'تم رفض الموقع',
  locDenyBody: 'تُستخدم المدينة المحددة يدويًا في الحساب. يمكنك إعادة محاولة الموقع التلقائي أو السماح بتحديد الموقع من إعدادات ويندوز.',
  locRetry: 'إعادة محاولة تحديد الموقع',
  updaterSection: 'التحديثات',
  updaterCheck: 'التحقق من وجود تحديثات',
  updaterChecking: 'جارٍ التحقق من التحديثات…',
  updaterUpToDate: 'لديك الإصدار الأحدث',
  updaterAvailable: 'يتوفر إصدار جديد',
  updaterDownloading: 'جارٍ تنزيل التحديث…',
  updaterDownloaded: 'التحديث جاهز للتثبيت',
  updaterDownload: 'تنزيل التحديث',
  updaterRestartInstall: 'أعد التشغيل والتثبيت',
  updaterLater: 'لاحقًا',
  updaterReleaseNotes: 'ملاحظات الإصدار',
  updaterNewVersion: 'الإصدار الجديد',
  updaterLastCheck: 'آخر تحقق',
  updaterAutoHint: 'فحص تلقائي كل 6 ساعات بعد الإطلاق.',
  updaterDisabled: 'التحديثات معطّلة (بيئة التطوير).',
  updaterErrorNetwork: 'تعذر التحقق. تحقق من اتصالك بالإنترنت.',
  updaterErrorMetadata: 'معلومات التحديث على الخادم غير صالحة.',
  updaterErrorUnknown: 'فشل التحقق من التحديثات.',
  updaterProgressOf: 'من',
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
  fontSize: 'Text size',
  fontSmall: 'Small',
  fontMedium: 'Medium',
  fontBig: 'Big',
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
  maximizeRestore: 'Maximize / Restore',
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
  iqama: 'Iqama',
  iqamaConfig: 'Iqama Configuration',
  iqamaDelayHint: 'Minimum delay between prayer time and Iqama: 5 minutes.',
  iqamaNotConfigured: 'not configured',
  iqamaResetDefaults: 'Reset delays',
  minutes: 'min',
  plusDelay: 'Increase delay',
  minusDelay: 'Decrease delay',
  iqamaUnavailable: 'Iqama unavailable',
  iqamaErrorInvalid: 'Enter a whole number of minutes.',
  iqamaErrorMin: 'Minimum 5 minutes.',
  iqamaErrorMax: 'Maximum 120 minutes.',
  iqamaFocus: 'Iqama Focus Mode',
  iqamaFocusHint:
    'From the adhan until the Iqama the floating widget switches to Focus Mode (dedicated countdown + notification). One notification per prayer per day.',
  focusDuration: 'Focus duration',
  focusTitle: 'Iqama Focus',
  focusMsg: 'Take a moment for prayer.',
  focusEndEarly: 'End Focus Mode',
  focusRemaining: 'Time remaining',
  focusUntilIqama: 'Time until Iqama',
  locSection: 'Automatic location',
  locToggle: 'Automatic location',
  locPermission: 'Permission status',
  locPermGranted: 'Granted',
  locPermDeclined: 'Denied',
  locPermNotAsked: 'Not asked yet',
  locNever: 'never',
  locRefresh: 'Refresh my location',
  locLastCity: 'Last detected location',
  locLastUpdate: 'Last update',
  locManualBtn: 'Use manual city selection',
  locManualHint:
    'When automatic location is disabled, prayers use the city selected above.',
  locClear: 'Clear stored location',
  locPermTitle: '📍 Enable automatic location',
  locPermBody:
    'Salati Tunisia would like to access your location to calculate accurate prayer times for your current position.',
  locPermPrivacy:
    'Your coordinates stay on this device and are used only to calculate prayer times.',
  locPermLater: 'You can enable location later from Settings.',
  locAllow: 'Allow Location',
  locNotNow: 'Not Now',
  locActive: 'Location active',
  locDetecting: 'Detecting location…',
  locLocked: 'Location permission required',
  locUnavailable: 'Location unavailable',
  locErrPermission: 'Location access was denied.',
  locErrUnavailable: 'Your position could not be determined. Try again later.',
  locErrTimeout: 'Position detection was too slow. Try again.',
  locErrUnsupported: 'Geolocation is not supported on this device.',
  locWindowsHint:
    'Also check Windows: Settings → Privacy → Location (service on + allowed for apps).',
  locDenyTitle: 'Location denied',
  locDenyBody:
    'Prayer times use the manually selected city. You can retry automatic location or allow geolocation in Windows settings.',
  locRetry: 'Retry location',
  updaterSection: 'Updates',
  updaterCheck: 'Check for updates',
  updaterChecking: 'Checking for updates…',
  updaterUpToDate: 'You are up to date',
  updaterAvailable: 'New version available',
  updaterDownloading: 'Downloading update…',
  updaterDownloaded: 'Update ready to install',
  updaterDownload: 'Download update',
  updaterRestartInstall: 'Restart & install',
  updaterLater: 'Later',
  updaterReleaseNotes: 'Release notes',
  updaterNewVersion: 'New version',
  updaterLastCheck: 'Last check',
  updaterAutoHint: 'Automatic check every 6 hours after launch.',
  updaterDisabled: 'Updates disabled (development environment).',
  updaterErrorNetwork: 'Could not check. Verify your Internet connection.',
  updaterErrorMetadata: 'Invalid update information on the server.',
  updaterErrorUnknown: 'Update check failed.',
  updaterProgressOf: 'of',
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
