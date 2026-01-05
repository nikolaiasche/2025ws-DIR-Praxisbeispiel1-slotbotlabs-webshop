type PayMethod = "googlepay" | "applepay" | "card";
type PlanId = "standard" | "premium";
const STORAGE_KEY = "checkoutPlan";

type Plan = {
  id: PlanId;
  name: string;
  priceCents: number;
  tagline: string;
  features: string[];
};

type CheckoutConfig = {
  vatRate: number;
  plans: Record<PlanId, Plan>;
};

const $ = <T extends Element = Element>(sel: string, root: ParentNode = document) =>
  root.querySelector<T>(sel);

function readCheckoutConfig(): CheckoutConfig {
  const el = document.getElementById("checkout-config") as HTMLScriptElement | null;
  const raw = el?.textContent?.trim();

  if (!raw) {
    throw new Error(
      'Missing checkout config. Expected <script id="checkout-config" type="application/json">...</script>.'
    );
  }

  const parsed = JSON.parse(raw) as Partial<CheckoutConfig>;

  if (typeof parsed.vatRate !== "number") {
    throw new Error("Invalid checkout config: vatRate must be a number.");
  }

  const plans = parsed.plans as CheckoutConfig["plans"] | undefined;
  if (!plans || typeof plans !== "object") {
    throw new Error("Invalid checkout config: plans missing.");
  }

  for (const id of ["standard", "premium"] as PlanId[]) {
    const p = plans[id];
    if (
      !p ||
      p.id !== id ||
      typeof p.name !== "string" ||
      typeof p.tagline !== "string" ||
      typeof p.priceCents !== "number" ||
      !Array.isArray(p.features)
    ) {
      throw new Error(`Invalid checkout config: plan "${id}" missing or malformed.`);
    }
  }

  return { vatRate: parsed.vatRate, plans };
}
let CONFIG: CheckoutConfig;
CONFIG = readCheckoutConfig();

document.addEventListener("click", (e) => {
  const target = e.target as Element | null;
  if (!target) return;

  const link = target.closest<HTMLAnchorElement>("a[data-plan]");
  if (!link) return;

  const planId = normalizePlanId(link.dataset.plan);
  if (!planId) return;

  storePlan(planId);

  if (isModifiedClick(e)) return;
  if (link.target && link.target !== "_self") return;

  e.preventDefault();
  window.location.assign(link.href);
});

function isModifiedClick(e: MouseEvent) {
  return e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0;
}

function normalizePlanId(v: unknown): PlanId | null {
  const s = String(v ?? "").toLowerCase().trim();
  if (s === "standard") return "standard";
  if (s === "premium") return "premium";
  return null;
}

function getPlanFromUrl(): PlanId | null {
  const params = new URLSearchParams(window.location.search);
  return normalizePlanId(params.get("plan"));
}

function stripPlanParamFromUrl() {
  const url = new URL(window.location.href);
  if (!url.searchParams.has("plan")) return;

  url.searchParams.delete("plan");
  const next = url.pathname + (url.search ? url.search : "") + (url.hash ? url.hash : "");
  window.history.replaceState({}, "", next);
}

function storePlan(plan: PlanId) {
  try {
    localStorage.setItem(STORAGE_KEY, plan);
  } catch {
    // ignore
  }
}

function readPlanFromStorage(): PlanId | null {
  try {
    return normalizePlanId(localStorage.getItem(STORAGE_KEY));
  } catch {
    return null;
  }
}

function resolvePlanId(): { planId: PlanId; hadPlanParam: boolean } {
  const params = new URLSearchParams(window.location.search);
  const hadPlanParam = params.has("plan");

  const fromUrl = getPlanFromUrl();
  if (fromUrl) {
    storePlan(fromUrl);
    return { planId: fromUrl, hadPlanParam };
  }

  const fromStorage = readPlanFromStorage();
  if (fromStorage) return { planId: fromStorage, hadPlanParam };

  return { planId: "standard", hadPlanParam };
}

function calcPrices(priceCents: number, vatRate: number) {
  const fmt = new Intl.NumberFormat("de-AT", { style: "currency", currency: "EUR" });
  const gross = priceCents / 100;
  const net = Math.round((gross / (1 + vatRate)) * 100) / 100;
  const vat = Math.round((gross - net) * 100) / 100;

  return {
    fmt,
    gross,
    net,
    vat,
    grossLabel: `${fmt.format(gross)} / Monat`,
  };
}

function applyPlanToUi(planId: PlanId, form: HTMLFormElement) {
  const plan = CONFIG.plans[planId] ?? CONFIG.plans.standard;

  form.dataset.planId = plan.id;
  form.dataset.planName = plan.name;
  form.dataset.planPriceCents = String(plan.priceCents);

  const planBox =
    document.querySelector<HTMLElement>(".summaryScroll .planBox") ??
    document.querySelector<HTMLElement>(".planBox");

  if (planBox) {
    planBox.classList.toggle("highlight", plan.id === "premium");

    const nameEl = planBox.querySelector<HTMLElement>(".planName");
    if (nameEl) nameEl.textContent = plan.name;

    const taglineEl = planBox.querySelector<HTMLElement>(".planTop .muted.small");
    if (taglineEl) taglineEl.textContent = plan.tagline;

    const planTop = planBox.querySelector<HTMLElement>(".planTop");
    let badgeEl = planBox.querySelector<HTMLElement>(".badge");

    if (plan.id === "premium") {
      if (!badgeEl && planTop) {
        badgeEl = document.createElement("span");
        badgeEl.className = "badge";
        badgeEl.textContent = "Empfohlen";
        planTop.appendChild(badgeEl);
      }
    } else {
      badgeEl?.remove();
    }

    const featuresEl = planBox.querySelector<HTMLUListElement>(".miniFeatures");
    if (featuresEl) {
      featuresEl.innerHTML = "";
      for (const f of plan.features) {
        const li = document.createElement("li");

        const dot = document.createElement("span");
        dot.className = "dot";
        dot.setAttribute("aria-hidden", "true");

        const text = document.createElement("span");
        text.textContent = f;

        li.appendChild(dot);
        li.appendChild(text);
        featuresEl.appendChild(li);
      }
    }
  }

  const { fmt, gross, net, vat, grossLabel } = calcPrices(plan.priceCents, CONFIG.vatRate);

  const priceBox = document.querySelector<HTMLElement>(".priceBox");
  if (priceBox) {
    const rows = Array.from(priceBox.querySelectorAll<HTMLElement>(".row"));
    for (const row of rows) {
      const label = row.querySelector("span")?.textContent?.toLowerCase() ?? "";
      const strong = row.querySelector<HTMLElement>("strong");
      if (!strong) continue;

      if (label.includes("zwischensumme")) strong.textContent = fmt.format(net);
      else if (label.includes("ust")) strong.textContent = fmt.format(vat);
      else if (label.includes("gesamt")) strong.textContent = fmt.format(gross);
    }
  }

  const invoiceMeta = document.querySelector<HTMLElement>(".invoiceMeta");
  if (invoiceMeta) {
    const metaLines = Array.from(invoiceMeta.querySelectorAll<HTMLDivElement>("div"));
    const leistungStrong = metaLines[1]?.querySelector<HTMLElement>("strong");
    const betragStrong = metaLines[2]?.querySelector<HTMLElement>("strong");

    if (leistungStrong) leistungStrong.textContent = `Abo ${plan.name}`;
    if (betragStrong) betragStrong.textContent = grossLabel;
  }

  document.title = `Mock: Checkout – ${plan.name}`;
}

function methodLabel(value: PayMethod): string {
  if (value === "googlepay") return "Mock: Google Pay";
  if (value === "applepay") return "Mock: Apple Pay";
  return "Mock: Kreditkarte (z. B. Visa)";
}

function setCardRequired(isRequired: boolean) {
  const cardName = $("#cardName") as HTMLInputElement | null;
  const cardNumber = $("#cardNumber") as HTMLInputElement | null;
  const cardExp = $("#cardExp") as HTMLInputElement | null;
  const cardCvc = $("#cardCvc") as HTMLInputElement | null;

  for (const el of [cardName, cardNumber, cardExp, cardCvc]) {
    if (!el) continue;
    el.required = isRequired;
  }
}

function setMethod(value: PayMethod, payBtn: HTMLButtonElement, cardFields: HTMLElement) {
  const isCard = value === "card";
  cardFields.hidden = !isCard;
  setCardRequired(isCard);

  if (value === "googlepay") payBtn.textContent = "Mock: Mit Google Pay bezahlen";
  else if (value === "applepay") payBtn.textContent = "Mock: Mit Apple Pay bezahlen";
  else payBtn.textContent = "Mock: Mit Kreditkarte bezahlen";
}

function fillOutSuccess(data: Record<string, string>) {
  const write = (key: string, value: string) => {
    document
      .querySelectorAll<HTMLElement>(`[data-out="${key}"]`)
      .forEach((el) => (el.textContent = value));
  };

  for (const [k, v] of Object.entries(data)) write(k, v);
}

function focusFirstInvalid(form: HTMLFormElement) {
  const first = form.querySelector<HTMLElement>(":invalid");
  first?.focus?.();
}

(function initCheckout() {
  const grid = $("#checkoutGrid") as HTMLElement | null;
  const form = $("#checkoutForm") as HTMLFormElement | null;
  const statusEl = $("#formStatus") as HTMLElement | null;
  const payBtn = $("#payBtn") as HTMLButtonElement | null;
  const cardFields = $("#cardFields") as HTMLElement | null;
  const successPanel = $("#successPanel") as HTMLElement | null;

  if (!grid || !form || !statusEl || !payBtn || !cardFields || !successPanel) return;

  const { planId, hadPlanParam } = resolvePlanId();
  applyPlanToUi(planId, form);

  if (hadPlanParam) stripPlanParamFromUrl();

  const methodInputs = Array.from(
    form.querySelectorAll<HTMLInputElement>('input[name="payMethod"]')
  );

  const checked = methodInputs.find((i) => i.checked);
  setMethod((checked?.value as PayMethod) ?? "card", payBtn, cardFields);

  methodInputs.forEach((input) => {
    input.addEventListener("change", () => {
      setMethod(input.value as PayMethod, payBtn, cardFields);
    });
  });

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    statusEl.textContent = "";

    if (!form.checkValidity()) {
      statusEl.textContent =
        "Bitte prüfe die Eingaben! Es fehlen Pflichtfelder oder Angaben sind ungültig.";
      focusFirstInvalid(form);
      return;
    }

    const method =
      (form.querySelector<HTMLInputElement>('input[name="payMethod"]:checked')?.value as PayMethod) ??
      "card";

    payBtn.disabled = true;
    payBtn.classList.add("loading");
    statusEl.textContent = "Mock: Zahlung wird verarbeitet…";

    const fd = new FormData(form);

    const invoiceNo = `SBB-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;
    const date = new Intl.DateTimeFormat("de-AT", { dateStyle: "medium" }).format(new Date());

    const countryMap: Record<string, string> = {
      AT: "Österreich",
      DE: "Deutschland",
      CH: "Schweiz",
      EU: "EU",
      OTHER: "Sonstiges",
    };

    const planName = (form.dataset.planName ?? "Standard").trim();
    const planPriceCents = Number(form.dataset.planPriceCents ?? "0");
    const { grossLabel } = calcPrices(
      Number.isFinite(planPriceCents) ? planPriceCents : 0,
      CONFIG.vatRate
    );

    const firstName = String(fd.get("firstName") || "").trim();
    const lastName = String(fd.get("lastName") || "").trim();
    const countryCode = String(fd.get("country") || "").trim();

    const payload: Record<string, string> = {
      planName,
      invoiceNo,
      methodLabel: methodLabel(method),
      email: String(fd.get("email") || ""),
      date,

      fullName: `${firstName} ${lastName}`.trim(),
      address: String(fd.get("address") || ""),
      zipCity: `${String(fd.get("zip") || "")} ${String(fd.get("city") || "")}`.trim(),
      country: countryMap[countryCode] || countryCode,
    };

    setTimeout(() => {
      payBtn.disabled = false;
      payBtn.classList.remove("loading");
      statusEl.textContent = "";

      grid.hidden = true;
      successPanel.hidden = false;

      fillOutSuccess(payload);

      const planIdNow = normalizePlanId(form.dataset.planId) ?? "standard";
      const planNow = CONFIG.plans[planIdNow] ?? CONFIG.plans.standard;

      const invoiceMeta = document.querySelector<HTMLElement>(".invoiceMeta");
      if (invoiceMeta) {
        const metaLines = Array.from(invoiceMeta.querySelectorAll<HTMLDivElement>("div"));
        const leistungStrong = metaLines[1]?.querySelector<HTMLElement>("strong");
        const betragStrong = metaLines[2]?.querySelector<HTMLElement>("strong");

        if (leistungStrong) leistungStrong.textContent = `Abo ${planNow.name}`;
        if (betragStrong) betragStrong.textContent = grossLabel;
      }

      $("#printBtn")?.addEventListener("click", () => window.print(), { once: true });

      successPanel.scrollIntoView({ behavior: "smooth", block: "start" });
      successPanel.querySelector<HTMLElement>("h2")?.focus?.();
    }, 900);
  });
})();





