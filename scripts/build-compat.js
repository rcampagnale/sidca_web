// scripts/build-compat.js
//
// Compila el proyecto con Node 17 o superior.
//
// Problema que resuelve: este proyecto usa react-scripts 4 (webpack 4), que
// calcula hashes con MD4. A partir de Node 17 OpenSSL 3 dejó de permitir ese
// algoritmo, así que `react-scripts build` falla con:
//
//   Error: error:0308010C:digital envelope routines::unsupported
//   (ERR_OSSL_EVP_UNSUPPORTED)
//
// La solución es habilitar el proveedor legacy de OpenSSL. Se hace acá, en un
// script de Node, para que funcione igual en Windows, Linux y macOS sin
// depender de cross-env.
//
// Uso:  npm run build:compat
// (En Node 16 o anterior `npm run build` funciona sin este script.)

const { spawn } = require("child_process");
const path = require("path");

const [major] = process.versions.node.split(".").map(Number);
const necesitaLegacy = major >= 17;

const nodeOptions = [
  process.env.NODE_OPTIONS || "",
  necesitaLegacy ? "--openssl-legacy-provider" : "",
]
  .filter(Boolean)
  .join(" ")
  .trim();

if (necesitaLegacy) {
  console.log(
    `[build-compat] Node ${process.versions.node}: habilitando --openssl-legacy-provider para webpack 4.`
  );
}

const reactScripts = path.join(
  __dirname,
  "..",
  "node_modules",
  "react-scripts",
  "bin",
  "react-scripts.js"
);

const hijo = spawn(process.execPath, [reactScripts, "build"], {
  stdio: "inherit",
  env: {
    ...process.env,
    ...(nodeOptions ? { NODE_OPTIONS: nodeOptions } : {}),
  },
});

hijo.on("close", (code) => process.exit(code ?? 1));
hijo.on("error", (error) => {
  console.error("[build-compat] No se pudo iniciar el build:", error.message);
  process.exit(1);
});
