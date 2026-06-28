const API_BASE = "https://mempool.space/api";
const TRANSACTION_TIMES_URL = "https://mempool.space/api/v1/transaction-times";
const COINGECKO_BRL_PRICE_URL =
  "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=brl";
const COINGECKO_MAYER_CHART_URL =
  "https://api.coingecko.com/api/v3/coins/bitcoin/market_chart?vs_currency=usd&days=200&interval=daily";
const COINMETRICS_MVRV_URL =
  "https://community-api.coinmetrics.io/v4/timeseries/asset-metrics?assets=btc&metrics=CapMVRVCur&frequency=1d&page_size=1";
const BITCOIN_DATA_API = "https://bitcoin-data.com/api/v1";
const FEAR_GREED_API = "https://api.alternative.me/fng/?limit=1";
const MARKET_METRICS_REFRESH_MS = 60 * 60 * 1000;
const MARKET_METRICS_CACHE_KEY = "bitcoinExplorer.marketMetrics";
const MAYER_CHEAP_MAX = 1;
const MAYER_NEUTRAL_MAX = 2.4;
const MVRV_CHEAP_MAX = 1;
const MVRV_NEUTRAL_MAX = 3.7;
const FEAR_GREED_NEUTRAL_MIN = 45;
const FEAR_GREED_NEUTRAL_MAX = 55;
const FEAR_GREED_CHEAP_LABELS = new Set(["Extreme Fear", "Fear"]);
const FEAR_GREED_EXPENSIVE_LABELS = new Set(["Greed", "Extreme Greed"]);
const SATS_PER_BTC = 100_000_000;
const UPDATE_INTERVAL_MS = 10000;
const BALANCE_SUB_FADE_MS = 600;
const DIFFICULTY_ADJUSTMENT_INTERVAL = 2016;
const HALVING_INTERVAL = 210_000;
const BALANCE_BTC_MAX_FONT_PX = 32;
const BALANCE_BTC_MIN_FONT_PX = 11;
const addressInput = document.getElementById("address");
const lookupBtn = document.getElementById("lookupBtn");
const resultEl = document.getElementById("result");
const txResultEl = document.getElementById("txResult");
const txValueBtcEl = document.getElementById("txValueBtc");
const txStatusSubEl = document.getElementById("txStatusSub");
const txMetaIdEl = document.getElementById("txMetaId");
const txMetaDateEl = document.getElementById("txMetaDate");
const txMetaConfirmedAtEl = document.getElementById("txMetaConfirmedAt");
const txMetaTimeToConfirmationEl = document.getElementById("txMetaTimeToConfirmation");
const txMetaTimeSinceConfirmationEl = document.getElementById(
  "txMetaTimeSinceConfirmation",
);
const txMetaFeeEl = document.getElementById("txMetaFee");

const txEmbeddedDataEl = document.getElementById("txEmbeddedData");
const txMetaConfirmationsEl = document.getElementById("txMetaConfirmations");
const errorEl = document.getElementById("error");
const balanceBtcEl = document.getElementById("balanceBtc");
const balanceUnconfirmedEl = document.getElementById("balanceUnconfirmed");
const qrBtn = document.getElementById("qrBtn");
const qrOverlay = document.getElementById("qrOverlay");
const qrCanvas = document.getElementById("qrCanvas");
const cardEl = document.querySelector(".card");
const metaAddressLabelEl = document.getElementById("metaAddressLabel");
const metaAddressEl = document.getElementById("metaAddress");
const metaAddressTypeEl = document.getElementById("metaAddressType");
const metaExposedPubKeyEl = document.getElementById("metaExposedPubKey");
const metaTransactionsEl = document.getElementById("metaTransactions");
const metaLastTxDateEl = document.getElementById("metaLastTxDate");
const timeSinceLastEl = document.getElementById("timeSinceLast");
const blockHeightTooltipEl = document.getElementById("blockHeightTooltip");

let timeSinceLastInterval = null;
let txTimeSinceConfirmationInterval = null;
let txAutoRefreshInterval = null;
let balanceSubInterval = null;
let autoRefreshInterval = null;
let refreshInFlight = false;
let lookupGeneration = 0;
let txLookupGeneration = 0;
let currentLookupInput = null;
let currentTxLookup = null;
let lastAppliedTxData = null;
let lastTxTimestamp = null;
let cachedPrices = {};
let balanceSubState = {
  hasUnconfirmed: false,
  showingUsd: true,
  usdText: "",
  unconfirmedText: "",
  arrowUp: false,
  arrowDown: false,
};
let txWatchState = {
  initialized: false,
  chainTxCount: 0,
  mempoolTxCount: 0,
  lastConfirmedTxId: null,
};
let txConfirmationWatchState = {
  initialized: false,
  confirmed: false,
};
let lastAppliedData = null;
let cachedBlockHeight = null;
let cachedMiningStats = {
  hashrate: null,
  difficulty: null,
};
let blockHeightInterval = null;
let marketMetricsInterval = null;
let cachedMarketMetrics = {
  mayerMultiple: null,
  mvrv: null,
  fearGreed: null,
  fearGreedLabel: null,
};

function showError(message) {
  errorEl.textContent = message;
  errorEl.classList.add("show");
  resultEl.classList.remove("show");
  txResultEl.classList.remove("show");
}

function clearError() {
  errorEl.textContent = "";
  errorEl.classList.remove("show");
}

function stopTimeSinceTimer() {
  if (timeSinceLastInterval !== null) {
    clearInterval(timeSinceLastInterval);
    timeSinceLastInterval = null;
  }
}

function stopTxTimeSinceConfirmationTimer() {
  if (txTimeSinceConfirmationInterval !== null) {
    clearInterval(txTimeSinceConfirmationInterval);
    txTimeSinceConfirmationInterval = null;
  }
}

function stopTxAutoRefresh() {
  if (txAutoRefreshInterval !== null) {
    clearInterval(txAutoRefreshInterval);
    txAutoRefreshInterval = null;
  }
}

function stopBalanceSubCycle() {
  if (balanceSubInterval !== null) {
    clearInterval(balanceSubInterval);
    balanceSubInterval = null;
  }
}

function stopAutoRefresh() {
  if (autoRefreshInterval !== null) {
    clearInterval(autoRefreshInterval);
    autoRefreshInterval = null;
  }
}

function resetTxWatchState() {
  txWatchState = {
    initialized: false,
    chainTxCount: 0,
    mempoolTxCount: 0,
    lastConfirmedTxId: null,
  };
}

function resetTxConfirmationWatchState() {
  txConfirmationWatchState = {
    initialized: false,
    confirmed: false,
  };
}

function detectAndPlayTxConfirmationSound(data, { silent = false } = {}) {
  const confirmed = Boolean(data.confirmed);

  if (!silent || !txConfirmationWatchState.initialized) {
    txConfirmationWatchState = {
      initialized: true,
      confirmed,
    };
    return;
  }

  if (confirmed && !txConfirmationWatchState.confirmed) {
    playConfirmedSound();
  }

  txConfirmationWatchState = {
    initialized: true,
    confirmed,
  };
}

function detectAndPlayTxSounds(data, { silent = false } = {}) {
  const chainTxCount = data.txCount;
  const mempoolTxCount = data.mempoolTxCount;
  const lastConfirmedTxId = data.lastConfirmedTxId;

  if (!silent || !txWatchState.initialized) {
    txWatchState = {
      initialized: true,
      chainTxCount,
      mempoolTxCount,
      lastConfirmedTxId,
    };
    return;
  }

  const newConfirmed =
    chainTxCount > txWatchState.chainTxCount ||
    (lastConfirmedTxId &&
      lastConfirmedTxId !== txWatchState.lastConfirmedTxId);
  const newUnconfirmed = mempoolTxCount > txWatchState.mempoolTxCount;

  if (newConfirmed) {
    playConfirmedSound();
  } else if (newUnconfirmed) {
    playBellSound();
    if (!isMempoolSocketConnected()) {
      const newAddressTxCount = mempoolTxCount - txWatchState.mempoolTxCount;
      spawnAddressBlocks(newAddressTxCount);
    }
  }

  txWatchState = {
    initialized: true,
    chainTxCount,
    mempoolTxCount,
    lastConfirmedTxId,
  };
}

function formatFiat(value) {
  return value.toLocaleString(getLocale(), {
    style: "currency",
    currency: getDisplayCurrency(),
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function buildFiatText(confirmedBtc) {
  const price = getFiatPrice();
  const currency = getDisplayCurrency();
  return `≈ ${formatFiat(confirmedBtc * price)} ${currency}`;
}

function getUnconfirmedArrowState(mempoolStats) {
  const funded = Number(mempoolStats?.funded_txo_sum) || 0;
  const spent = Number(mempoolStats?.spent_txo_sum) || 0;

  return {
    up: funded > 0,
    down: spent > 0,
  };
}

function hasUnconfirmedActivity(unconfirmedSats, mempoolStats) {
  if (unconfirmedSats !== 0) return true;

  const funded = Number(mempoolStats?.funded_txo_sum) || 0;
  const spent = Number(mempoolStats?.spent_txo_sum) || 0;
  return funded > 0 || spent > 0;
}

function formatUnconfirmedText(unconfirmedSats, unconfirmedBtc) {
  const absAmount = formatBtc(Math.abs(unconfirmedBtc));
  const signedAmount = unconfirmedSats < 0 ? `-${absAmount}` : absAmount;
  return t("btcUnconfirmed", { amount: signedAmount });
}

function renderBalanceSubLine(text, { showArrows = false } = {}) {
  balanceUnconfirmedEl.replaceChildren();

  if (
    showArrows &&
    (balanceSubState.arrowUp || balanceSubState.arrowDown)
  ) {
    const arrows = document.createElement("span");
    arrows.className = "balance-unconfirmed__arrows";
    arrows.setAttribute("aria-hidden", "true");

    if (balanceSubState.arrowUp) {
      const upArrow = document.createElement("span");
      upArrow.className = "balance-arrow balance-arrow--up";
      upArrow.textContent = "▲";
      arrows.appendChild(upArrow);
    }

    if (balanceSubState.arrowDown) {
      const downArrow = document.createElement("span");
      downArrow.className = "balance-arrow balance-arrow--down";
      downArrow.textContent = "▼";
      arrows.appendChild(downArrow);
    }

    balanceUnconfirmedEl.appendChild(arrows);
  }

  const textSpan = document.createElement("span");
  textSpan.className = "balance-unconfirmed__text";
  textSpan.textContent = text;
  balanceUnconfirmedEl.appendChild(textSpan);
}

function setBalanceSubText(text, animate = true, { showArrows = false } = {}) {
  if (!animate) {
    renderBalanceSubLine(text, { showArrows });
    balanceUnconfirmedEl.classList.remove("is-fading");
    return;
  }

  balanceUnconfirmedEl.classList.add("is-fading");

  setTimeout(() => {
    renderBalanceSubLine(text, { showArrows });
    balanceUnconfirmedEl.classList.remove("is-fading");
  }, BALANCE_SUB_FADE_MS);
}

function startBalanceSubCycle(usdText, unconfirmedText) {
  stopBalanceSubCycle();

  balanceSubState = {
    hasUnconfirmed: true,
    showingUsd: true,
    usdText,
    unconfirmedText,
    arrowUp: balanceSubState.arrowUp,
    arrowDown: balanceSubState.arrowDown,
  };

  renderBalanceSubLine(usdText);
  balanceUnconfirmedEl.classList.remove("is-fading");

  balanceSubInterval = setInterval(() => {
    balanceSubState.showingUsd = !balanceSubState.showingUsd;
    const showingUnconfirmed = !balanceSubState.showingUsd;
    setBalanceSubText(
      showingUnconfirmed
        ? balanceSubState.unconfirmedText
        : balanceSubState.usdText,
      true,
      { showArrows: showingUnconfirmed },
    );
  }, UPDATE_INTERVAL_MS);
}

function setupBalanceSub(
  confirmedBtc,
  unconfirmedSats,
  unconfirmedBtc,
  fiatPrice,
  mempoolStats,
) {
  stopBalanceSubCycle();

  const fiatText = buildFiatText(confirmedBtc);
  balanceSubState.usdText = fiatText;

  if (hasUnconfirmedActivity(unconfirmedSats, mempoolStats)) {
    const unconfirmedText = formatUnconfirmedText(
      unconfirmedSats,
      unconfirmedBtc,
    );
    startBalanceSubCycle(fiatText, unconfirmedText);
    return;
  }

  balanceSubState = {
    hasUnconfirmed: false,
    showingUsd: true,
    usdText: fiatText,
    unconfirmedText: "",
    arrowUp: false,
    arrowDown: false,
  };
  renderBalanceSubLine(fiatText);
  balanceUnconfirmedEl.classList.remove("is-fading");
}

function updateBalanceSubSilently(
  confirmedBtc,
  unconfirmedSats,
  unconfirmedBtc,
  fiatPrice,
  mempoolStats,
) {
  const fiatText = buildFiatText(confirmedBtc);
  const hasUnconfirmed = hasUnconfirmedActivity(unconfirmedSats, mempoolStats);
  const unconfirmedText = hasUnconfirmed
    ? formatUnconfirmedText(unconfirmedSats, unconfirmedBtc)
    : "";

  if (hasUnconfirmed !== balanceSubState.hasUnconfirmed) {
    setupBalanceSub(
      confirmedBtc,
      unconfirmedSats,
      unconfirmedBtc,
      fiatPrice,
      mempoolStats,
    );
    return;
  }

  balanceSubState.usdText = fiatText;
  balanceSubState.unconfirmedText = unconfirmedText;

  if (!hasUnconfirmed) {
    renderBalanceSubLine(fiatText);
    return;
  }

  const showingUnconfirmed = !balanceSubState.showingUsd;
  const visibleText = showingUnconfirmed
    ? balanceSubState.unconfirmedText
    : balanceSubState.usdText;
  setBalanceSubText(visibleText, false, { showArrows: showingUnconfirmed });
}

function getQrSize() {
  const styles = getComputedStyle(cardEl);
  const horizontalPadding =
    parseFloat(styles.paddingLeft) + parseFloat(styles.paddingRight);
  const modalPadding = 40;
  const cardContentWidth = cardEl.clientWidth - horizontalPadding - modalPadding;

  return Math.floor(Math.min(cardContentWidth, window.innerWidth - 96));
}

function hideQrPanel() {
  qrOverlay.hidden = true;
}

async function showQrCode() {
  if (!currentLookupInput || !qrOverlay.hidden) return;

  if (typeof QRCode === "undefined") {
    showError(t("errorQrLibrary"));
    return;
  }

  try {
    const qrSize = getQrSize();
    await QRCode.toCanvas(qrCanvas, currentLookupInput, {
      width: qrSize,
      margin: 2,
      color: {
        dark: "#000000",
        light: "#ffffff",
      },
    });
    qrOverlay.hidden = false;
  } catch (err) {
    console.error(err);
    showError(t("errorQrGenerate"));
  }
}

function satsToBtc(sats) {
  return sats / SATS_PER_BTC;
}

function formatBtc(btc) {
  return btc.toLocaleString(getLocale(), {
    minimumFractionDigits: 8,
    maximumFractionDigits: 8,
  });
}

function calcBalance(stats) {
  if (!stats) return 0;

  const funded = Number(stats.funded_txo_sum) || 0;
  const spent = Number(stats.spent_txo_sum) || 0;
  return funded - spent;
}

function isValidAddressData(addressData) {
  return Boolean(
    addressData?.chain_stats &&
      Number.isFinite(Number(addressData.chain_stats.funded_txo_sum)) &&
      Number.isFinite(Number(addressData.chain_stats.spent_txo_sum)),
  );
}

function parseFiatPrice(prices, currency = getDisplayCurrency()) {
  if (!prices || typeof prices !== "object") return 0;

  const raw = prices[currency] ?? prices[currency.toLowerCase()];
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : 0;
}

function getFiatPrice() {
  return parseFiatPrice(cachedPrices);
}

async function fetchBrlPrice() {
  try {
    const data = await fetchJson(COINGECKO_BRL_PRICE_URL);
    const brl = Number(data?.bitcoin?.brl);
    if (Number.isFinite(brl) && brl > 0) {
      cachedPrices.BRL = brl;
      return brl;
    }
  } catch (err) {
    console.error(err);
  }

  return 0;
}

async function ensureBrlPriceCached() {
  if (parseFiatPrice(cachedPrices, "BRL") > 0) {
    return cachedPrices.BRL;
  }

  return fetchBrlPrice();
}

async function fetchFiatPrice() {
  try {
    const prices = await fetchJson(`${API_BASE}/v1/prices`);
    cachedPrices = { ...cachedPrices, ...prices };
  } catch (err) {
    console.error(err);
  }

  if (getDisplayCurrency() === "BRL") {
    await ensureBrlPriceCached();
  }

  return getFiatPrice();
}

function hasSpentOutputs(stats) {
  if (!stats) return false;

  const spentCount = Number(stats.spent_txo_count) || 0;
  const spentSum = Number(stats.spent_txo_sum) || 0;
  return spentCount > 0 || spentSum > 0;
}

function isPublicKeyExposed(lookupMode, addressData) {
  if (lookupMode === "pubkey") {
    return true;
  }

  return (
    hasSpentOutputs(addressData.chain_stats) ||
    hasSpentOutputs(addressData.mempool_stats)
  );
}

function formatExposedPubKey(exposed) {
  return exposed ? t("yes") : t("no");
}

function getAddressType(address, { isPublicKey = false } = {}) {
  const normalized = address.trim();
  if (!normalized) return t("unknown");

  if (isPublicKey || isHexPublicKey(normalized)) {
    return "P2PK";
  }

  const lower = normalized.toLowerCase();
  if (lower.startsWith("bc1p")) return "P2TR";
  if (lower.startsWith("bc1q")) {
    if (normalized.length === 42) return "P2WPKH";
    if (normalized.length === 62) return "P2WSH";
    return "Bech32";
  }
  if (normalized.startsWith("1")) return "P2PKH";
  if (normalized.startsWith("3")) return "P2SH";
  return t("unknown");
}

function pad2(value) {
  return String(Math.max(0, value)).padStart(2, "0");
}

function formatDateTime(date) {
  const day = pad2(date.getDate());
  const month = pad2(date.getMonth() + 1);
  const year = date.getFullYear();
  const minutes = pad2(date.getMinutes());
  const seconds = pad2(date.getSeconds());

  if (getCurrentLang() === "pt-BR") {
    return `${day}/${month}/${year} ${pad2(date.getHours())}:${minutes}:${seconds}`;
  }

  let hours = date.getHours();
  const ampm = hours >= 12 ? t("pm") : t("am");
  hours = hours % 12 || 12;

  return `${day}/${month}/${year} ${pad2(hours)}:${minutes}:${seconds} ${ampm}`;
}

function getTimeSinceParts(fromDate, toDate = new Date()) {
  let years = toDate.getFullYear() - fromDate.getFullYear();
  let months = toDate.getMonth() - fromDate.getMonth();
  let days = toDate.getDate() - fromDate.getDate();
  let hours = toDate.getHours() - fromDate.getHours();
  let minutes = toDate.getMinutes() - fromDate.getMinutes();
  let seconds = toDate.getSeconds() - fromDate.getSeconds();

  if (seconds < 0) {
    seconds += 60;
    minutes -= 1;
  }
  if (minutes < 0) {
    minutes += 60;
    hours -= 1;
  }
  if (hours < 0) {
    hours += 24;
    days -= 1;
  }
  if (days < 0) {
    const previousMonth = new Date(toDate.getFullYear(), toDate.getMonth(), 0);
    days += previousMonth.getDate();
    months -= 1;
  }
  if (months < 0) {
    months += 12;
    years -= 1;
  }

  return { years, months, days, hours, minutes, seconds };
}

function formatTimeSince(parts) {
  const units = [
    ["unitYear", "unitYears", parts.years],
    ["unitMonth", "unitMonths", parts.months],
    ["unitDay", "unitDays", parts.days],
    ["unitHour", "unitHours", parts.hours],
    ["unitMinute", "unitMinutes", parts.minutes],
    ["unitSecond", "unitSeconds", parts.seconds],
  ];

  const tierStart = units.findIndex(([, , value]) => value > 0);
  if (tierStart === -1) return t("zeroSeconds");

  const formatUnit = ([singular, plural, value]) =>
    `${value} ${value === 1 ? t(singular) : t(plural)}`;

  if (tierStart >= units.length - 1) {
    return formatUnit(units[tierStart]);
  }

  return units
    .slice(tierStart, tierStart + 2)
    .map(formatUnit)
    .join(" ");
}

function startTimeSinceTimer(fromDate) {
  stopTimeSinceTimer();

  if (!fromDate) return;

  const tick = () => {
    timeSinceLastEl.textContent = formatTimeSince(getTimeSinceParts(fromDate));
  };

  tick();
  timeSinceLastInterval = setInterval(tick, 1000);
}

function getTxTimestamp(tx) {
  const blockTime = tx?.status?.block_time;
  if (!blockTime) return null;
  return new Date(blockTime * 1000);
}

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`API error (${response.status})`);
  }
  return response.json();
}

async function loadAddressData(address) {
  let lookupTarget;
  try {
    lookupTarget = await resolveLookupTarget(address);
  } catch (err) {
    if (isHexPublicKey(address)) {
      throw new Error("Invalid public key hex");
    }
    throw err;
  }

  const encodedQueryKey = encodeURIComponent(lookupTarget.queryKey);
  const isPublicKeyLookup = lookupTarget.mode === "pubkey";
  const apiBasePath = isPublicKeyLookup ? "scripthash" : "address";

  const rawData = await fetchJson(
    `${API_BASE}/${apiBasePath}/${encodedQueryKey}`,
  );

  const addressData = isPublicKeyLookup
    ? {
        ...rawData,
        address: lookupTarget.displayValue,
        is_pubkey: true,
      }
    : rawData;

  if (!isValidAddressData(addressData)) {
    throw new Error("Invalid address response");
  }

  const txCount = addressData.chain_stats.tx_count ?? 0;
  const mempoolTxCount = addressData.mempool_stats?.tx_count ?? 0;

  const [chainTxs, fiatPrice] = await Promise.all([
    fetchJson(`${API_BASE}/${apiBasePath}/${encodedQueryKey}/txs/chain`).catch(
      () => [],
    ),
    fetchFiatPrice(),
  ]);

  const confirmedSats = calcBalance(addressData.chain_stats);
  const unconfirmedSats = calcBalance(addressData.mempool_stats);
  const confirmedBtc = satsToBtc(confirmedSats);
  const unconfirmedBtc = satsToBtc(unconfirmedSats);
  const lastConfirmedTx = Array.isArray(chainTxs) ? chainTxs[0] : null;

  let lastTxDate = t("na");
  let lastTxDateObj = null;

  if (lastConfirmedTx) {
    lastTxDateObj = getTxTimestamp(lastConfirmedTx);
    if (lastTxDateObj) {
      lastTxDate = formatDateTime(lastTxDateObj);
    }
  }

  const watchTarget = {
    mode: lookupTarget.mode,
    displayValue: lookupTarget.displayValue,
    queryKey: lookupTarget.queryKey,
    scriptPubKey:
      lookupTarget.mode === "pubkey"
        ? buildP2pkScriptPubKey(lookupTarget.displayValue)
        : null,
  };

  return {
    addressData,
    lookupMode: lookupTarget.mode,
    watchTarget,
    confirmedBtc,
    unconfirmedSats,
    unconfirmedBtc,
    fiatPrice,
    addressType: getAddressType(addressData.address, {
      isPublicKey: isPublicKeyLookup,
    }),
    exposedPubKey: isPublicKeyExposed(lookupTarget.mode, addressData),
    txCount,
    mempoolTxCount,
    lastConfirmedTxId: lastConfirmedTx?.txid ?? null,
    lastTxDate,
    lastTxDateObj,
  };
}

function applyAddressData(data, { silent = false } = {}) {
  balanceBtcEl.textContent = `${formatBtc(data.confirmedBtc)} BTC`;
  scheduleBalanceBtcFit();

  const arrows = getUnconfirmedArrowState(data.addressData.mempool_stats);
  balanceSubState.arrowUp = arrows.up;
  balanceSubState.arrowDown = arrows.down;

  if (silent) {
    updateBalanceSubSilently(
      data.confirmedBtc,
      data.unconfirmedSats,
      data.unconfirmedBtc,
      data.fiatPrice,
      data.addressData.mempool_stats,
    );
  } else {
    setupBalanceSub(
      data.confirmedBtc,
      data.unconfirmedSats,
      data.unconfirmedBtc,
      data.fiatPrice,
      data.addressData.mempool_stats,
    );
  }

  metaAddressLabelEl.textContent =
    data.lookupMode === "pubkey" ? t("publicKey") : t("address");
  setMetaAddressDisplay(data.addressData.address);
  metaAddressTypeEl.textContent = getAddressType(data.addressData.address, {
    isPublicKey: data.lookupMode === "pubkey",
  });
  metaExposedPubKeyEl.textContent = formatExposedPubKey(data.exposedPubKey);
  metaTransactionsEl.textContent = data.txCount;
  metaLastTxDateEl.textContent = data.lastTxDateObj
    ? formatDateTime(data.lastTxDateObj)
    : t("na");

  const nextLastTimestamp = data.lastTxDateObj?.getTime() ?? null;
  if (data.lastTxDateObj) {
    if (nextLastTimestamp !== lastTxTimestamp) {
      lastTxTimestamp = nextLastTimestamp;
      startTimeSinceTimer(data.lastTxDateObj);
    }
  } else {
    lastTxTimestamp = null;
    stopTimeSinceTimer();
    timeSinceLastEl.textContent = t("na");
  }

  detectAndPlayTxSounds(data, { silent });

  lastAppliedData = data;
  currentLookupInput = data.addressData.address;
  resultEl.classList.add("show");
}

async function refreshAddressSilently() {
  if (!currentLookupInput || refreshInFlight) return;

  const targetInput = currentLookupInput;
  const generation = lookupGeneration;
  refreshInFlight = true;

  try {
    const data = await loadAddressData(targetInput);
    if (
      generation !== lookupGeneration ||
      targetInput !== currentLookupInput ||
      data.addressData.address !== targetInput
    ) {
      return;
    }

    applyAddressData(data, { silent: true });
  } catch (err) {
    console.error(err);
  } finally {
    refreshInFlight = false;
  }
}

function startAutoRefresh() {
  stopAutoRefresh();
  autoRefreshInterval = setInterval(refreshAddressSilently, UPDATE_INTERVAL_MS);
}

function calcTxOutputValue(tx) {
  if (!tx?.vout) return 0;

  return tx.vout.reduce(
    (sum, vout) => sum + (Number(vout.value) || 0),
    0,
  );
}

function getTxVsize(tx) {
  const vsize = Number(tx?.vsize);
  if (Number.isFinite(vsize) && vsize > 0) return vsize;

  const weight = Number(tx?.weight);
  if (Number.isFinite(weight) && weight > 0) return Math.ceil(weight / 4);

  const size = Number(tx?.size);
  if (Number.isFinite(size) && size > 0) return size;

  return null;
}

function getTxConfirmationCount(blockHeight) {
  const height = Number(blockHeight);
  const tip = Number(cachedBlockHeight);
  if (!Number.isFinite(height) || !Number.isFinite(tip)) return null;
  return Math.max(0, tip - height + 1);
}

function formatTxConfirmations(confirmed, blockHeight) {
  if (!confirmed) return "0";
  const count = getTxConfirmationCount(blockHeight);
  if (count === null) return t("na");
  return count.toLocaleString(getLocale());
}

function updateTxConfirmationsDisplay(data = lastAppliedTxData) {
  if (!data || !txMetaConfirmationsEl) return;
  txMetaConfirmationsEl.textContent = formatTxConfirmations(
    data.confirmed,
    data.blockHeight,
  );
}

function formatTxFeeLine(feeSats, vsize) {
  const fee = Number(feeSats);
  const vbytes = Number(vsize);
  if (!Number.isFinite(fee) || !Number.isFinite(vbytes) || vbytes <= 0) {
    return t("na");
  }

  const rate = fee / vbytes;
  return t("txFeeLine", {
    rate: rate.toLocaleString(getLocale(), {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }),
    vsize: vbytes.toLocaleString(getLocale()),
    fee: fee.toLocaleString(getLocale()),
  });
}

async function fetchTxFirstSeenFromBlockSummary(txid, blockHash) {
  if (!blockHash) return null;

  try {
    const summary = await fetchJson(
      `${API_BASE}/v1/block/${encodeURIComponent(blockHash)}/tx/${encodeURIComponent(txid)}/summary`,
    );
    const timestamp = Number(summary?.time);
    return Number.isFinite(timestamp) && timestamp > 0 ? timestamp : null;
  } catch (err) {
    console.error(err);
    return null;
  }
}

async function fetchTxFirstSeen(txid, tx = null) {
  try {
    const times = await fetchJson(
      `${TRANSACTION_TIMES_URL}?txId[]=${encodeURIComponent(txid)}`,
    );
    if (Array.isArray(times)) {
      const timestamp = Number(times[0]);
      if (Number.isFinite(timestamp) && timestamp > 0) {
        return timestamp;
      }
    }
  } catch (err) {
    console.error(err);
  }

  if (tx?.status?.confirmed) {
    return fetchTxFirstSeenFromBlockSummary(txid, tx.status.block_hash);
  }

  return null;
}

async function loadTransactionData(txid) {
  const tx = await fetchJson(`${API_BASE}/tx/${encodeURIComponent(txid)}`);
  const confirmed = Boolean(tx?.status?.confirmed);
  const firstSeenTs = await fetchTxFirstSeen(txid, tx);

  const outputSats = calcTxOutputValue(tx);
  const embeddedData = detectEmbeddedData(tx);
  const feeSats = Number(tx?.fee);
  const vsize = getTxVsize(tx);

  return {
    tx,
    txid,
    confirmed,
    outputBtc: satsToBtc(outputSats),
    hasEmbeddedData: embeddedData.length > 0,
    feeSats: Number.isFinite(feeSats) ? feeSats : null,
    vsize,
    blockTime: confirmed ? Number(tx.status.block_time) : null,
    firstSeenTs,
    firstSeenDate: firstSeenTs ? new Date(firstSeenTs * 1000) : null,
    confirmedDate:
      confirmed && tx.status.block_time
        ? new Date(tx.status.block_time * 1000)
        : null,
    blockHeight:
      confirmed && Number.isFinite(Number(tx.status.block_height))
        ? Number(tx.status.block_height)
        : null,
  };
}

function setTxIdDisplay(fullTxid) {
  txMetaIdEl.dataset.fullAddress = fullTxid;
  txMetaIdEl.title = fullTxid;
  txMetaIdEl.textContent = fullTxid;

  requestAnimationFrame(() => {
    const fullValue = txMetaIdEl.dataset.fullAddress;
    if (!fullValue || !txResultEl.classList.contains("show")) return;

    txMetaIdEl.textContent = fullValue;
    if (txMetaIdEl.clientWidth === 0) return;

    if (txMetaIdEl.scrollWidth <= txMetaIdEl.clientWidth) return;

    for (let len = fullValue.length - 1; len >= 16; len -= 1) {
      txMetaIdEl.textContent = truncateMiddle(fullValue, len);
      if (txMetaIdEl.scrollWidth <= txMetaIdEl.clientWidth) return;
    }

    txMetaIdEl.textContent = truncateMiddle(fullValue, 16);
  });
}

function formatTimeFromFirstSeenToConfirmed(firstSeenDate, confirmedDate) {
  if (!firstSeenDate || !confirmedDate) return t("na");
  return formatTimeSince(getTimeSinceParts(firstSeenDate, confirmedDate));
}

function startTxTimeSinceConfirmationTimer(fromDate) {
  stopTxTimeSinceConfirmationTimer();
  if (!fromDate) {
    txMetaTimeSinceConfirmationEl.textContent = t("na");
    return;
  }

  const tick = () => {
    txMetaTimeSinceConfirmationEl.textContent = formatTimeSince(
      getTimeSinceParts(fromDate),
    );
  };

  tick();
  txTimeSinceConfirmationInterval = setInterval(tick, 1000);
}

function fitTxValueBtcToWidth() {
  if (!txValueBtcEl || !txResultEl.classList.contains("show")) return;

  txValueBtcEl.style.fontSize = `${BALANCE_BTC_MAX_FONT_PX}px`;

  if (txValueBtcEl.clientWidth === 0) return;

  let fontSize = BALANCE_BTC_MAX_FONT_PX;
  while (
    fontSize > BALANCE_BTC_MIN_FONT_PX &&
    txValueBtcEl.scrollWidth > txValueBtcEl.clientWidth
  ) {
    fontSize -= 1;
    txValueBtcEl.style.fontSize = `${fontSize}px`;
  }
}

function scheduleTxValueBtcFit() {
  requestAnimationFrame(() => {
    fitTxValueBtcToWidth();
  });
}

function applyTransactionData(data, { silent = false } = {}) {
  txValueBtcEl.textContent = `${formatBtc(data.outputBtc)} BTC`;
  scheduleTxValueBtcFit();

  txStatusSubEl.textContent = data.confirmed
    ? t("txConfirmed")
    : t("txUnconfirmed");
  txStatusSubEl.className = data.confirmed
    ? "balance-unconfirmed"
    : "balance-unconfirmed tx-status-sub--unconfirmed";

  setTxIdDisplay(data.txid);

  txMetaDateEl.textContent = data.firstSeenDate
    ? formatDateTime(data.firstSeenDate)
    : t("na");
  txMetaConfirmedAtEl.textContent =
    data.confirmed && data.confirmedDate
      ? formatDateTime(data.confirmedDate)
      : t("na");
  txMetaTimeToConfirmationEl.textContent = data.confirmed
    ? formatTimeFromFirstSeenToConfirmed(
        data.firstSeenDate,
        data.confirmedDate,
      )
    : t("na");

  if (data.confirmed && data.confirmedDate) {
    startTxTimeSinceConfirmationTimer(data.confirmedDate);
  } else {
    stopTxTimeSinceConfirmationTimer();
    txMetaTimeSinceConfirmationEl.textContent = t("na");
  }

  txMetaFeeEl.textContent = formatTxFeeLine(data.feeSats, data.vsize);
  txEmbeddedDataEl.textContent = data.hasEmbeddedData ? t("yes") : t("no");
  updateTxConfirmationsDisplay(data);

  detectAndPlayTxConfirmationSound(data, { silent });

  lastAppliedTxData = data;
  currentTxLookup = data.txid;
  resultEl.classList.remove("show");
  txResultEl.classList.add("show");
}

async function refreshTransactionSilently() {
  if (!currentTxLookup || refreshInFlight) return;

  const targetTxid = currentTxLookup;
  const generation = txLookupGeneration;
  refreshInFlight = true;

  try {
    const data = await loadTransactionData(targetTxid);
    if (generation !== txLookupGeneration || targetTxid !== currentTxLookup) {
      return;
    }

    applyTransactionData(data, { silent: true });
  } catch (err) {
    console.error(err);
  } finally {
    refreshInFlight = false;
  }
}

function startTxAutoRefresh() {
  stopTxAutoRefresh();
  txAutoRefreshInterval = setInterval(
    refreshTransactionSilently,
    UPDATE_INTERVAL_MS,
  );
}

function resetTransactionLookupState() {
  stopTxTimeSinceConfirmationTimer();
  stopTxAutoRefresh();
  resetTxConfirmationWatchState();
  currentTxLookup = null;
  lastAppliedTxData = null;
}

async function lookupTransaction() {
  const generation = ++txLookupGeneration;
  ++lookupGeneration;

  clearError();
  resetTransactionLookupState();
  stopTimeSinceTimer();
  stopBalanceSubCycle();
  stopAutoRefresh();
  hideQrPanel();
  currentLookupInput = null;
  lastTxTimestamp = null;
  lastAppliedData = null;
  clearWatchedLookup();
  resetTxWatchState();

  const txid = addressInput.value.trim().toLowerCase();

  lookupBtn.disabled = true;
  lookupBtn.textContent = t("loading");

  try {
    const data = await loadTransactionData(txid);
    if (generation !== txLookupGeneration) return;

    applyTransactionData(data, { silent: false });
    startTxAutoRefresh();
  } catch (err) {
    if (generation === txLookupGeneration) {
      showError(t("errorTxFetch"));
    }
    console.error(err);
  } finally {
    if (generation === txLookupGeneration) {
      lookupBtn.disabled = false;
      lookupBtn.textContent = t("check");
    }
  }
}

function performLookup() {
  const input = addressInput.value.trim();
  if (!input) {
    showError(t("errorEmpty"));
    return;
  }

  if (isValidTxid(input)) {
    lookupTransaction();
    return;
  }

  lookupAddress();
}

async function lookupAddress() {
  const generation = ++lookupGeneration;
  ++txLookupGeneration;

  clearError();
  stopTimeSinceTimer();
  stopBalanceSubCycle();
  stopAutoRefresh();
  resetTransactionLookupState();
  hideQrPanel();
  currentLookupInput = null;
  lastTxTimestamp = null;
  lastAppliedData = null;
  clearWatchedLookup();
  resetTxWatchState();

  const address = addressInput.value.trim();

  lookupBtn.disabled = true;
  lookupBtn.textContent = t("loading");

  try {
    const data = await loadAddressData(address);
    if (generation !== lookupGeneration) return;

    applyAddressData(data, { silent: false });
    txResultEl.classList.remove("show");
    setWatchedLookup(data.watchTarget);
    startAutoRefresh();
  } catch (err) {
    if (generation === lookupGeneration) {
      const message =
        err?.message === "Invalid public key hex"
          ? t("errorInvalidPubkey")
          : t("errorFetch");
      showError(message);
    }
    console.error(err);
  } finally {
    if (generation === lookupGeneration) {
      lookupBtn.disabled = false;
      lookupBtn.textContent = t("check");
    }
  }
}

function fitBalanceBtcToWidth() {
  if (!balanceBtcEl || !resultEl.classList.contains("show")) return;

  balanceBtcEl.style.fontSize = `${BALANCE_BTC_MAX_FONT_PX}px`;

  if (balanceBtcEl.clientWidth === 0) return;

  let fontSize = BALANCE_BTC_MAX_FONT_PX;
  while (
    fontSize > BALANCE_BTC_MIN_FONT_PX &&
    balanceBtcEl.scrollWidth > balanceBtcEl.clientWidth
  ) {
    fontSize -= 1;
    balanceBtcEl.style.fontSize = `${fontSize}px`;
  }
}

function scheduleBalanceBtcFit() {
  requestAnimationFrame(() => {
    fitBalanceBtcToWidth();
  });
}

function truncateMiddle(text, visibleChars) {
  if (text.length <= visibleChars) return text;

  const ellipsis = "...";
  const keep = visibleChars - ellipsis.length;
  const start = Math.ceil(keep / 2);
  const end = Math.floor(keep / 2);
  return `${text.slice(0, start)}${ellipsis}${text.slice(-end)}`;
}

function fitMetaAddressToWidth() {
  const fullAddress = metaAddressEl.dataset.fullAddress;
  if (!fullAddress || !resultEl.classList.contains("show")) return;

  metaAddressEl.textContent = fullAddress;

  if (metaAddressEl.clientWidth === 0) return;

  if (metaAddressEl.scrollWidth <= metaAddressEl.clientWidth) {
    return;
  }

  for (let len = fullAddress.length - 1; len >= 12; len -= 1) {
    metaAddressEl.textContent = truncateMiddle(fullAddress, len);
    if (metaAddressEl.scrollWidth <= metaAddressEl.clientWidth) {
      return;
    }
  }

  metaAddressEl.textContent = truncateMiddle(fullAddress, 12);
}

function setMetaAddressDisplay(fullAddress) {
  metaAddressEl.dataset.fullAddress = fullAddress;
  metaAddressEl.title = fullAddress;
  metaAddressEl.textContent = fullAddress;

  requestAnimationFrame(() => {
    fitMetaAddressToWidth();
  });
}

function formatBlockHeight(height) {
  const value = Number(height);
  if (!Number.isFinite(value)) return height;
  return value.toLocaleString(getLocale());
}

function blocksUntilDifficultyAdjustment(blockHeight) {
  const remainder = blockHeight % DIFFICULTY_ADJUSTMENT_INTERVAL;
  return remainder === 0
    ? DIFFICULTY_ADJUSTMENT_INTERVAL
    : DIFFICULTY_ADJUSTMENT_INTERVAL - remainder;
}

function blocksUntilHalving(blockHeight) {
  const nextHalving =
    (Math.floor(blockHeight / HALVING_INTERVAL) + 1) * HALVING_INTERVAL;
  return nextHalving - blockHeight;
}

function totalBtcSupplyFromHeight(blockHeight) {
  const height = Number(blockHeight);
  if (!Number.isFinite(height) || height < 0) return null;

  let remainingBlocks = height + 1;
  let era = 0;
  let supplyBtc = 0;

  while (remainingBlocks > 0) {
    const blockSubsidyBtc = 50 / 2 ** era;
    const blocksInEra = Math.min(remainingBlocks, HALVING_INTERVAL);
    supplyBtc += blocksInEra * blockSubsidyBtc;
    remainingBlocks -= blocksInEra;
    era += 1;
  }

  return supplyBtc;
}

function formatTotalBtcSupply(blockHeight) {
  const supplyBtc = totalBtcSupplyFromHeight(blockHeight);
  if (supplyBtc === null) return t("na");
  return Math.floor(supplyBtc).toLocaleString(getLocale(), {
    maximumFractionDigits: 0,
  });
}

const AMOUNT_SHORTENER_UNITS = [
  { value: 1, symbol: "" },
  { value: 1e3, symbol: "k" },
  { value: 1e6, symbol: "M" },
  { value: 1e9, symbol: "G" },
  { value: 1e12, symbol: "T" },
  { value: 1e15, symbol: "P" },
  { value: 1e18, symbol: "E" },
  { value: 1e21, symbol: "Z" },
  { value: 1e24, symbol: "Y" },
];

function amountShortener(num, digits = 1, unit, sigfigs = false) {
  const value = Number(num);
  if (!Number.isFinite(value) || value <= 0) return t("na");

  if (value < 1000) {
    const formattedNum = sigfigs
      ? Number(value.toPrecision(digits)).toString()
      : Number(value.toFixed(digits)).toString();

    return unit !== undefined ? `${formattedNum} ${unit}` : formattedNum;
  }

  const item = [...AMOUNT_SHORTENER_UNITS]
    .reverse()
    .find((entry) => value >= entry.value);

  if (!item) return "0";

  const scaledNum = value / item.value;
  const formattedNum = sigfigs
    ? Number(scaledNum.toPrecision(digits)).toString()
    : Number(scaledNum.toFixed(digits)).toString();

  if (unit !== undefined) {
    return `${formattedNum} ${item.symbol}${unit}`;
  }

  return `${formattedNum}${item.symbol}`;
}

function formatHashrate(hashrateHs) {
  return amountShortener(hashrateHs, 2, "H/s");
}

function formatNetworkDifficulty(difficulty) {
  return amountShortener(difficulty, 2);
}

function formatMetric(value, decimals = 2) {
  if (value === null || value === undefined || value === "") return t("na");

  const num = Number(value);
  if (!Number.isFinite(num)) return t("na");

  return num.toLocaleString(getLocale(), {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function loadCachedMarketMetrics() {
  try {
    const raw = localStorage.getItem(MARKET_METRICS_CACHE_KEY);
    if (!raw) return;

    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.timestamp > MARKET_METRICS_REFRESH_MS) return;

    cachedMarketMetrics = {
      ...cachedMarketMetrics,
      ...parsed.metrics,
    };
  } catch (err) {
    console.error(err);
  }
}

function saveCachedMarketMetrics() {
  try {
    localStorage.setItem(
      MARKET_METRICS_CACHE_KEY,
      JSON.stringify({
        timestamp: Date.now(),
        metrics: cachedMarketMetrics,
      }),
    );
  } catch (err) {
    console.error(err);
  }
}

async function computeMayerMultipleFromCoinGecko() {
  const data = await fetchJson(COINGECKO_MAYER_CHART_URL);
  const prices = Array.isArray(data?.prices) ? data.prices : [];
  const values = prices
    .map((point) => Number(point?.[1]))
    .filter((price) => Number.isFinite(price) && price > 0);

  if (values.length === 0) return null;

  const sma =
    values.reduce((sum, price) => sum + price, 0) / values.length;
  const current = values[values.length - 1];

  if (!Number.isFinite(sma) || sma <= 0) return null;

  return current / sma;
}

async function fetchMvrvFromCoinMetrics() {
  const data = await fetchJson(COINMETRICS_MVRV_URL);
  const latest = Array.isArray(data?.data) ? data.data[0] : null;
  const value = Number(latest?.CapMVRVCur);

  if (!Number.isFinite(value) || value <= 0) return null;

  return value;
}

function formatTooltipBitcoinPrice() {
  const price = getFiatPrice();
  if (!price) return t("na");
  return formatFiat(price);
}

function formatFearGreedValue() {
  if (cachedMarketMetrics.fearGreed === null) return t("na");
  return String(cachedMarketMetrics.fearGreed);
}

function getMayerMultipleTone(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < MAYER_CHEAP_MAX) return "cheap";
  if (num <= MAYER_NEUTRAL_MAX) return "neutral";
  return "expensive";
}

function getMvrvTone(value) {
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < MVRV_CHEAP_MAX) return "cheap";
  if (num <= MVRV_NEUTRAL_MAX) return "neutral";
  return "expensive";
}

function getFearGreedTone() {
  const label = cachedMarketMetrics.fearGreedLabel;
  if (FEAR_GREED_CHEAP_LABELS.has(label)) return "cheap";
  if (label === "Neutral") return "neutral";
  if (FEAR_GREED_EXPENSIVE_LABELS.has(label)) return "expensive";

  const value = Number(cachedMarketMetrics.fearGreed);
  if (!Number.isFinite(value)) return null;
  if (value < FEAR_GREED_NEUTRAL_MIN) return "cheap";
  if (value <= FEAR_GREED_NEUTRAL_MAX) return "neutral";
  return "expensive";
}

function appendTooltipLine(parent, text) {
  const line = document.createElement("span");
  line.className = "top-nav__tooltip-line";
  line.textContent = text;
  parent.appendChild(line);
}

function appendTooltipMetricLine(parent, labelKey, valueText, tone) {
  const line = document.createElement("span");
  line.className = "top-nav__tooltip-line";

  const label = t(labelKey, { value: "" });
  line.appendChild(document.createTextNode(label));

  const valueEl = document.createElement("span");
  valueEl.className = "top-nav__tooltip-metric-value";
  if (tone) {
    valueEl.classList.add(`top-nav__tooltip-metric-value--${tone}`);
  }
  valueEl.textContent = valueText;
  line.appendChild(valueEl);
  parent.appendChild(line);
}

function updateBlockHeightTooltip() {
  if (!blockHeightTooltipEl || cachedBlockHeight === null) return;

  const blockHeight = Number(cachedBlockHeight);
  if (!Number.isFinite(blockHeight)) return;

  blockHeightTooltipEl.replaceChildren();

  appendTooltipLine(
    blockHeightTooltipEl,
    t("blockHeight", { height: formatBlockHeight(blockHeight) }),
  );
  appendTooltipLine(
    blockHeightTooltipEl,
    t("blocksToDifficulty", {
      blocks: formatBlockHeight(blocksUntilDifficultyAdjustment(blockHeight)),
    }),
  );
  appendTooltipLine(
    blockHeightTooltipEl,
    t("blocksToHalving", {
      blocks: formatBlockHeight(blocksUntilHalving(blockHeight)),
    }),
  );
  appendTooltipLine(
    blockHeightTooltipEl,
    t("totalSupply", { amount: formatTotalBtcSupply(blockHeight) }),
  );
  appendTooltipLine(
    blockHeightTooltipEl,
    t("hashrate", { value: formatHashrate(cachedMiningStats.hashrate) }),
  );
  appendTooltipLine(
    blockHeightTooltipEl,
    t("networkDifficulty", {
      value: formatNetworkDifficulty(cachedMiningStats.difficulty),
    }),
  );
  appendTooltipMetricLine(
    blockHeightTooltipEl,
    "mayerMultiple",
    formatMetric(cachedMarketMetrics.mayerMultiple),
    getMayerMultipleTone(cachedMarketMetrics.mayerMultiple),
  );
  appendTooltipMetricLine(
    blockHeightTooltipEl,
    "mvrvRatio",
    formatMetric(cachedMarketMetrics.mvrv),
    getMvrvTone(cachedMarketMetrics.mvrv),
  );
  appendTooltipMetricLine(
    blockHeightTooltipEl,
    "fearGreedIndex",
    formatFearGreedValue(),
    getFearGreedTone(),
  );
  appendTooltipLine(
    blockHeightTooltipEl,
    t("bitcoinPrice", { value: formatTooltipBitcoinPrice() }),
  );

  blockHeightTooltipEl.hidden = false;
}

async function fetchMayerMultiple() {
  try {
    const data = await fetchJson(`${BITCOIN_DATA_API}/mayer-multiple/latest`);
    const value = Number(data?.mayerMultiple);
    if (Number.isFinite(value) && value > 0) {
      cachedMarketMetrics.mayerMultiple = value;
      return;
    }
  } catch (err) {
    console.error(err);
  }

  try {
    const value = await computeMayerMultipleFromCoinGecko();
    if (Number.isFinite(value) && value > 0) {
      cachedMarketMetrics.mayerMultiple = value;
    }
  } catch (err) {
    console.error(err);
  }
}

async function fetchMvrvRatio() {
  try {
    const data = await fetchJson(`${BITCOIN_DATA_API}/mvrv/latest`);
    const value = Number(data?.mvrv);
    if (Number.isFinite(value) && value > 0) {
      cachedMarketMetrics.mvrv = value;
      return;
    }
  } catch (err) {
    console.error(err);
  }

  try {
    const value = await fetchMvrvFromCoinMetrics();
    if (Number.isFinite(value) && value > 0) {
      cachedMarketMetrics.mvrv = value;
    }
  } catch (err) {
    console.error(err);
  }
}

async function fetchFearGreedIndex() {
  try {
    const data = await fetchJson(FEAR_GREED_API);
    const latest = Array.isArray(data?.data) ? data.data[0] : null;
    const value = Number(latest?.value);
    if (Number.isFinite(value)) {
      cachedMarketMetrics.fearGreed = value;
      cachedMarketMetrics.fearGreedLabel = latest?.value_classification ?? null;
    }
  } catch (err) {
    console.error(err);
  }
}

async function fetchMarketMetrics() {
  await Promise.all([
    fetchMayerMultiple(),
    fetchMvrvRatio(),
    fetchFearGreedIndex(),
  ]);
  saveCachedMarketMetrics();
  updateBlockHeightTooltip();
}

function startMarketMetricsRefresh() {
  fetchMarketMetrics();

  if (marketMetricsInterval !== null) {
    clearInterval(marketMetricsInterval);
  }

  marketMetricsInterval = setInterval(
    fetchMarketMetrics,
    MARKET_METRICS_REFRESH_MS,
  );
}

async function fetchMiningStats() {
  try {
    const data = await fetchJson(`${API_BASE}/v1/mining/hashrate/3d`);
    const hashrate = Number(data?.currentHashrate);
    const difficulty = Number(data?.currentDifficulty);

    if (Number.isFinite(hashrate) && hashrate > 0) {
      cachedMiningStats.hashrate = hashrate;
    }

    if (Number.isFinite(difficulty) && difficulty > 0) {
      cachedMiningStats.difficulty = difficulty;
    }
  } catch (err) {
    console.error(err);
  }
}

async function fetchBlockHeight() {
  try {
    const [heightResponse] = await Promise.all([
      fetch(`${API_BASE}/blocks/tip/height`),
      fetchFiatPrice(),
      fetchMiningStats(),
    ]);

    if (!heightResponse.ok) {
      throw new Error(`API error (${heightResponse.status})`);
    }

    const height = (await heightResponse.text()).trim();
    if (!/^\d+$/.test(height)) {
      throw new Error("Invalid block height response");
    }

    cachedBlockHeight = height;
    updateBlockHeightTooltip();
    if (txResultEl.classList.contains("show")) {
      updateTxConfirmationsDisplay();
    }
  } catch (err) {
    console.error(err);
  }
}

function startBlockHeightRefresh() {
  fetchBlockHeight();

  if (blockHeightInterval !== null) {
    clearInterval(blockHeightInterval);
  }

  blockHeightInterval = setInterval(fetchBlockHeight, UPDATE_INTERVAL_MS);
}

loadCachedMarketMetrics();
startBlockHeightRefresh();
startMarketMetricsRefresh();

lookupBtn.addEventListener("click", performLookup);
qrBtn.addEventListener("click", showQrCode);
qrOverlay.addEventListener("click", (event) => {
  if (event.target === qrOverlay) {
    hideQrPanel();
  }
});
addressInput.addEventListener("keydown", (event) => {
  if (event.key === "Enter") performLookup();
});

window.addEventListener("resize", () => {
  fitMetaAddressToWidth();
  fitBalanceBtcToWidth();

  if (currentTxLookup && txResultEl.classList.contains("show")) {
    setTxIdDisplay(currentTxLookup);
    fitTxValueBtcToWidth();
  }
});

onLanguageChange(() => {
  if (lookupBtn.disabled) {
    lookupBtn.textContent = t("loading");
  }

  const refreshAfterLanguageChange = async () => {
    if (getDisplayCurrency() === "BRL") {
      await ensureBrlPriceCached();
    }

    updateBlockHeightTooltip();

    if (lastAppliedTxData && txResultEl.classList.contains("show")) {
      applyTransactionData(lastAppliedTxData, { silent: true });
    }

    if (lastAppliedData && resultEl.classList.contains("show")) {
      applyAddressData(lastAppliedData, { silent: true });
    }
  };

  void refreshAfterLanguageChange();
});