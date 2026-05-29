const fs = require("fs");
const path = require("path");

const ngrokDir = path.join(__dirname, "..", "node_modules", "@expo", "ngrok");
const clientPath = path.join(ngrokDir, "src", "client.js");
const utilsPath = path.join(ngrokDir, "src", "utils.js");

function patchFile(filePath, marker, content) {
  if (!fs.existsSync(filePath)) {
    console.warn(`[patch-expo-ngrok] Missing ${filePath}, skipping.`);
    return;
  }

  const current = fs.readFileSync(filePath, "utf8");
  if (current.includes(marker)) {
    return;
  }

  fs.writeFileSync(filePath, content);
  console.log(`[patch-expo-ngrok] Patched ${path.relative(process.cwd(), filePath)}`);
}

patchFile(
  clientPath,
  "normalizeNgrokClientError",
  `const got = require("got");

class NgrokClientError extends Error {
  constructor(message, response, body) {
    super(message);
    this.name = "NgrokClientError";
    this.response = response;
    this.body = body;
  }
}

function normalizeNgrokClientError(error) {
  const response = error && error.response;
  if (!response) {
    return new NgrokClientError(
      (error && error.message) || String(error),
      null,
      null
    );
  }

  const rawBody = response.body;
  try {
    const body = typeof rawBody === "string" ? JSON.parse(rawBody) : rawBody;
    return new NgrokClientError(
      (body && (body.msg || body.message)) || rawBody || response.statusMessage,
      response,
      body
    );
  } catch (e) {
    return new NgrokClientError(
      rawBody || (error && error.message) || response.statusMessage,
      response,
      rawBody
    );
  }
}

class NgrokClient {
  constructor(processUrl) {
    this.internalApi = got.extend({
      prefixUrl: processUrl,
      retry: 0,
    });
  }

  async request(method, path, options = {}) {
    try {
      if (method === "get") {
        return await this.internalApi
          .get(path, { searchParams: options })
          .json();
      } else {
        return await this.internalApi[method](path, { json: options }).json();
      }
    } catch (error) {
      throw normalizeNgrokClientError(error);
    }
  }

  async booleanRequest(method, path, options = {}) {
    try {
      return await this.internalApi[method](path, { json: options }).then(
        (response) => response.statusCode === 204
      );
    } catch (error) {
      throw normalizeNgrokClientError(error);
    }
  }

  listTunnels() {
    return this.request("get", "api/tunnels");
  }

  startTunnel(options = {}) {
    return this.request("post", "api/tunnels", options);
  }

  tunnelDetail(name) {
    return this.request("get", \`api/tunnels/\${name}\`);
  }

  stopTunnel(name) {
    if (typeof name === "undefined" || name.length === 0) {
      throw new Error("To stop a tunnel, please provide a name.");
    }
    return this.booleanRequest("delete", \`api/tunnels/\${name}\`);
  }

  listRequests(options) {
    return this.request("get", "api/requests/http", options);
  }

  replayRequest(id, tunnelName) {
    return this.booleanRequest("post", "api/requests/http", { id, tunnelName });
  }

  deleteAllRequests() {
    return this.booleanRequest("delete", "api/requests/http");
  }

  requestDetail(id) {
    if (typeof id === "undefined" || id.length === 0) {
      throw new Error("To get the details of a request, please provide an id.");
    }
    return this.request("get", \`api/requests/http/\${id}\`);
  }
}

module.exports = { NgrokClient, NgrokClientError };
`
);

patchFile(
  utilsPath,
  "isTransientNgrokError",
  `const { homedir } = require("os");
const { join } = require("path");
const { parse } = require("yaml");
const { readFileSync } = require("fs");

function defaultConfigPath() {
  return join(homedir(), ".ngrok2", "ngrok.yml");
}

function defaults(opts) {
  opts = opts || { proto: "http", addr: 80 };
  if (opts.name) {
    const configPath = opts.configPath || defaultConfigPath();
    const config = parse(readFileSync(configPath, "utf8"));
    if (config.tunnels && config.tunnels[opts.name]) {
      opts = Object.assign(opts, config.tunnels[opts.name]);
    }
  }
  if (typeof opts === "function") opts = { proto: "http", addr: 80 };
  if (typeof opts !== "object") opts = { proto: "http", addr: opts };
  if (!opts.proto) opts.proto = "http";
  if (!opts.addr) opts.addr = opts.port || opts.host || 80;
  if (opts.httpauth) opts.auth = opts.httpauth;
  return opts;
}

function validate(opts) {
  if (opts.web_addr === false || opts.web_addr === "false") {
    throw new Error(
      "web_addr:false is not supported, module depends on internal ngrok api"
    );
  }
}

function bodyText(body) {
  if (!body) return "";
  if (typeof body === "string") return body;
  try {
    return JSON.stringify(body);
  } catch (e) {
    return "";
  }
}

function isTransientNgrokError(message) {
  return /ECONNRESET|ECONNREFUSED|socket hang up|remote gone away|tunnel session not ready|successful ngrok tunnel session has not yet been established/i.test(
    message || ""
  );
}

function isRetriable(err) {
  const message = (err && err.message) || "";
  if (!err || !err.response) {
    return isTransientNgrokError(message);
  }

  const statusCode = err.response.statusCode;
  const body = err.body || {};
  const text = bodyText(body) || message;
  const details = body && typeof body === "object" ? body.details : null;
  const detailError = details && details.err;
  const notReady500 = statusCode === 500 && /panic/.test(text);
  const notReady502 =
    statusCode === 502 && detailError === "tunnel session not ready yet";
  const notReady503 =
    statusCode === 503 &&
    detailError ===
      "a successful ngrok tunnel session has not yet been established";
  return notReady500 || notReady502 || notReady503 || isTransientNgrokError(text);
}

module.exports = {
  defaults,
  validate,
  isRetriable,
};
`
);
