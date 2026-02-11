import {
  ReactNode,
  SVGProps,
  useCallback,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/Button';
import { PageTransition } from '@/components/common/PageTransition';
import { MainRoutes } from '@/router/MainRoutes';
import {
  IconBot,
  IconChartLine,
  IconFileText,
  IconInfo,
  IconLayoutDashboard,
  IconScrollText,
  IconSettings,
  IconShield,
  IconTimer,
} from '@/components/ui/icons';
import { INLINE_LOGO_JPEG } from '@/assets/logoInline';
import {
  useAuthStore,
  useConfigStore,
  useLanguageStore,
  useNotificationStore,
  useThemeStore,
} from '@/stores';
import { versionApi } from '@/services/api';
import { triggerHeaderRefresh } from '@/hooks/useHeaderRefresh';
import { LANGUAGE_LABEL_KEYS, LANGUAGE_ORDER } from '@/utils/constants';
import { isSupportedLanguage } from '@/utils/language';

const sidebarIcons: Record<string, ReactNode> = {
  dashboard: <IconLayoutDashboard size={18} />,
  aiProviders: <IconBot size={18} />,
  authFiles: <IconFileText size={18} />,
  oauth: <IconShield size={18} />,
  quota: <IconTimer size={18} />,
  usage: <IconChartLine size={18} />,
  config: <IconSettings size={18} />,
  logs: <IconScrollText size={18} />,
  system: <IconInfo size={18} />,
};

// Header action icons - smaller size for header buttons
const headerIconProps: SVGProps<SVGSVGElement> = {
  width: 16,
  height: 16,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': 'true',
  focusable: 'false',
};

const headerIcons = {
  refresh: (
    <svg {...headerIconProps}>
      <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
      <path d="M21 3v5h-5" />
    </svg>
  ),
  update: (
    <svg {...headerIconProps}>
      <path d="M12 19V5" />
      <path d="m5 12 7-7 7 7" />
    </svg>
  ),
  menu: (
    <svg {...headerIconProps}>
      <path d="M4 7h16" />
      <path d="M4 12h16" />
      <path d="M4 17h16" />
    </svg>
  ),
  chevronLeft: (
    <svg {...headerIconProps}>
      <path d="m14 18-6-6 6-6" />
    </svg>
  ),
  chevronRight: (
    <svg {...headerIconProps}>
      <path d="m10 6 6 6-6 6" />
    </svg>
  ),
  language: (
    <svg {...headerIconProps}>
      <circle cx="12" cy="12" r="10" />
      <path d="M2 12h20" />
      <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" />
    </svg>
  ),
  sun: (
    <svg {...headerIconProps}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  ),
  moon: (
    <svg {...headerIconProps}>
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z" />
    </svg>
  ),
  autoTheme: (
    <svg {...headerIconProps}>
      <defs>
        <clipPath id="mainLayoutAutoThemeSunLeftHalf">
          <rect x="0" y="0" width="12" height="24" />
        </clipPath>
      </defs>
      <circle cx="12" cy="12" r="4" />
      <circle cx="12" cy="12" r="4" clipPath="url(#mainLayoutAutoThemeSunLeftHalf)" fill="currentColor" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="M4.93 4.93l1.41 1.41" />
      <path d="M17.66 17.66l1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="M6.34 17.66l-1.41 1.41" />
      <path d="M19.07 4.93l-1.41 1.41" />
    </svg>
  ),
  logout: (
    <svg {...headerIconProps}>
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
    </svg>
  ),
};

const parseVersionSegments = (version?: string | null) => {
  if (!version) return null;
  const cleaned = version.trim().replace(/^v/i, '');
  if (!cleaned) return null;
  const parts = cleaned
    .split(/[^0-9]+/)
    .filter(Boolean)
    .map((segment) => Number.parseInt(segment, 10))
    .filter(Number.isFinite);
  return parts.length ? parts : null;
};

const compareVersions = (latest?: string | null, current?: string | null) => {
  const latestParts = parseVersionSegments(latest);
  const currentParts = parseVersionSegments(current);
  if (!latestParts || !currentParts) return null;
  const length = Math.max(latestParts.length, currentParts.length);
  for (let i = 0; i < length; i++) {
    const l = latestParts[i] || 0;
    const c = currentParts[i] || 0;
    if (l > c) return 1;
    if (l < c) return -1;
  }
  return 0;
};

export function MainLayout() {
  const { t } = useTranslation();
  const { showNotification } = useNotificationStore();
  const location = useLocation();

  const serverVersion = useAuthStore((state) => state.serverVersion);
  const logout = useAuthStore((state) => state.logout);

  const config = useConfigStore((state) => state.config);
  const fetchConfig = useConfigStore((state) => state.fetchConfig);
  const clearCache = useConfigStore((state) => state.clearCache);

  const theme = useThemeStore((state) => state.theme);
  const cycleTheme = useThemeStore((state) => state.cycleTheme);
  const language = useLanguageStore((state) => state.language);
  const setLanguage = useLanguageStore((state) => state.setLanguage);

  const [mainMenuOpen, setMainMenuOpen] = useState(false);
  const [checkingVersion, setCheckingVersion] = useState(false);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const mainMenuRef = useRef<HTMLDivElement | null>(null);
  const headerRef = useRef<HTMLElement | null>(null);

  const abbrBrandName = t('title.abbr');
  const isLogsPage = location.pathname.startsWith('/logs');

  // Close menu on click outside
  useEffect(() => {


    if (!mainMenuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!mainMenuRef.current?.contains(event.target as Node)) {
        setMainMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [mainMenuOpen]);

  // 将顶栏高度写入 CSS 变量，确保侧栏/内容区计算一致，防止滚动时抖动
  useLayoutEffect(() => {
    const updateHeaderHeight = () => {
      const height = headerRef.current?.offsetHeight;
      if (height) {
        document.documentElement.style.setProperty('--header-height', `${height}px`);
      }
    };

    updateHeaderHeight();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && headerRef.current
        ? new ResizeObserver(updateHeaderHeight)
        : null;
    if (resizeObserver && headerRef.current) {
      resizeObserver.observe(headerRef.current);
    }

    window.addEventListener('resize', updateHeaderHeight);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', updateHeaderHeight);
    };
  }, []);

  // 将主内容区的中心点写入 CSS 变量，供底部浮层（配置面板操作栏、提供商导航）对齐到内容区
  useLayoutEffect(() => {
    const updateContentCenter = () => {
      const el = contentRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      document.documentElement.style.setProperty('--content-center-x', `${centerX}px`);
    };

    updateContentCenter();

    const resizeObserver =
      typeof ResizeObserver !== 'undefined' && contentRef.current
        ? new ResizeObserver(updateContentCenter)
        : null;

    if (resizeObserver && contentRef.current) {
      resizeObserver.observe(contentRef.current);
    }

    window.addEventListener('resize', updateContentCenter);

    return () => {
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      window.removeEventListener('resize', updateContentCenter);
      document.documentElement.style.removeProperty('--content-center-x');
    };
  }, []);

  // 5秒后自动收起品牌名称 - REMOVED

  const toggleMainMenu = useCallback(() => {
    setMainMenuOpen((prev) => !prev);
  }, []);

  const handleLanguageSelect = useCallback(
    (nextLanguage: string) => {
      if (!isSupportedLanguage(nextLanguage)) {
        return;
      }
      setLanguage(nextLanguage);
      setMainMenuOpen(false);
    },
    [setLanguage]
  );

  useEffect(() => {
    fetchConfig().catch(() => {
      // ignore initial failure; login flow会提示
    });
  }, [fetchConfig]);

  const centerNavItems = [
    { path: '/quota', label: t('nav.quota_management'), icon: sidebarIcons.quota },
    { path: '/usage', label: t('nav.usage_stats'), icon: sidebarIcons.usage },
    ...(config?.loggingToFile ? [{ path: '/logs', label: t('nav.logs'), icon: sidebarIcons.logs }] : []),
  ];

  const dropdownNavItems = [
    { path: '/dashboard', label: t('nav.dashboard'), icon: sidebarIcons.dashboard },
    { path: '/quota', label: t('nav.quota_management'), icon: sidebarIcons.quota },
    { path: '/usage', label: t('nav.usage_stats'), icon: sidebarIcons.usage },
    ...(config?.loggingToFile ? [{ path: '/logs', label: t('nav.logs'), icon: sidebarIcons.logs }] : []),
    { path: '/config', label: t('nav.config_management'), icon: sidebarIcons.config },
    { path: '/ai-providers', label: t('nav.ai_providers'), icon: sidebarIcons.aiProviders },
    { path: '/auth-files', label: t('nav.auth_files'), icon: sidebarIcons.authFiles },
    { path: '/oauth', label: t('nav.oauth', { defaultValue: 'OAuth' }), icon: sidebarIcons.oauth },
    { path: '/system', label: t('nav.system_info'), icon: sidebarIcons.system },
  ];

  const allNavItems = [...centerNavItems, ...dropdownNavItems];
  const navOrder = allNavItems.map((item) => item.path);

  const getRouteOrder = (pathname: string) => {
    const trimmedPath =
      pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
    const normalizedPath = trimmedPath === '/dashboard' ? '/' : trimmedPath;

    const aiProvidersIndex = navOrder.indexOf('/ai-providers');
    if (aiProvidersIndex !== -1) {
      if (normalizedPath === '/ai-providers') return aiProvidersIndex;
      if (normalizedPath.startsWith('/ai-providers/')) {
        if (normalizedPath.startsWith('/ai-providers/gemini')) return aiProvidersIndex + 0.1;
        if (normalizedPath.startsWith('/ai-providers/codex')) return aiProvidersIndex + 0.2;
        if (normalizedPath.startsWith('/ai-providers/claude')) return aiProvidersIndex + 0.3;
        if (normalizedPath.startsWith('/ai-providers/vertex')) return aiProvidersIndex + 0.4;
        if (normalizedPath.startsWith('/ai-providers/ampcode')) return aiProvidersIndex + 0.5;
        if (normalizedPath.startsWith('/ai-providers/openai')) return aiProvidersIndex + 0.6;
        return aiProvidersIndex + 0.05;
      }
    }

    const authFilesIndex = navOrder.indexOf('/auth-files');
    if (authFilesIndex !== -1) {
      if (normalizedPath === '/auth-files') return authFilesIndex;
      if (normalizedPath.startsWith('/auth-files/')) {
        if (normalizedPath.startsWith('/auth-files/oauth-excluded')) return authFilesIndex + 0.1;
        if (normalizedPath.startsWith('/auth-files/oauth-model-alias')) return authFilesIndex + 0.2;
        return authFilesIndex + 0.05;
      }
    }

    const exactIndex = navOrder.indexOf(normalizedPath);
    if (exactIndex !== -1) return exactIndex;
    const nestedIndex = navOrder.findIndex(
      (path) => path !== '/' && normalizedPath.startsWith(`${path}/`)
    );
    return nestedIndex === -1 ? null : nestedIndex;
  };

  const getTransitionVariant = useCallback((fromPathname: string, toPathname: string) => {
    const normalize = (pathname: string) => {
      const trimmed =
        pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname;
      return trimmed === '/dashboard' ? '/' : trimmed;
    };

    const from = normalize(fromPathname);
    const to = normalize(toPathname);
    const isAuthFiles = (pathname: string) =>
      pathname === '/auth-files' || pathname.startsWith('/auth-files/');
    const isAiProviders = (pathname: string) =>
      pathname === '/ai-providers' || pathname.startsWith('/ai-providers/');
    if (isAuthFiles(from) && isAuthFiles(to)) return 'ios';
    if (isAiProviders(from) && isAiProviders(to)) return 'ios';
    return 'vertical';
  }, []);

  const handleRefreshAll = async () => {
    clearCache();
    const results = await Promise.allSettled([
      fetchConfig(undefined, true),
      triggerHeaderRefresh()
    ]);
    const rejected = results.find((result) => result.status === 'rejected');
    if (rejected && rejected.status === 'rejected') {
      const reason = rejected.reason;
      const message =
        typeof reason === 'string' ? reason : reason instanceof Error ? reason.message : '';
      showNotification(
        `${t('notification.refresh_failed')}${message ? `: ${message}` : ''}`,
        'error'
      );
      return;
    }
    showNotification(t('notification.data_refreshed'), 'success');
    setMainMenuOpen(false);
  };

  const handleVersionCheck = async () => {
    setCheckingVersion(true);
    try {
      const data = await versionApi.checkLatest();
      const latestRaw = data?.['latest-version'] ?? data?.latest_version ?? data?.latest ?? '';
      const latest = typeof latestRaw === 'string' ? latestRaw : String(latestRaw ?? '');
      const comparison = compareVersions(latest, serverVersion);

      if (!latest) {
        showNotification(t('system_info.version_check_error'), 'error');
        return;
      }

      if (comparison === null) {
        showNotification(t('system_info.version_current_missing'), 'warning');
        return;
      }

      if (comparison > 0) {
        showNotification(t('system_info.version_update_available', { version: latest }), 'warning');
      } else {
        showNotification(t('system_info.version_is_latest'), 'success');
      }
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message : typeof error === 'string' ? error : '';
      const suffix = message ? `: ${message}` : '';
      showNotification(`${t('system_info.version_check_error')}${suffix}`, 'error');
    } finally {
      setCheckingVersion(false);
      setMainMenuOpen(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="main-header" ref={headerRef}>
        <div className="left">
          <img src={INLINE_LOGO_JPEG} alt="CPAMC logo" className="brand-logo" />
          <div className="brand-header">
            <span className="brand-abbr">{abbrBrandName}</span>
          </div>
        </div>

        <div className="center">
          <nav className="segmented-menu">
            {centerNavItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `segmented-item ${isActive ? 'active' : ''}`}
              >
                <span className="nav-icon">{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>

        <div className="right">
          <div className="menu-trigger" ref={mainMenuRef}>
            <Button
              variant="ghost"
              size="sm"
              onClick={toggleMainMenu}
              aria-label="Main Menu"
              className={mainMenuOpen ? 'active' : ''}
            >
              {headerIcons.menu}
            </Button>

            {mainMenuOpen && (
              <div className="main-menu-popover">
                <div className="menu-section">
                  <span className="menu-section-title">{t('common.navigation')}</span>
                  {dropdownNavItems.map((item) => (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      className={({ isActive }) => `menu-item ${isActive ? 'active' : ''}`}
                      onClick={() => setMainMenuOpen(false)}
                    >
                      <span className="menu-icon">{item.icon}</span>
                      <span className="menu-label">{item.label}</span>
                    </NavLink>
                  ))}
                </div>

                <div className="menu-section">
                  <span className="menu-section-title">{t('common.actions')}</span>
                  <button className="menu-item" onClick={handleRefreshAll}>
                    <span className="menu-icon">{headerIcons.refresh}</span>
                    <span className="menu-label">{t('header.refresh_all')}</span>
                  </button>
                  <button className="menu-item" onClick={handleVersionCheck} disabled={checkingVersion}>
                    <span className="menu-icon">{headerIcons.update}</span>
                    <span className="menu-label">{t('system_info.version_check_button')}</span>
                  </button>
                  <button className="menu-item" onClick={cycleTheme}>
                    <span className="menu-icon">
                      {theme === 'auto'
                        ? headerIcons.autoTheme
                        : theme === 'dark'
                          ? headerIcons.moon
                          : headerIcons.sun}
                    </span>
                    <span className="menu-label">{t('theme.switch')}</span>
                    <span className="menu-shortcut">
                      {theme === 'auto' ? 'Auto' : theme === 'dark' ? 'Dark' : 'Light'}
                    </span>
                  </button>

                  {/* Language Selection */}
                  <div className="menu-item" style={{ cursor: 'default', pointerEvents: 'none' }}>
                    <span className="menu-icon">{headerIcons.language}</span>
                    <span className="menu-label">{t('language.switch')}</span>
                  </div>
                  <div style={{ display: 'flex', gap: '4px', padding: '0 12px 8px 12px', flexWrap: 'wrap' }}>
                    {LANGUAGE_ORDER.map((lang) => (
                      <Button
                        key={lang}
                        variant={language === lang ? 'primary' : 'secondary'}
                        size="sm"
                        onClick={() => handleLanguageSelect(lang)}
                        style={{ fontSize: '12px', padding: '4px 8px', height: '24px' }}
                      >
                        {t(LANGUAGE_LABEL_KEYS[lang])}
                      </Button>
                    ))}
                  </div>

                  <div style={{ borderTop: '1px solid var(--border-color)', margin: '4px 0' }}></div>

                  <button className="menu-item" onClick={logout} style={{ color: 'var(--danger-color)' }}>
                    <span className="menu-icon" style={{ color: 'var(--danger-color)' }}>{headerIcons.logout}</span>
                    <span className="menu-label">{t('header.logout')}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="main-body">
        <div className={`content${isLogsPage ? ' content-logs' : ''}`} ref={contentRef}>
          <main className={`main-content${isLogsPage ? ' main-content-logs' : ''}`}>
            <PageTransition
              render={(location) => <MainRoutes location={location} />}
              getRouteOrder={getRouteOrder}
              getTransitionVariant={getTransitionVariant}
              scrollContainerRef={contentRef}
            />
          </main>
        </div>
      </div>
    </div>
  );
}
