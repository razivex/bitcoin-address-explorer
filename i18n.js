const LANG_STORAGE_KEY = "bitcoin-explorer-language";
const DEFAULT_LANG = "en";

const translations = {
  en: {
    pageTitle: "Bitcoin Address Explorer",
    pageHeading: "Bitcoin Address Explorer",
    pageSub:
      "Real time check any bitcoin address or pubkey, including balance, transactions, and other important datas",
    addressLabel: "Bitcoin address or public key",
    addressPlaceholder: "e.g. bc1q..., 1A1zP1..., or public key hex",
    check: "Check",
    loading: "Loading...",
    qrShow: "Show address QR code",
    qrTitle: "QR code",
    qrCanvasLabel: "Address QR code",
    address: "Address:",
    publicKey: "Public Key:",
    addressType: "Address Type:",
    exposedPubKey: "Exposed PubKey:",
    transactions: "Transactions:",
    lastTxDate: "Last Transaction Date:",
    timeSinceLast: "Time Since Last Transaction:",
    footerCreatedBy: "Created by",
    blockHeight: "Height: {height}",
    bitcoinPrice: "Price: {value}",
    blocksToDifficulty: "Difficult Adjustment: {blocks}",
    blocksToHalving: "Halving: {blocks}",
    mayerMultiple: "Mayer Multiple: {value}",
    mvrvRatio: "MVRV Ratio: {value}",
    fearGreedIndex: "Fear & Greed: {value}",
    fearGreedExtremeFear: "Extreme Fear",
    fearGreedFear: "Fear",
    fearGreedNeutral: "Neutral",
    fearGreedGreed: "Greed",
    fearGreedExtremeGreed: "Extreme Greed",
    socialLinks: "Social links",
    language: "Language",
    muteSounds: "Mute sounds",
    unmuteSounds: "Unmute sounds",
    soundsOn: "Sounds on",
    soundsOff: "Sounds off",
    errorEmpty:
      "Please enter a Bitcoin address or public key.",
    errorInvalidPubkey:
      "Invalid public key. Paste a compressed (02/03...) or uncompressed (04...) key in hex.",
    errorFetch:
      "Could not fetch balance. Check the address or public key and try again.",
    errorQrLibrary:
      "QR code library failed to load. Refresh the page and try again.",
    errorQrGenerate: "Could not generate QR code. Please try again.",
    yes: "Yes",
    no: "No",
    unknown: "Unknown",
    na: "N/A",
    btcUnconfirmed: "{amount} BTC unconfirmed",
    zeroSeconds: "0 seconds",
    unitYear: "year",
    unitYears: "years",
    unitMonth: "month",
    unitMonths: "months",
    unitDay: "day",
    unitDays: "days",
    unitHour: "hour",
    unitHours: "hours",
    unitMinute: "minute",
    unitMinutes: "minutes",
    unitSecond: "second",
    unitSeconds: "seconds",
    am: "AM",
    pm: "PM",
  },
  "pt-BR": {
    pageTitle: "Explorador de Endereços Bitcoin",
    pageHeading: "Explorador de Endereços Bitcoin",
    pageSub:
      "Verificação em tempo real de qualquer endereço bitcoin ou chave pública, incluindo saldo, transações e outros dados importantes",
    addressLabel: "Endereço bitcoin ou chave pública",
    addressPlaceholder: "ex.: bc1q..., 1A1zP1..., ou chave pública em hex",
    check: "Verificar",
    loading: "Carregando...",
    qrShow: "Mostrar QR code do endereço",
    qrTitle: "Código QR",
    qrCanvasLabel: "QR code do endereço",
    address: "Endereço:",
    publicKey: "Chave Pública:",
    addressType: "Tipo de Endereço:",
    exposedPubKey: "Chave Pública Exposta:",
    transactions: "Transações:",
    lastTxDate: "Data da Última Transação:",
    timeSinceLast: "Tempo Desde a Última Transação:",
    footerCreatedBy: "Criado por",
    blockHeight: "Altura: {height}",
    bitcoinPrice: "Preço: {value}",
    blocksToDifficulty: "Ajuste de Dificuldade: {blocks}",
    blocksToHalving: "Halving: {blocks}",
    mayerMultiple: "Mayer Multiple: {value}",
    mvrvRatio: "MVRV Ratio: {value}",
    fearGreedIndex: "Fear & Greed: {value}",
    fearGreedExtremeFear: "Medo Extremo",
    fearGreedFear: "Medo",
    fearGreedNeutral: "Neutro",
    fearGreedGreed: "Ganância",
    fearGreedExtremeGreed: "Ganância Extrema",
    socialLinks: "Links sociais",
    language: "Idioma",
    muteSounds: "Silenciar sons",
    unmuteSounds: "Ativar sons",
    soundsOn: "Sons ligados",
    soundsOff: "Sons desligados",
    errorEmpty:
      "Por favor, insira um endereço bitcoin ou chave pública.",
    errorInvalidPubkey:
      "Chave pública inválida. Cole uma chave comprimida (02/03...) ou não comprimida (04...) em hexadecimal.",
    errorFetch:
      "Não foi possível buscar o saldo. Verifique o endereço ou a chave pública e tente novamente.",
    errorQrLibrary:
      "A biblioteca de QR code falhou ao carregar. Atualize a página e tente novamente.",
    errorQrGenerate: "Não foi possível gerar o código QR. Tente novamente.",
    yes: "Sim",
    no: "Não",
    unknown: "Desconhecido",
    na: "N/D",
    btcUnconfirmed: "{amount} BTC não confirmado",
    zeroSeconds: "0 segundos",
    unitYear: "ano",
    unitYears: "anos",
    unitMonth: "mês",
    unitMonths: "meses",
    unitDay: "dia",
    unitDays: "dias",
    unitHour: "hora",
    unitHours: "horas",
    unitMinute: "minuto",
    unitMinutes: "minutos",
    unitSecond: "segundo",
    unitSeconds: "segundos",
    am: "",
    pm: "",
  },
};

let currentLang = DEFAULT_LANG;
const languageChangeListeners = [];

function t(key, vars = {}) {
  const table = translations[currentLang] ?? translations[DEFAULT_LANG];
  let text = table[key] ?? translations[DEFAULT_LANG][key] ?? key;

  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, value);
  }

  return text;
}

function getLocale() {
  return currentLang === "pt-BR" ? "pt-BR" : "en-US";
}

function getCurrentLang() {
  return currentLang;
}

function getDisplayCurrency() {
  return currentLang === "pt-BR" ? "BRL" : "USD";
}

function loadLanguagePreference() {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY);
    if (stored && translations[stored]) {
      currentLang = stored;
    }
  } catch (err) {
    console.error(err);
  }
}

function saveLanguagePreference(lang) {
  try {
    localStorage.setItem(LANG_STORAGE_KEY, lang);
  } catch (err) {
    console.error(err);
  }
}

function applyStaticTranslations() {
  document.documentElement.lang = currentLang === "pt-BR" ? "pt-BR" : "en";
  document.title = t("pageTitle");

  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const attr = el.getAttribute("data-i18n-attr");

    if (attr) {
      el.setAttribute(attr, t(key));
      return;
    }

    el.textContent = t(key);
  });

  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    el.placeholder = t(el.getAttribute("data-i18n-placeholder"));
  });

  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    el.title = t(el.getAttribute("data-i18n-title"));
  });

  updateLangSelectUi();
}

function updateLangSelectUi() {
  const langToggleBtn = document.getElementById("langToggleBtn");
  if (!langToggleBtn) return;

  langToggleBtn.setAttribute("aria-label", t("language"));
  langToggleBtn.classList.remove("lang-select--en", "lang-select--pt-BR");
  langToggleBtn.classList.add(
    currentLang === "pt-BR" ? "lang-select--pt-BR" : "lang-select--en",
  );

  document.querySelectorAll(".lang-menu__option").forEach((option) => {
    const isSelected = option.dataset.lang === currentLang;
    option.classList.toggle("is-selected", isSelected);
    option.setAttribute("aria-selected", String(isSelected));
  });
}

function closeLangMenu() {
  const langMenu = document.getElementById("langMenu");
  const langToggleBtn = document.getElementById("langToggleBtn");
  if (!langMenu || !langToggleBtn) return;

  langMenu.hidden = true;
  langToggleBtn.setAttribute("aria-expanded", "false");
}

function toggleLangMenu() {
  const langMenu = document.getElementById("langMenu");
  const langToggleBtn = document.getElementById("langToggleBtn");
  if (!langMenu || !langToggleBtn) return;

  const willOpen = langMenu.hidden;
  langMenu.hidden = !willOpen;
  langToggleBtn.setAttribute("aria-expanded", String(willOpen));
}

function setLanguage(lang) {
  if (!translations[lang] || lang === currentLang) return;

  currentLang = lang;
  saveLanguagePreference(lang);
  applyStaticTranslations();

  if (typeof updateSoundToggleUi === "function") {
    updateSoundToggleUi();
  }

  languageChangeListeners.forEach((listener) => listener(lang));
}

function onLanguageChange(listener) {
  languageChangeListeners.push(listener);
}

function initLanguageSelector() {
  loadLanguagePreference();
  applyStaticTranslations();

  const langToggleBtn = document.getElementById("langToggleBtn");
  const langMenu = document.getElementById("langMenu");
  if (!langToggleBtn || !langMenu) return;

  langToggleBtn.addEventListener("click", (event) => {
    event.stopPropagation();
    toggleLangMenu();
  });

  langMenu.querySelectorAll(".lang-menu__option").forEach((option) => {
    option.addEventListener("click", () => {
      setLanguage(option.dataset.lang);
      closeLangMenu();
    });
  });

  document.addEventListener("click", (event) => {
    if (
      !langMenu.hidden &&
      !event.target.closest(".lang-picker")
    ) {
      closeLangMenu();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeLangMenu();
    }
  });
}

initLanguageSelector();