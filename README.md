# Bitcoin Explorer

A lightweight, client-side web app to look up Bitcoin balances and activity directly from the timechain. No backend, no accounts, and no build step — open `index.html` in a browser or serve the folder locally.

Data is fetched live from the [mempool.space](https://mempool.space) public API.

## What it is used for

- **Search addresses, public keys, and transactions** in one field — the app auto-detects the input type (like mempool.space)
- **Check confirmed BTC balance** for any address or public key (unconfirmed shown separately)
- **See the fiat value** of the confirmed balance in real time (USD or BRL)
- **Inspect on-chain activity** — script type, exposed pubkey status, transaction count, and last transaction details
- **Track how long ago** the last confirmed transaction occurred
- **Monitor mempool activity** — directional arrows show pending incoming and outgoing funds
- **Watch the global mempool** — animated blocks fall behind the card as new transactions enter the mempool, color-coded by fee rate
- **Look up any transaction** by txid — output value, fee, confirmations, first-seen date, confirmation timing, and embedded data (OP_RETURN, inscriptions, runes, etc.)
- **Get audio alerts** when new unconfirmed or confirmed transactions are detected (including when a watched transaction confirms)
- **Share or receive payments** via a scannable QR code
- **Monitor live** — data refreshes automatically every 10 seconds
- **Switch language** between English and Brazilian Portuguese

Useful for quickly verifying a donation address, checking a wallet balance, or exploring legacy P2PK outputs (such as early coinbase rewards) without opening a full block explorer.

## How to use

1. Open `index.html` in any modern browser, or serve the folder locally:

```bash
python -m http.server 8080
```

Then visit `http://localhost:8080`.

2. Paste a **Bitcoin address**, **public key in hex**, or **transaction ID** (64-character hex).
3. Click **Check**.

The same search box handles all input types. A 64-character hex string is treated as a txid; everything else is resolved as an address or public key.

### Navigation bar

The top bar runs across the full width of the page and includes:

| Control | Location | Purpose |
|---|---|---|
| **Bitcoin logo** | Left | Hover to see live chain and market stats (preloaded on page load) |
| **Sound toggle** | Right | Mute or unmute transaction alert sounds |
| **Language picker** | Right | Switch between English (US flag) and Portuguese (Brazil flag) |

Language and sound preferences are saved in `localStorage`.

### Bitcoin logo tooltip

Hover the Bitcoin logo in the navigation bar to see live on-chain and market data:

| Line | Updates | Description |
|---|---|---|
| **Height** | Every 10 s | Current chain tip block height |
| **Difficult Adjustment** | Every 10 s | Blocks remaining until the next difficulty retarget |
| **Halving** | Every 10 s | Blocks remaining until the next halving |
| **Supply** | Every 10 s | Total BTC supply at the current height (whole BTC, no decimals) |
| **Hash Rate** | Every 10 s | Current network hashrate (e.g. `XX.XX ZH/s`) |
| **Difficulty** | Every 10 s | Current network difficulty (e.g. `133.87T`) |
| **Mayer Multiple** | Every 1 h | BTC price divided by the 200-day moving average |
| **MVRV Ratio** | Every 1 h | Market value to realized value ratio |
| **Fear & Greed** | Every 1 h | Crypto Fear & Greed Index (0–100) |
| **Price** | Every 10 s | Current BTC spot price in USD or BRL |

Hash rate and difficulty come from `GET /api/v1/mining/hashrate/3d`. Total supply is computed locally from the halving schedule at the current block height.

Mayer Multiple, MVRV, and Fear & Greed values are **color-coded**:

| Color | Meaning |
|---|---|
| **Green** | Cheap / undervalued (Mayer &lt; 1, MVRV &lt; 1, Fear) |
| **Yellow** | Neutral (Mayer 1–2.4, MVRV 1–3.7, Neutral) |
| **Red** | Expensive / overvalued (Mayer &gt; 2.4, MVRV &gt; 3.7, Greed) |

Market metrics are cached in `localStorage` for one hour so they survive page reloads and API rate limits.

### Falling mempool blocks

On page load, the app connects to the mempool.space WebSocket (`wss://mempool.space/api/v1/ws`) and subscribes to global mempool activity. Each new mempool transaction spawns one falling block behind the main card.

| Block type | Color | When |
|---|---|---|
| **Global mempool** | Green → red by fee rate (`fee / vsize`) | Every new transaction in the global mempool |
| **Watched address** | Purple | A mempool transaction touches the address or pubkey currently being looked up |

Fee colors use the same scale as mempool.space. Blocks are small squares (8–18 px) with a centered **₿** symbol. Up to 36 blocks can fall at once; additional transactions are queued and spawned steadily so the browser stays responsive. If the WebSocket drops, the app falls back to polling `/api/mempool/recent` every 2.5 seconds.

While an address or public key lookup is active, the app also subscribes to that target over the same WebSocket so address-specific mempool events spawn purple blocks (and still trigger transaction sounds).

### Supported inputs

| Input type | Format | Example |
|---|---|---|
| Legacy P2PKH | starts with `1` | `1A1zP1eP5QGefi2DMPTfTL5SLmv7DivfNa` |
| P2SH | starts with `3` | `3J98t1WpEZ73CNmYviecrnyiWrnqRhWNLy` |
| Native SegWit P2WPKH | `bc1q`, 42 chars | `bc1qar0srrr7xfkvy5l643lydnw9re59gtzzwf5mdq` |
| Native SegWit P2WSH | `bc1q`, 62 chars | `bc1q...` (longer bech32) |
| Taproot P2TR | starts with `bc1p` | `bc1p...` |
| Compressed public key | 66 hex chars, `02` or `03` prefix | `02...` / `03...` |
| Uncompressed public key | 130 hex chars, `04` prefix | `04...` |
| Transaction ID | 64 hex chars | `f4184fc596403b9d638783cf57adfe4c75c605f6356fbc9133855e5811f2e4fe6` |

### Transaction lookup

When a txid is detected, the result panel shows:

| Field | Description |
|---|---|
| **Output value** | Total BTC in transaction outputs (large display) |
| **Status** | Confirmed or Unconfirmed — unconfirmed status blinks slowly in yellow |
| **Transaction ID** | Full txid (truncated to fit one line; hover for the full value) |
| **First Seen Date** | When the transaction first entered the mempool |
| **Fee** | `rate sat/vB × vsize vB = fee sats` on one line |
| **Embedded data** | `Yes` or `No` — detects OP_RETURN, inscriptions, runes, BRC-20, images, and plain text |
| **Confirmations** | `0` while unconfirmed; `chain tip − block height + 1` after confirmation |
| **Confirmed Date** | Block time when confirmed (`N/A` while pending) |
| **Time to confirmation** | Elapsed time from first seen to confirmation (`N/A` while pending) |
| **Time since confirmation** | Live counter from confirmation time (`N/A` while pending) |

First-seen time for confirmed transactions comes from `GET /api/v1/transaction-times` while still in the mempool, with a fallback to `GET /api/v1/block/{hash}/tx/{txid}/summary` after confirmation.

Transaction data refreshes every **10 seconds**. A mechanical click sound plays when a watched transaction moves from unconfirmed to confirmed (respects the mute toggle).

## How the app works

The application is a static single-page interface made of plain HTML, CSS, and JavaScript. All logic runs in the browser. There is no server-side code and no database.

```
┌─────────────┐     user input      ┌──────────────────┐
│  index.html │ ──────────────────► │     app.js       │
│  styles.css │                     │  (orchestration) │
└─────────────┘                     └────────┬─────────┘
                                             │
              ┌──────────────────────────────┼──────────────────────────────────────────────────────┐
              ▼              ▼               ▼               ▼              ▼         ▼       ▼      ▼
      ┌──────────────┐ ┌──────────┐  ┌──────────────┐ ┌──────────┐  ┌──────────┐ ┌────────┐ ┌──────────┐ ┌────────────┐
      │pubkey-utils  │ │tx-utils  │  │ mempool.space│ │sounds.js │  │blocks-fx │ │ qrcode │ │ CoinGecko│ │ CoinMetrics│
      │.js           │ │.js       │  │ REST + WS    │ │          │  │.js       │ │ (CDN)  │ │          │ │            │
      └──────────────┘ └──────────┘  └──────────────┘ └──────────┘  └──────────┘ └────────┘ └──────────┘ └────────────┘
                                              ▲
                                         ┌──────────┐
                                         │  i18n.js │
                                         └──────────┘
```

### Lookup flow

When the user clicks **Check**, `app.js` classifies the input and routes to the correct flow:

**Address / public key**

1. **Classify the input** — `pubkey-utils.js` decides whether the string is a standard address or a hex-encoded secp256k1 public key.
2. **Resolve the API target** — depending on the input type, the app queries a different mempool.space endpoint (see [Public keys vs addresses](#public-keys-vs-addresses) below).
3. **Fetch on-chain data** — three lightweight API calls:
   - address or scripthash statistics (`chain_stats` + `mempool_stats`)
   - the most recent confirmed transaction (`/txs/chain`, first page)
   - BTC spot prices (`/v1/prices`)
4. **Compute derived values** — confirmed BTC balance, fiat estimate, script type, exposed pubkey status, last transaction date, and formatted timestamps.
5. **Render the result panel** and start live timers.

**Transaction ID**

1. **Detect txid** — `tx-utils.js` matches 64-character hex strings.
2. **Fetch transaction** — `GET /api/tx/{txid}` plus first-seen time from `GET /api/v1/transaction-times` (with block-summary fallback for confirmed txs).
3. **Analyze outputs** — fee rate, virtual size, embedded-data detection, and confirmation count vs chain tip.
4. **Render the transaction panel** and start live timers (confirmation elapsed time, confirmation count).

### Balance calculation

The main balance display shows **confirmed** funds only:

```
confirmed sats = chain_stats.funded_txo_sum − chain_stats.spent_txo_sum
confirmed BTC = confirmed sats / 100,000,000
```

Unconfirmed mempool balance is tracked separately and shown in the subtitle when mempool activity exists:

```
unconfirmed sats = mempool_stats.funded_txo_sum − mempool_stats.spent_txo_sum
```

This is the **net** of all pending transactions combined — not just the last one. Examples:

| Pending activity | Net unconfirmed shown |
|---|---|
| +0.1 BTC receive only | `0.10000000 BTC` |
| −0.1 BTC spend only | `-0.10000000 BTC` |
| +0.2 BTC in, −0.1 BTC out | `0.10000000 BTC` |
| +0.1 BTC in, −0.1 BTC out | `0.00000000 BTC` (line still shown when both directions are active) |

The fiat line is based on the **confirmed** balance using the live BTC spot price:

- **English** → USD (from mempool.space `GET /api/v1/prices`)
- **Portuguese** → BRL (from [CoinGecko](https://api.coingecko.com), since mempool.space does not provide BRL)

Prices are merged into a local cache so BRL persists across the 10-second refresh cycle. If a price request fails, the last successful cached value is reused.

### Unconfirmed direction arrows

When the unconfirmed balance line is visible, small triangles appear **before** the amount:

| Arrow | Meaning |
|---|---|
| **▲** green | Pending incoming funds (`mempool_stats.funded_txo_sum > 0`) |
| **▼** red | Pending outgoing funds (`mempool_stats.spent_txo_sum > 0`) |
| **Both** | Incoming and outgoing mempool activity at the same time |

Negative net balances are prefixed with a minus sign (e.g. `▼ -0.10000000 BTC unconfirmed`).

### Transaction sounds

After the first successful lookup, auto-refresh can trigger audio alerts (requires a prior user click to unlock browser audio):

| Event | Sound |
|---|---|
| New unconfirmed transaction | Bell |
| New confirmed transaction (address lookup) | Mechanical "done" click |
| Watched transaction confirms (tx lookup) | Mechanical "done" click |

Use the bell button in the navigation bar to mute or unmute sounds. The preference is saved in `localStorage`.

### Exposed public key

The **Exposed PubKey** field indicates whether the public key for this lookup is visible on-chain:

| Input | Result |
|---|---|
| Public key hex (P2PK lookup) | **Yes** — the key itself is being viewed |
| Address with spent outputs | **Yes** — spending reveals the pubkey in the transaction input |
| Address that only received, never spent | **No** |

### Live updates

Timers keep the UI fresh after a successful lookup:

| Timer | Interval | Purpose |
|---|---|---|
| Auto-refresh | 10 s | Silently re-fetches address or transaction data from mempool.space |
| Block height & price | 10 s | Updates chain tip, difficulty/halving countdown, supply, hashrate, network difficulty, and BTC spot price in the logo tooltip |
| Market metrics | 1 h | Refreshes Mayer Multiple, MVRV Ratio, and Fear & Greed Index |
| Time since last transaction | 1 s | Updates the human-readable elapsed time counter (address lookup) |
| Time since confirmation | 1 s | Updates the elapsed time since a transaction was confirmed |
| Confirmations | 10 s | Updates confirmation count as new blocks are mined |
| Fiat / unconfirmed cycle | 10 s | When mempool activity exists, alternates the subtitle between fiat value and unconfirmed BTC (with a fade transition) |

Auto-refresh uses a generation counter so stale responses from earlier lookups are ignored if the user submits a new input before the request finishes.

### QR code

The QR button encodes the original lookup value (address or public key hex) into a canvas using the `qrcode` library loaded from jsDelivr.

### Internationalization

`i18n.js` provides English and Brazilian Portuguese translations for all UI text. Switching language updates labels, error messages, date/time formatting, and the display currency (USD ↔ BRL) immediately. If results are already on screen, the panel refreshes in the new language without a new lookup.

## Public keys vs addresses

Bitcoin **addresses** and **public keys** are not the same thing, and they can hold different UTXO sets on-chain.

| Concept | What it represents | How this app queries it |
|---|---|---|
| **Address** | A human-readable encoding of a specific output script (P2PKH, P2SH, SegWit, Taproot, etc.) | `GET /api/address/{address}` |
| **Public key (P2PK)** | The raw secp256k1 key embedded directly in an output script | `GET /api/scripthash/{hash}` |

### Address lookups

For strings that look like normal Bitcoin addresses, the app calls the standard address endpoint:

```
GET https://mempool.space/api/address/{address}
GET https://mempool.space/api/address/{address}/txs/chain
```

The address string is sent to the API as-is. Address type (`P2PKH`, `P2SH`, `P2WPKH`, `P2WSH`, `P2TR`) is inferred locally from prefix and length.

### Public key lookups (P2PK)

Early Bitcoin outputs — including the famous genesis block coinbase — were often locked with **P2PK** (*Pay to Public Key*), not P2PKH. The output script looks like:

```
OP_PUSHBYTES_65 <uncompressed pubkey> OP_CHECKSIG   (uncompressed, 04...)
OP_PUSHBYTES_33 <compressed pubkey>   OP_CHECKSIG   (compressed, 02/03...)
```

mempool.space does **not** accept a raw public key on the `/api/address/` route. Instead, the website builds the P2PK script, hashes it, and queries the **scripthash** endpoint — the same approach used in this app and in [mempool's own frontend](https://github.com/mempool/mempool).

#### Step-by-step (what `pubkey-utils.js` does)

1. **Detect** a hex public key:
   - 66 characters starting with `02` or `03` → compressed
   - 130 characters starting with `04` → uncompressed
2. **Build the scriptPubKey** in hex:
   - Uncompressed: `41` + pubkey + `ac`
   - Compressed: `21` + pubkey + `ac`
   (`41` / `21` are push opcodes for 65 / 33 bytes; `ac` is `OP_CHECKSIG`)
3. **Hash the script** with SHA-256 (via the Web Crypto API) to produce the scripthash.
4. **Query mempool.space**:
   ```
   GET https://mempool.space/api/scripthash/{scripthash}
   GET https://mempool.space/api/scripthash/{scripthash}/txs/chain
   ```

The result panel labels the field **Public Key:** and shows script type **P2PK**.

#### Why balances can differ

A public key and its derived P2PKH address (`1...`) are **different scripts** on-chain. UTXOs sent to one are not included in the other.

Example — the genesis block uncompressed public key:

| Lookup method | Endpoint | Typical balance |
|---|---|---|
| Public key (P2PK script) | `/api/scripthash/...` | ~50 BTC (coinbase + other P2PK outputs) |
| Derived P2PKH address `1A1zP1...` | `/api/address/1A1zP1...` | ~57 BTC (includes unrelated donations to that address) |

This app follows mempool.space and queries the **P2PK scripthash** when you paste a public key, so you see the balance locked directly to that key — not the balance of a derived `1...` address.

## Data shown for each lookup

### Transaction

See [Transaction lookup](#transaction-lookup) above for the full field list.

### Balance (address / public key)

| Field | Description |
|---|---|
| **BTC Balance** | Confirmed balance in BTC |
| **Fiat / Unconfirmed** | Fiat value of the confirmed balance (USD or BRL). When mempool activity exists, alternates every 10 seconds between the fiat value and the net unconfirmed amount (with direction arrows) |

### Details

| Field | Description |
|---|---|
| **Address / Public Key** | The value that was looked up (truncated with `...` to fit one line; hover for the full value) |
| **Address Type** | `P2PK`, `P2PKH`, `P2SH`, `P2WPKH`, `P2WSH`, or `P2TR` |
| **Exposed PubKey** | `Yes` if the public key is visible on-chain, `No` otherwise |
| **Transactions** | Total number of confirmed transactions |
| **Last Transaction Date** | When the most recent confirmed transaction was mined |
| **Time Since Last Transaction** | Live counter, updated every second |

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure, navigation bar, unified search form, address/transaction result panels, QR overlay |
| `styles.css` | Dark-themed styling, unconfirmed status blink animation |
| `app.js` | API calls, address/transaction routing, balance logic, live timers, sound triggers, UI updates |
| `pubkey-utils.js` | Public key detection, P2PK script construction, scripthash calculation |
| `tx-utils.js` | Txid validation, embedded-data detection (OP_RETURN, inscriptions, runes, BRC-20, images) |
| `i18n.js` | English / Brazilian Portuguese translations and language picker |
| `sounds.js` | Web Audio transaction alert sounds and mute toggle |
| `blocks-fx.js` | Mempool WebSocket, falling-block animation, fee-based and address-specific block colors |
| `favicon.svg` | Bitcoin logo favicon |

## External dependencies

| Dependency | Loaded from | Used for |
|---|---|---|
| [qrcode](https://www.npmjs.com/package/qrcode) | jsDelivr CDN | QR code generation |
| [mempool.space API](https://mempool.space/docs/api/rest) | `mempool.space` | On-chain data, block height, mining stats, and USD prices |
| [mempool.space WebSocket](https://mempool.space/docs/api/websocket) | `wss://mempool.space/api/v1/ws` | Live global mempool and watched-address transaction events |
| [CoinGecko API](https://www.coingecko.com/en/api) | `api.coingecko.com` | BRL spot price and Mayer Multiple fallback (200-day SMA) |
| [CoinMetrics Community API](https://community-api.coinmetrics.io/) | `community-api.coinmetrics.io` | MVRV Ratio fallback (`CapMVRVCur`) |
| [bitcoin-data.com API](https://bitcoin-data.com/) | `bitcoin-data.com` | Primary Mayer Multiple and MVRV data (rate-limited) |
| [Alternative.me Fear & Greed API](https://alternative.me/crypto/fear-and-greed-index/) | `api.alternative.me` | Crypto Fear & Greed Index |
| Web Crypto API | Browser built-in | SHA-256 for scripthash calculation |
| Web Audio API | Browser built-in | Transaction alert sounds |

### Market metrics fallbacks

Mayer Multiple and MVRV are fetched from bitcoin-data.com first. If that API is unavailable (rate limit or network error), the app falls back automatically:

| Metric | Primary source | Fallback |
|---|---|---|
| Mayer Multiple | bitcoin-data.com | Computed locally from CoinGecko 200-day price history |
| MVRV Ratio | bitcoin-data.com | CoinMetrics `CapMVRVCur` |
| Fear & Greed | Alternative.me | — |

## Author

Created by [@razivex](https://github.com/razivex)