#!/usr/bin/env node

import { createServer } from "node:http";
import { createReadStream } from "node:fs";
import {
  access,
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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "..");
const RELEASE_DIR = path.join(REPO_ROOT, "release");
const ARTIFACT_DIR = path.join(REPO_ROOT, "artifacts", "ui-smoke");
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
  const options = { baseUrl: "", keepBrowser: false };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--base-url") {
      options.baseUrl = args[index + 1] ?? "";
      index += 1;
    } else if (arg === "--keep-browser") {
      options.keepBrowser = true;
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

const captureScreenshot = async (client, filename) => {
  const screenshot = await client.send("Page.captureScreenshot", { format: "png", fromSurface: true }, 10000);
  await mkdir(ARTIFACT_DIR, { recursive: true });
  await writeFile(path.join(ARTIFACT_DIR, filename), Buffer.from(screenshot.data, "base64"));
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

  await clickButton(client, "按类别对比");
  await waitForText(client, "胜出方：");
  const category = await pageState(client);
  assert(category.text.includes("输入：") && category.text.includes("输出："), "Category compare mode should show input/output types");

  await clickButton(client, "按功能排序");
  await waitForText(client, "按业务场景筛选");
  const functionMode = await pageState(client);
  assert(functionMode.text.includes("长文本") && functionMode.text.includes("输入：") && functionMode.text.includes("输出："), "Function compare mode should show scene and input/output types");

  await clickButton(client, "免费本地模型");
  await waitForText(client, "免费大模型");
  const freeModels = await pageState(client);
  assert(freeModels.text.includes("# 安装") && freeModels.text.includes("# 使用示例"), "Free model cards should show install and usage commands");
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
