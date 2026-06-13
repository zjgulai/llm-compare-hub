#!/usr/bin/env node

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import {
  access,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { deflateSync, inflateSync } from "node:zlib";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const RELEASE_DIR = path.join(REPO_ROOT, "release");
const ARTIFACT_DIR = path.join(REPO_ROOT, "artifacts", "ui-smoke");
const BASELINE_DIR = path.join(REPO_ROOT, "tests", "visual-baselines");
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const DEFAULT_VISUAL_THRESHOLD = 0.15;
const PIXEL_DELTA_THRESHOLD = 80;
const HEADERS = {
  "Cache-Control": "no-store",
  "X-Content-Type-Options": "nosniff",
};

const MIME_TYPES = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
]);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const parseArgs = () => {
  const args = process.argv.slice(2);
  const options = {
    baseUrl: "",
    keepBrowser: false,
    updateBaselines: false,
    visualThreshold: DEFAULT_VISUAL_THRESHOLD,
  };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--base-url") {
      options.baseUrl = args[index + 1] ?? "";
      index += 1;
    } else if (arg === "--keep-browser") {
      options.keepBrowser = true;
    } else if (arg === "--update-baselines") {
      options.updateBaselines = true;
    } else if (arg === "--visual-threshold") {
      const value = Number(args[index + 1]);
      assert(Number.isFinite(value) && value >= 0 && value <= 1, "--visual-threshold must be a number between 0 and 1");
      options.visualThreshold = value;
      index += 1;
    } else {
      throw new Error(`Unknown argument: ${arg}`);
    }
  }
  return options;
};

const assert = (condition, message) => {
  if (!condition) {
    throw new Error(message);
  }
};

const pathExists = async (target) => {
  try {
    await access(target);
    return true;
  } catch {
    return false;
  }
};

const makeCrcTable = () => {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
};

const CRC_TABLE = makeCrcTable();

const crc32 = (buffers) => {
  let crc = 0xffffffff;
  for (const buffer of buffers) {
    for (const byte of buffer) {
      crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const parsePng = (buffer) => {
  assert(buffer.subarray(0, 8).equals(PNG_SIGNATURE), "Invalid PNG signature");

  let offset = 8;
  let width = 0;
  let height = 0;
  let bitDepth = 0;
  let colorType = 0;
  let interlace = 0;
  const idatChunks = [];

  while (offset < buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.subarray(offset + 4, offset + 8).toString("ascii");
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      bitDepth = data[8];
      colorType = data[9];
      interlace = data[12];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  assert(bitDepth === 8, `Unsupported PNG bit depth: ${bitDepth}`);
  assert(interlace === 0, "Interlaced PNG screenshots are not supported");
  assert(colorType === 6 || colorType === 2, `Unsupported PNG color type: ${colorType}`);

  const bytesPerPixel = colorType === 6 ? 4 : 3;
  const raw = inflateSync(Buffer.concat(idatChunks));
  const stride = width * bytesPerPixel;
  const pixels = Buffer.alloc(width * height * 4);
  let rawOffset = 0;
  let previous = Buffer.alloc(stride);

  for (let y = 0; y < height; y += 1) {
    const filter = raw[rawOffset];
    rawOffset += 1;
    const scanline = Buffer.from(raw.subarray(rawOffset, rawOffset + stride));
    rawOffset += stride;
    const recon = Buffer.alloc(stride);

    for (let x = 0; x < stride; x += 1) {
      const left = x >= bytesPerPixel ? recon[x - bytesPerPixel] : 0;
      const up = previous[x] ?? 0;
      const upLeft = x >= bytesPerPixel ? previous[x - bytesPerPixel] : 0;
      let predictor = 0;
      if (filter === 1) predictor = left;
      else if (filter === 2) predictor = up;
      else if (filter === 3) predictor = Math.floor((left + up) / 2);
      else if (filter === 4) {
        const p = left + up - upLeft;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - upLeft);
        predictor = pa <= pb && pa <= pc ? left : pb <= pc ? up : upLeft;
      } else if (filter !== 0) {
        throw new Error(`Unsupported PNG filter: ${filter}`);
      }
      recon[x] = (scanline[x] + predictor) & 0xff;
    }

    for (let x = 0; x < width; x += 1) {
      const source = x * bytesPerPixel;
      const target = (y * width + x) * 4;
      pixels[target] = recon[source];
      pixels[target + 1] = recon[source + 1];
      pixels[target + 2] = recon[source + 2];
      pixels[target + 3] = colorType === 6 ? recon[source + 3] : 255;
    }
    previous = recon;
  }

  return { width, height, pixels };
};

const createPngChunk = (type, data) => {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32([typeBuffer, data]), 0);
  return Buffer.concat([length, typeBuffer, data, crc]);
};

const encodeRgbaPng = ({ width, height, pixels }) => {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    const target = y * (stride + 1);
    raw[target] = 0;
    pixels.copy(raw, target + 1, y * stride, y * stride + stride);
  }

  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  ihdr[10] = 0;
  ihdr[11] = 0;
  ihdr[12] = 0;

  return Buffer.concat([
    PNG_SIGNATURE,
    createPngChunk("IHDR", ihdr),
    createPngChunk("IDAT", deflateSync(raw)),
    createPngChunk("IEND", Buffer.alloc(0)),
  ]);
};

const normalizeUrlPath = (requestUrl) => {
  const parsed = new URL(requestUrl, "http://127.0.0.1");
  const decoded = decodeURIComponent(parsed.pathname);
  return decoded === "/" ? "/index.html" : decoded;
};

const serveRelease = async () => {
  assert(await pathExists(path.join(RELEASE_DIR, "index.html")), "release/index.html is missing; run make release first");

  const server = createServer(async (request, response) => {
    if (!request.url) {
      response.writeHead(400, HEADERS).end("Bad request");
      return;
    }

    const urlPath = normalizeUrlPath(request.url);
    const relativePath = urlPath.replace(/^\/+/, "");
    const candidate = path.resolve(RELEASE_DIR, relativePath);

    if (!candidate.startsWith(RELEASE_DIR + path.sep)) {
      response.writeHead(403, HEADERS).end("Forbidden");
      return;
    }

    let filePath = candidate;
    let fileStat;
    try {
      fileStat = await stat(filePath);
      if (fileStat.isDirectory()) {
        filePath = path.join(filePath, "index.html");
        fileStat = await stat(filePath);
      }
    } catch {
      if (urlPath.startsWith("/assets/")) {
        response.writeHead(404, HEADERS).end("Not found");
        return;
      }
      filePath = path.join(RELEASE_DIR, "index.html");
      fileStat = await stat(filePath);
    }

    const ext = path.extname(filePath);
    response.writeHead(200, {
      ...HEADERS,
      "Content-Length": fileStat.size,
      "Content-Type": MIME_TYPES.get(ext) ?? "application/octet-stream",
    });
    createReadStream(filePath).pipe(response);
  });

  await new Promise((resolve, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolve);
  });

  const address = server.address();
  assert(address && typeof address === "object", "Could not bind local smoke server");
  return {
    baseUrl: `http://127.0.0.1:${address.port}/`,
    close: () => new Promise((resolve) => server.close(resolve)),
  };
};

const which = (command) => {
  const result = spawnSync("which", [command], { encoding: "utf8" });
  return result.status === 0 ? result.stdout.trim() : "";
};

const findChrome = () => {
  const candidates = [
    process.env.CHROME_PATH,
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
    which("google-chrome"),
    which("google-chrome-stable"),
    which("chromium"),
    which("chromium-browser"),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (spawnSync(candidate, ["--version"], { encoding: "utf8" }).status === 0) {
      return candidate;
    }
  }
  throw new Error("Chrome/Chromium not found. Set CHROME_PATH to run UI smoke checks.");
};

const waitForDevToolsPort = async (profileDir) => {
  const portFile = path.join(profileDir, "DevToolsActivePort");
  for (let attempt = 0; attempt < 80; attempt += 1) {
    try {
      const [port] = (await readFile(portFile, "utf8")).trim().split("\n");
      if (port) return port;
    } catch {
      await sleep(100);
    }
  }
  throw new Error("Timed out waiting for Chrome DevTools port");
};

class CdpClient {
  constructor(webSocketUrl) {
    this.webSocketUrl = webSocketUrl;
    this.nextId = 1;
    this.pending = new Map();
    this.events = [];
    this.consoleErrors = [];
  }

  async connect() {
    this.socket = new WebSocket(this.webSocketUrl);
    await new Promise((resolve, reject) => {
      this.socket.addEventListener("open", resolve, { once: true });
      this.socket.addEventListener("error", reject, { once: true });
    });
    this.socket.addEventListener("message", (event) => this.handleMessage(event));
  }

  handleMessage(event) {
    const message = JSON.parse(event.data);
    if (message.id && this.pending.has(message.id)) {
      const { resolve, reject, timeout } = this.pending.get(message.id);
      clearTimeout(timeout);
      this.pending.delete(message.id);
      if (message.error) {
        reject(new Error(`${message.error.message}: ${message.error.data ?? ""}`));
      } else {
        resolve(message.result ?? {});
      }
      return;
    }

    this.events.push(message);
    if (message.method === "Runtime.exceptionThrown") {
      this.consoleErrors.push(message.params.exceptionDetails?.text ?? "Runtime exception");
    }
    if (message.method === "Runtime.consoleAPICalled" && message.params.type === "error") {
      this.consoleErrors.push(message.params.args?.map((arg) => arg.value ?? arg.description).join(" ") ?? "console.error");
    }
    if (message.method === "Log.entryAdded" && message.params.entry?.level === "error") {
      this.consoleErrors.push(message.params.entry.text);
    }
  }

  send(method, params = {}, timeoutMs = 8000) {
    const id = this.nextId;
    this.nextId += 1;
    const payload = JSON.stringify({ id, method, params });
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`CDP timeout: ${method}`));
      }, timeoutMs);
      this.pending.set(id, { resolve, reject, timeout });
      this.socket.send(payload);
    });
  }

  close() {
    this.socket?.close();
  }
}

const launchChrome = async () => {
  const chromePath = findChrome();
  const profileDir = await mkdtemp(path.join(tmpdir(), "llm-hub-smoke-"));
  const chrome = spawn(chromePath, [
    "--headless=new",
    "--disable-gpu",
    "--disable-dev-shm-usage",
    "--no-first-run",
    "--no-default-browser-check",
    "--remote-debugging-address=127.0.0.1",
    "--remote-debugging-port=0",
    `--user-data-dir=${profileDir}`,
    "about:blank",
  ], {
    stdio: ["ignore", "ignore", "pipe"],
  });

  let stderr = "";
  chrome.stderr.on("data", (chunk) => {
    stderr += chunk.toString();
  });

  const port = await waitForDevToolsPort(profileDir);
  return {
    chrome,
    profileDir,
    port,
    stderr: () => stderr,
    cleanup: async (keepBrowser = false) => {
      if (!keepBrowser && !chrome.killed) {
        chrome.kill("SIGTERM");
        await waitForProcessExit(chrome, 3000);
      }
      for (let attempt = 0; attempt < 10; attempt += 1) {
        try {
          await rm(profileDir, { force: true, recursive: true });
          return;
        } catch (error) {
          if (attempt === 9) throw error;
          await sleep(100);
        }
      }
    },
  };
};

const waitForProcessExit = async (child, timeoutMs) => {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise((resolve) => {
    const timeout = setTimeout(() => {
      if (!child.killed) child.kill("SIGKILL");
      resolve();
    }, timeoutMs);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
};

const createTab = async (port, url) => {
  const endpoint = `http://127.0.0.1:${port}/json/new?${encodeURIComponent(url)}`;
  let response = await fetch(endpoint, { method: "PUT" });
  if (!response.ok) response = await fetch(endpoint);
  assert(response.ok, `Could not create Chrome tab: HTTP ${response.status}`);
  const tab = await response.json();
  const client = new CdpClient(tab.webSocketDebuggerUrl);
  await client.connect();
  await client.send("Page.enable");
  await client.send("Runtime.enable");
  await client.send("Log.enable");
  return client;
};

const evaluate = async (client, expression) => {
  const result = await client.send("Runtime.evaluate", {
    expression,
    awaitPromise: true,
    returnByValue: true,
    userGesture: true,
  });
  if (result.exceptionDetails) {
    throw new Error(result.exceptionDetails.exception?.description ?? result.exceptionDetails.text);
  }
  return result.result?.value;
};

const waitForText = async (client, text, timeoutMs = 8000) => {
  const expected = JSON.stringify(text);
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    if (await evaluate(client, `document.body?.innerText.includes(${expected}) ?? false`)) return;
    await sleep(100);
  }
  throw new Error(`Timed out waiting for text: ${text}`);
};

const clickButton = async (client, label) => {
  const encoded = JSON.stringify(label);
  await evaluate(client, `(() => {
    const matches = Array.from(document.querySelectorAll("button"))
      .filter((button) => button.textContent.trim() === ${encoded});
    if (matches.length !== 1) throw new Error(${JSON.stringify(`Expected one button: ${label}`)} + ", got " + matches.length);
    matches[0].click();
    return true;
  })()`);
};

const selectedTabLabel = async (client, selector) => {
  const encoded = JSON.stringify(selector);
  return evaluate(client, `(() => {
    const root = document.querySelector(${encoded});
    const selected = root?.querySelector("[role='tab'][aria-selected='true']");
    return selected?.textContent?.trim() ?? "";
  })()`);
};

const activeElementLabel = async (client) => evaluate(client, `(() => {
  const element = document.activeElement;
  return element?.textContent?.trim() || element?.getAttribute("aria-label") || element?.getAttribute("placeholder") || "";
})()`);

const pressKey = async (client, key) => {
  const keyCodes = { Tab: 9, Enter: 13, Space: 32 };
  const code = key === " " ? "Space" : key;
  await client.send("Input.dispatchKeyEvent", {
    type: "keyDown",
    key,
    code,
    windowsVirtualKeyCode: keyCodes[key] ?? 0,
  });
  await client.send("Input.dispatchKeyEvent", {
    type: "keyUp",
    key,
    code,
    windowsVirtualKeyCode: keyCodes[key] ?? 0,
  });
};

const pageState = async (client) => evaluate(client, `(() => {
  const text = document.body.innerText;
  const search = document.querySelector("input[type='text']");
  const buttons = Array.from(document.querySelectorAll("button"));
  const unnamedButtons = buttons
    .filter((button) => !(button.textContent || button.getAttribute("aria-label") || button.title || "").trim())
    .length;
  const unlabeledInputs = Array.from(document.querySelectorAll("input"))
    .filter((input) => !(input.getAttribute("aria-label") || input.placeholder || input.title || "").trim())
    .length;
  return {
    title: document.title,
    lang: document.documentElement.lang,
    text,
    searchPlaceholder: search ? search.getAttribute("placeholder") : "",
    unnamedButtons,
    unlabeledInputs,
    viewportWidth: window.innerWidth,
    scrollWidth: document.documentElement.scrollWidth,
    scripts: Array.from(document.scripts).map((script) => script.src).filter(Boolean),
    styles: Array.from(document.querySelectorAll("link[rel='stylesheet']")).map((link) => link.href),
  };
})()`);

const accessibilityAudit = async (client, { mobile = false } = {}) => evaluate(client, `(() => {
  const issues = [];
  const visible = (element) => {
    const style = window.getComputedStyle(element);
    const rect = element.getBoundingClientRect();
    return style.display !== "none" && style.visibility !== "hidden" && rect.width > 0 && rect.height > 0;
  };
  const nameOf = (element) => {
    const labelledBy = element.getAttribute("aria-labelledby");
    if (labelledBy) {
      const text = labelledBy
        .split(/\\s+/)
        .map((id) => document.getElementById(id)?.textContent?.trim() ?? "")
        .filter(Boolean)
        .join(" ");
      if (text) return text;
    }
    return (
      element.getAttribute("aria-label") ||
      element.textContent ||
      element.getAttribute("title") ||
      element.getAttribute("placeholder") ||
      ""
    ).trim();
  };
  const selectorName = (element) => {
    const name = nameOf(element);
    if (name) return name.slice(0, 40);
    return element.id || element.className || element.tagName.toLowerCase();
  };
  const parseRgb = (value) => {
    const match = value.match(/rgba?\\(([^)]+)\\)/);
    if (!match) return null;
    const [r, g, b, a = "1"] = match[1].split(",").map((part) => Number.parseFloat(part.trim()));
    if (![r, g, b, a].every(Number.isFinite)) return null;
    return { r, g, b, a };
  };
  const blendedBackground = (element) => {
    let current = element;
    while (current && current !== document.documentElement) {
      const color = parseRgb(window.getComputedStyle(current).backgroundColor);
      if (color && color.a > 0) return color;
      current = current.parentElement;
    }
    return { r: 255, g: 255, b: 255, a: 1 };
  };
  const luminance = ({ r, g, b }) => {
    const channel = (value) => {
      const normalized = value / 255;
      return normalized <= 0.03928 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    };
    return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
  };
  const contrastRatio = (fg, bg) => {
    const light = Math.max(luminance(fg), luminance(bg));
    const dark = Math.min(luminance(fg), luminance(bg));
    return (light + 0.05) / (dark + 0.05);
  };

  if (document.documentElement.lang !== "zh-CN") issues.push("html lang should be zh-CN");
  if (document.querySelectorAll("main").length !== 1) issues.push("page should expose exactly one main landmark");
  if (!document.querySelector("header")) issues.push("page should expose a header landmark");
  if (!document.querySelector("footer")) issues.push("page should expose a footer landmark");

  const primaryNav = document.querySelector("nav[aria-label='主导航']");
  if (!primaryNav) {
    issues.push("primary navigation should have aria-label='主导航'");
  } else if (primaryNav.getAttribute("role") !== "tablist") {
    issues.push("primary navigation should use role='tablist'");
  }

  const tabs = primaryNav ? Array.from(primaryNav.querySelectorAll("[role='tab']")) : [];
  if (tabs.length < 3) issues.push("primary views should expose at least three role='tab' controls");
  const selectedTabs = tabs.filter((tab) => tab.getAttribute("aria-selected") === "true");
  if (tabs.length && selectedTabs.length !== 1) issues.push("exactly one primary tab should be selected");
  for (const tab of tabs) {
    const controls = tab.getAttribute("aria-controls");
    if (!controls) issues.push(\`tab "\${selectorName(tab)}" should declare aria-controls\`);
  }
  for (const tab of selectedTabs) {
    const controls = tab.getAttribute("aria-controls");
    if (!controls || !document.getElementById(controls)) issues.push(\`selected tab "\${selectorName(tab)}" should reference the active panel\`);
  }

  const panels = Array.from(document.querySelectorAll("main[role='tabpanel']"));
  if (panels.length !== 1) issues.push("active view should expose exactly one role='tabpanel'");
  for (const panel of panels) {
    const labelledBy = panel.getAttribute("aria-labelledby");
    if (!labelledBy || !document.getElementById(labelledBy)) issues.push("tabpanel should reference its selected tab");
  }

  const compareHeading = Array.from(document.querySelectorAll("h2, h3"))
    .some((heading) => heading.textContent?.trim() === "模型对比排序");
  if (compareHeading) {
    const compareModes = document.querySelector("[aria-label='对比模式']");
    if (!compareModes) {
      issues.push("compare mode controls should have aria-label='对比模式'");
    } else if (compareModes.getAttribute("role") !== "tablist") {
      issues.push("compare mode controls should use role='tablist'");
    }

    const compareTabs = Array.from(document.querySelectorAll("[data-compare-tab='true']"));
    if (compareTabs.length !== 3) issues.push("compare page should expose three accessible mode tabs");
    const selectedCompareTabs = compareTabs.filter((tab) => tab.getAttribute("aria-selected") === "true");
    if (compareTabs.length && selectedCompareTabs.length !== 1) issues.push("exactly one compare mode tab should be selected");
    for (const tab of compareTabs) {
      if (tab.getAttribute("role") !== "tab") issues.push(\`compare mode "\${selectorName(tab)}" should use role='tab'\`);
      if (!tab.getAttribute("aria-controls")) issues.push(\`compare mode "\${selectorName(tab)}" should declare aria-controls\`);
    }
    for (const tab of selectedCompareTabs) {
      const controls = tab.getAttribute("aria-controls");
      if (!controls || !document.getElementById(controls)) issues.push(\`selected compare mode "\${selectorName(tab)}" should reference the active panel\`);
    }
  }

  const interactives = Array.from(document.querySelectorAll("button, a[href], input, select, textarea, [role='button'], [role='tab']"))
    .filter(visible);
  for (const element of interactives) {
    if (!nameOf(element)) issues.push(\`\${selectorName(element)} is missing an accessible name\`);
    if (${mobile ? "true" : "false"}) {
      const rect = element.getBoundingClientRect();
      if (rect.width < 32 || rect.height < 32) {
        issues.push(\`\${selectorName(element)} touch target is too small: \${Math.round(rect.width)}x\${Math.round(rect.height)}\`);
      }
    }
  }

  const textNodes = Array.from(document.querySelectorAll("body *"))
    .filter((element) => visible(element) && nameOf(element) && window.getComputedStyle(element).fontSize);
  for (const element of textNodes) {
    const style = window.getComputedStyle(element);
    const fontSize = Number.parseFloat(style.fontSize);
    if (!Number.isFinite(fontSize) || fontSize < 12) continue;
    const foreground = parseRgb(style.color);
    const background = blendedBackground(element);
    if (!foreground || !background) continue;
    const ratio = contrastRatio(foreground, background);
    const threshold = fontSize >= 18 || style.fontWeight >= 700 ? 3 : 4.5;
    if (ratio < threshold) {
      issues.push(\`low contrast \${ratio.toFixed(2)} for "\${selectorName(element)}"\`);
    }
  }

  const requiresModelCards = ["调用概览", "综合 TOP", "免费大模型"].some((marker) => document.body.innerText.includes(marker));
  const dataCards = Array.from(document.querySelectorAll("[data-model-card='true']")).filter(visible);
  if (requiresModelCards && dataCards.length === 0) issues.push("model data views should expose scannable model cards");
  for (const card of dataCards) {
    if (card.getAttribute("role") !== "article") issues.push("model data card should use role='article'");
    const heading = card.querySelector("h3[id], h4[id]");
    if (!heading) issues.push("model data card should include an id-backed heading");
    if (heading && card.getAttribute("aria-labelledby") !== heading.id) {
      issues.push(\`model data card "\${selectorName(heading)}" should be labelled by its heading\`);
    }
  }

  return { issues };
})()`);

const assertAccessibilityAudit = async (client, options) => {
  const { issues } = await accessibilityAudit(client, options);
  assert(issues.length === 0, `Accessibility audit failed:\n${issues.join("\n")}`);
};

const captureScreenshot = async (client, filename) => {
  const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true }, 10000);
  await mkdir(ARTIFACT_DIR, { recursive: true });
  const screenshotPath = path.join(ARTIFACT_DIR, filename);
  await writeFile(screenshotPath, Buffer.from(screenshot.data, "base64"));
  return screenshotPath;
};

const compareScreenshots = async (filename, threshold) => {
  const baselinePath = path.join(BASELINE_DIR, filename);
  const currentPath = path.join(ARTIFACT_DIR, filename);

  assert(await pathExists(baselinePath), `Missing visual baseline ${path.relative(REPO_ROOT, baselinePath)}. Run make smoke-ui-update-baselines to create it.`);

  const baseline = parsePng(await readFile(baselinePath));
  const current = parsePng(await readFile(currentPath));
  assert(
    baseline.width === current.width && baseline.height === current.height,
    `${filename} dimensions changed: baseline ${baseline.width}x${baseline.height}, current ${current.width}x${current.height}`,
  );

  let changedPixels = 0;
  const diffPixels = Buffer.alloc(current.pixels.length);
  for (let index = 0; index < current.pixels.length; index += 4) {
    const delta =
      Math.abs(current.pixels[index] - baseline.pixels[index]) +
      Math.abs(current.pixels[index + 1] - baseline.pixels[index + 1]) +
      Math.abs(current.pixels[index + 2] - baseline.pixels[index + 2]) +
      Math.abs(current.pixels[index + 3] - baseline.pixels[index + 3]);

    if (delta > PIXEL_DELTA_THRESHOLD) {
      changedPixels += 1;
      diffPixels[index] = 236;
      diffPixels[index + 1] = 72;
      diffPixels[index + 2] = 153;
      diffPixels[index + 3] = 255;
    } else {
      const gray = Math.round((current.pixels[index] + current.pixels[index + 1] + current.pixels[index + 2]) / 3);
      diffPixels[index] = gray;
      diffPixels[index + 1] = gray;
      diffPixels[index + 2] = gray;
      diffPixels[index + 3] = 80;
    }
  }

  const totalPixels = current.width * current.height;
  const ratio = changedPixels / totalPixels;
  const diffName = filename.replace(/\.png$/, "-diff.png");
  await writeFile(path.join(ARTIFACT_DIR, diffName), encodeRgbaPng({
    width: current.width,
    height: current.height,
    pixels: diffPixels,
  }));

  assert(
    ratio <= threshold,
    `${filename} visual diff ${(ratio * 100).toFixed(2)}% exceeds threshold ${(threshold * 100).toFixed(2)}%; see artifacts/ui-smoke/${diffName}`,
  );
  console.log(`OK ${filename} visual diff ${(ratio * 100).toFixed(2)}% <= ${(threshold * 100).toFixed(2)}%`);
};

const updateBaseline = async (filename) => {
  await mkdir(BASELINE_DIR, { recursive: true });
  await copyFile(path.join(ARTIFACT_DIR, filename), path.join(BASELINE_DIR, filename));
  console.log(`OK updated visual baseline ${path.relative(REPO_ROOT, path.join(BASELINE_DIR, filename))}`);
};

const handleVisualBaselines = async (options) => {
  for (const filename of ["desktop-home.png", "mobile-home.png"]) {
    if (options.updateBaselines) {
      await updateBaseline(filename);
    } else {
      await compareScreenshots(filename, options.visualThreshold);
    }
  }
};

const assertPrimaryKeyboardNavigation = async (client) => {
  await evaluate(client, "document.body.focus()");
  await pressKey(client, "Tab");
  assert(await activeElementLabel(client) === "模型列表", "Tab should focus the selected primary tab first");

  await pressKey(client, "ArrowRight");
  await waitForText(client, "模型对比排序");
  assert(await selectedTabLabel(client, "nav[aria-label='主导航']") === "对比排序", "ArrowRight should select the next primary tab");
  assert(await activeElementLabel(client) === "对比排序", "ArrowRight should keep focus on the selected primary tab");

  await pressKey(client, "ArrowRight");
  await waitForText(client, "免费大模型");
  assert(await selectedTabLabel(client, "nav[aria-label='主导航']") === "免费本地模型", "ArrowRight should wrap through primary tabs");

  await pressKey(client, "ArrowLeft");
  await waitForText(client, "模型对比排序");
  assert(await selectedTabLabel(client, "nav[aria-label='主导航']") === "对比排序", "ArrowLeft should select the previous primary tab");

  await clickButton(client, "模型列表");
  await waitForText(client, "调用概览 - 硅基流动");
};

const assertCompareModeKeyboardNavigation = async (client) => {
  await evaluate(client, "document.getElementById('compare-tab-overall')?.focus()");
  await pressKey(client, "ArrowRight");
  await waitForText(client, "胜出方：");
  assert(await selectedTabLabel(client, "[aria-label='对比模式']") === "按类别对比", "ArrowRight should select the next compare mode");

  await pressKey(client, "ArrowRight");
  await waitForText(client, "按业务场景筛选");
  assert(await selectedTabLabel(client, "[aria-label='对比模式']") === "按功能排序", "ArrowRight should advance compare modes");

  await pressKey(client, "Home");
  await waitForText(client, "综合 TOP");
  assert(await selectedTabLabel(client, "[aria-label='对比模式']") === "综合 TOP", "Home should return to the first compare mode");
};

const expectedAssets = async () => {
  const index = await readFile(path.join(RELEASE_DIR, "index.html"), "utf8");
  return Array.from(index.matchAll(/(?:src|href)="\.\/(assets\/[^"]+)"/g), (match) => match[1]).sort();
};

const assertPageAssets = async (client, baseUrl) => {
  const refs = await expectedAssets();
  const state = await pageState(client);
  const loaded = [...state.scripts, ...state.styles];
  for (const ref of refs) {
    assert(loaded.some((asset) => asset.endsWith(ref)), `Expected page to load ${ref}`);
    const response = await fetch(new URL(ref, baseUrl));
    assert(response.ok, `${ref} should return 2xx, got ${response.status}`);
  }
};

const assertMissingAsset404 = async (baseUrl) => {
  const response = await fetch(new URL("assets/__missing-ui-smoke__.js", baseUrl));
  assert(response.status === 404, `/assets/* missing file should return 404, got ${response.status}`);
};

const runDesktopChecks = async (client, baseUrl) => {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 1366,
    height: 850,
    deviceScaleFactor: 1,
    mobile: false,
  });
  await client.send("Page.navigate", { url: baseUrl });
  await waitForText(client, "调用概览 - 硅基流动");
  await captureScreenshot(client, "desktop-home.png");

  const initial = await pageState(client);
  assert(initial.lang === "zh-CN", `Expected html lang zh-CN, got ${initial.lang}`);
  assert(initial.title.includes("大模型选型指南"), "Page title should be localized");
  assert(initial.text.includes("模型列表") && initial.text.includes("对比排序") && initial.text.includes("免费本地模型"), "Main nav labels should be visible");
  assert(initial.searchPlaceholder === "搜索模型、Model ID 或厂商", "Search placeholder should be localized");
  assert(initial.unnamedButtons === 0, `${initial.unnamedButtons} button(s) are missing accessible names`);
  assert(initial.unlabeledInputs === 0, `${initial.unlabeledInputs} input(s) are missing labels/placeholders`);
  await assertPageAssets(client, baseUrl);
  await assertAccessibilityAudit(client, { mobile: false });
  await assertPrimaryKeyboardNavigation(client);

  await clickButton(client, "PoYo.ai");
  await waitForText(client, "调用概览 - PoYo.ai");
  const poyo = await pageState(client);
  assert(poyo.text.includes("复制 cURL") && poyo.text.includes("文档"), "PoYo.ai model cards should show docs and cURL actions");
  assert(!poyo.text.includes("数据加载失败"), "PoYo.ai tab should not show a load failure");

  await clickButton(client, "对比排序");
  await waitForText(client, "稳定性评分");
  const compareTop = await pageState(client);
  assert(compareTop.text.includes("综合 TOP") && compareTop.text.includes("按类别对比") && compareTop.text.includes("按功能排序"), "Compare modes should be visible");
  assert(compareTop.text.includes("输入：") && compareTop.text.includes("输出："), "Overall compare mode should show input/output types");
  assert(compareTop.text.includes("支持多模态") || compareTop.text.includes("单模态/专用数据"), "Overall compare mode should show modality support");
  await assertAccessibilityAudit(client, { mobile: false });
  await assertCompareModeKeyboardNavigation(client);

  await clickButton(client, "按类别对比");
  await waitForText(client, "胜出方：");
  const category = await pageState(client);
  assert(category.text.includes("输入：") && category.text.includes("输出："), "Category compare mode should show input/output types");
  await assertAccessibilityAudit(client, { mobile: false });

  await clickButton(client, "按功能排序");
  await waitForText(client, "按业务场景筛选");
  const functionMode = await pageState(client);
  assert(functionMode.text.includes("长文本") && functionMode.text.includes("输入：") && functionMode.text.includes("输出："), "Function compare mode should show scene and input/output types");
  await assertAccessibilityAudit(client, { mobile: false });

  await clickButton(client, "免费本地模型");
  await waitForText(client, "免费大模型");
  const freeModels = await pageState(client);
  assert(freeModels.text.includes("# 安装") && freeModels.text.includes("# 使用示例"), "Free model cards should show install and usage commands");
  await assertAccessibilityAudit(client, { mobile: false });
};

const runMobileChecks = async (client, baseUrl) => {
  await client.send("Emulation.setDeviceMetricsOverride", {
    width: 390,
    height: 844,
    deviceScaleFactor: 1,
    mobile: true,
  });
  await client.send("Page.navigate", { url: baseUrl });
  await waitForText(client, "调用概览 - 硅基流动");
  await captureScreenshot(client, "mobile-home.png");

  const state = await pageState(client);
  assert(state.text.includes("大模型 API 选型、对比与本地模型参考"), "Mobile subtitle should be visible");
  assert(state.scrollWidth <= state.viewportWidth + 1, `Mobile layout overflows horizontally: ${state.scrollWidth} > ${state.viewportWidth}`);
  assert(state.text.includes("模型列表") && state.text.includes("对比排序") && state.text.includes("免费本地模型"), "Mobile nav labels should be visible");
  await assertAccessibilityAudit(client, { mobile: true });
};

const main = async () => {
  const options = parseArgs();
  let server;
  let browser;
  let client;
  const baseUrl = options.baseUrl || (server = await serveRelease()).baseUrl;

  try {
    await mkdir(ARTIFACT_DIR, { recursive: true });
    browser = await launchChrome();
    client = await createTab(browser.port, baseUrl);

    await assertMissingAsset404(baseUrl);
    await runDesktopChecks(client, baseUrl);
    await runMobileChecks(client, baseUrl);
    await handleVisualBaselines(options);

    assert(client.consoleErrors.length === 0, `Browser console errors:\n${client.consoleErrors.join("\n")}`);
    console.log(`OK UI smoke checks passed for ${baseUrl}`);
    console.log(`OK screenshots written to ${path.relative(REPO_ROOT, ARTIFACT_DIR)}/`);
  } finally {
    client?.close();
    await browser?.cleanup(options.keepBrowser);
    await server?.close();
  }
};

main().catch((error) => {
  console.error(`UI smoke check failed: ${error.message}`);
  process.exit(1);
});
