const TXID_REGEX = /^[a-f0-9]{64}$/i;

function isValidTxid(input) {
  return TXID_REGEX.test(input.trim());
}

function asciiToHex(text) {
  return [...text]
    .map((char) => char.charCodeAt(0).toString(16).padStart(2, "0"))
    .join("");
}

function hexContainsAscii(hex, text) {
  return hex.toLowerCase().includes(asciiToHex(text));
}

function decodePushDataHex(hex) {
  const normalized = hex.toLowerCase();
  if (!normalized || normalized.length % 2 !== 0) return "";

  try {
    const bytes = new Uint8Array(normalized.length / 2);
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Number.parseInt(
        normalized.slice(index * 2, index * 2 + 2),
        16,
      );
    }
    return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
  } catch (err) {
    return "";
  }
}

function isMostlyPrintable(text) {
  if (!text || text.length < 2) return false;

  let printable = 0;
  for (const char of text) {
    const code = char.charCodeAt(0);
    if (code >= 32 && code <= 126) printable += 1;
  }

  return printable / text.length >= 0.8;
}

function extractOpReturnPayloadHex(vout) {
  const scriptHex = (vout.scriptpubkey || "").toLowerCase();
  if (!scriptHex.startsWith("6a")) return "";

  let offset = 2;
  const chunks = [];

  while (offset < scriptHex.length) {
    const opcode = Number.parseInt(scriptHex.slice(offset, offset + 2), 16);
    offset += 2;

    if (opcode === 0) continue;
    if (opcode >= 1 && opcode <= 75) {
      const dataHex = scriptHex.slice(offset, offset + opcode * 2);
      if (dataHex.length !== opcode * 2) break;
      chunks.push(dataHex);
      offset += opcode * 2;
      continue;
    }
    if (opcode === 0x4c) {
      const length = Number.parseInt(scriptHex.slice(offset, offset + 2), 16);
      offset += 2;
      const dataHex = scriptHex.slice(offset, offset + length * 2);
      if (dataHex.length !== length * 2) break;
      chunks.push(dataHex);
      offset += length * 2;
      continue;
    }
    break;
  }

  return chunks.join("");
}

function detectEmbeddedData(tx) {
  const found = new Set();

  for (const vout of tx.vout || []) {
    if (vout.scriptpubkey_type !== "op_return") continue;

    found.add("op_return");

    const asm = vout.scriptpubkey_asm || "";
    const scriptHex = (vout.scriptpubkey || "").toLowerCase();
    const payloadHex = extractOpReturnPayloadHex(vout);
    const payloadText = decodePushDataHex(payloadHex);

    if (asm.includes("OP_PUSHNUM_13") || scriptHex.startsWith("6a5d")) {
      found.add("runes");
    }

    if (hexContainsAscii(scriptHex, "RUNE")) {
      found.add("runes");
    }

    if (
      payloadText.includes('{"p":"brc-20"') ||
      payloadText.includes('{"p":"brc20"')
    ) {
      found.add("brc20");
    }

    if (hexContainsAscii(scriptHex, "ord")) {
      found.add("inscription");
    }

    if (isMostlyPrintable(payloadText)) {
      found.add("text");
    }
  }

  for (const input of tx.vin || []) {
    const witnessHex = (input.witness || []).join("").toLowerCase();
    if (!witnessHex) continue;

    if (
      witnessHex.includes("036f7264") ||
      witnessHex.includes("6f7264") ||
      witnessHex.includes("ff0063036f7264")
    ) {
      found.add("inscription");
    }

    const imageMarkers = [
      "image/png",
      "image/jpeg",
      "image/gif",
      "image/webp",
      "image/svg",
    ];
    if (imageMarkers.some((marker) => hexContainsAscii(witnessHex, marker))) {
      found.add("image");
    }
  }

  return [...found];
}