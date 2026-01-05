type ContactEls = {
  form: HTMLFormElement;
  submitBtn: HTMLButtonElement;
  statusBox: HTMLDivElement;
  statusTitle: HTMLElement;
  statusText: HTMLElement;
};

function getContactEls(): ContactEls | null {
  const form = document.getElementById("contactForm") as HTMLFormElement | null;
  const submitBtn = document.getElementById("submitBtn") as HTMLButtonElement | null;

  const statusBox = document.getElementById("statusBox") as HTMLDivElement | null;
  const statusTitle = document.getElementById("statusTitle") as HTMLElement | null;
  const statusText = document.getElementById("statusText") as HTMLElement | null;

  if (!form || !submitBtn || !statusBox || !statusTitle || !statusText) return null;

  return { form, submitBtn, statusBox, statusTitle, statusText };
}

export function initContactForm(): void {
  const els = getContactEls();
  if (!els) {
    console.warn("Kontaktformular: Elemente nicht gefunden (IDs prüfen).");
    return;
  }

  const { form, submitBtn, statusBox, statusTitle, statusText } = els;

  function setStatus(type: "success" | "error", title: string, text: string): void {
    statusBox.hidden = false;
    statusBox.dataset.type = type;
    statusTitle.textContent = title;
    statusText.textContent = text;
  }

  function clearStatus(): void {
    statusBox.hidden = true;
    statusBox.dataset.type = "";
    statusTitle.textContent = "";
    statusText.textContent = "";
  }

  form.addEventListener("reset", () => {
    submitBtn.disabled = false;
    submitBtn.textContent = "Mock: Nachricht senden";
    clearStatus();
  });

  form.addEventListener("submit", async (e: SubmitEvent) => {
    e.preventDefault();
    clearStatus();

    if (!form.checkValidity()) {
      form.reportValidity();
      setStatus("error", "Bitte prüfe deine Eingaben!", "Ein oder mehrere Pflichtfelder fehlen bzw. sind fehlerhaft.");
      return;
    }

    submitBtn.disabled = true;
    submitBtn.textContent = "Sende …";
    await new Promise((r) => setTimeout(r, 900));

    const ok = Math.random() > 0.08;

    if (ok) {
      setStatus("success", "Mock: Nachricht gesendet.", "Dies ist eine Simulation.");
      submitBtn.textContent = "Mock: Gesendet";
    } else {
      setStatus("error", "Mock-Fehler.", "Mock: Simulierter Versandfehler. Bitte versuche es erneut.");
      submitBtn.disabled = false;
      submitBtn.textContent = "Mock: Nachricht senden";
    }
  });
}
