type Consent = {
  necessary: true;
  analytics: boolean;
  timestamp: string;
};

const CONSENT_KEY = "cookieConsent.v1";

function $(id: string): HTMLElement | null {
  return document.getElementById(id);
}

function getConsent(): Consent | null {
  try {
    return JSON.parse(
      localStorage.getItem(CONSENT_KEY) || "null"
    ) as Consent | null;
  } catch {
    return null;
  }
}

function setConsent(consent: { analytics: boolean }) {
  const data: Consent = {
    necessary: true,
    analytics: !!consent.analytics,
    timestamp: new Date().toISOString(),
  };
  try {
    localStorage.setItem(CONSENT_KEY, JSON.stringify(data));
  } catch {}
}

function applyConsent() {
  const c = getConsent();
  document.documentElement.dataset.analytics = c?.analytics ? "on" : "off";
}

function blockPageInteraction(banner: HTMLElement) {
  banner.setAttribute("aria-hidden", "false");
  document.documentElement.style.overflow = "hidden";
  document.body.style.overflow = "hidden";
}

function unblockPageInteraction() {
  document.documentElement.style.overflow = "";
  document.body.style.overflow = "";
}

function openBanner(banner: HTMLElement, panel: HTMLElement) {
  banner.hidden = false;
  panel.hidden = true;
  blockPageInteraction(banner);
  (banner.querySelector("button") as HTMLButtonElement | null)?.focus();
}

function closeBanner(banner: HTMLElement) {
  banner.hidden = true;
  unblockPageInteraction();
}

export function initCookieConsent() {
  if (typeof window === "undefined") return;

  const banner = $("cookie-banner") as HTMLElement | null;
  const panel = $("cookie-settings-panel") as HTMLElement | null;

  const acceptAllBtn = $("cookie-accept-all") as HTMLButtonElement | null;
  const rejectBtn = $("cookie-reject") as HTMLButtonElement | null;
  const settingsBtn = $("cookie-settings") as HTMLButtonElement | null;
  const saveBtn = $("cookie-save") as HTMLButtonElement | null;

  const analytics = $("cookie-analytics") as HTMLInputElement | null;

  if (!banner || !panel) return;

  if (banner.dataset.ccBound !== "1") {
    settingsBtn?.addEventListener("click", () => {
      panel.hidden = !panel.hidden;
    });

    acceptAllBtn?.addEventListener("click", () => {
      setConsent({ analytics: true });
      applyConsent();
      closeBanner(banner);
    });

    rejectBtn?.addEventListener("click", () => {
      setConsent({ analytics: false });
      applyConsent();
      closeBanner(banner);
    });

    saveBtn?.addEventListener("click", () => {
      setConsent({ analytics: !!analytics?.checked });
      applyConsent();
      closeBanner(banner);
    });

    document.addEventListener("keydown", (e) => {
      if (e.key !== "Escape") return;
      if (banner.hidden) return;

      const existing = getConsent();
      if (!existing) {
        setConsent({ analytics: false });
        applyConsent();
      }

      closeBanner(banner);
    });

    const openSettings = () => {
      const existing = getConsent();
      if (analytics) analytics.checked = !!existing?.analytics;

      openBanner(banner, panel);
      panel.hidden = false;
    };

    (window as any).openCookieSettings = openSettings;
    (window as any).__openCookieSettings = openSettings;

    document.addEventListener("cookie:open-settings", openSettings);

    banner.dataset.ccBound = "1";
  }

  const existing = getConsent();
  if (analytics) analytics.checked = !!existing?.analytics;

  if (!existing) {
    openBanner(banner, panel);
  } else {
    applyConsent();
    closeBanner(banner);
  }
}

function bindFooterCookieSettingsLink() {
  const link = document.getElementById(
    "footer-cookie-settings"
  ) as HTMLAnchorElement | null;
  if (!link) return;

  if (link.dataset.ccBound === "1") return;

  link.addEventListener("click", (e) => {
    e.preventDefault();
    openCookieSettings();
  });

  link.dataset.ccBound = "1";
}

export function openCookieSettings() {
  if (typeof window === "undefined") return;

  initCookieConsent();

  const fn =
    (window as any).openCookieSettings || (window as any).__openCookieSettings;
  if (typeof fn === "function") fn();
  else document.dispatchEvent(new CustomEvent("cookie:open-settings"));
}

export function initCookieClient() {
  if (typeof window === "undefined") return;

  const run = () => {
    initCookieConsent();
    bindFooterCookieSettingsLink();
  };
  if (!(window as any).__cookieUiBound) {
    document.addEventListener("astro:page-load", run);
    (window as any).__cookieUiBound = true;
  }
  run();
}
