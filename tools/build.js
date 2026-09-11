/* Deploy build: copies the site into dist/ and minifies the first-party JS and
   CSS there, each with a source map. The readable originals in js/ and css/
   are what gets edited and committed; only dist/ is uploaded to Cloudflare.

   Wrangler runs this before every `wrangler deploy` and `wrangler dev`
   ([build] in wrangler.toml), so deploying is still the one command.

   What gets copied is decided by .assetsignore, the same file that decides
   what Cloudflare may serve. It is copied along, so wrangler applies it to
   dist/ exactly as it did to the repo root.

   Source maps go to /maps/, outside the year-long /js/* and /css/* cache in
   _headers: a map keeps one URL across deploys, so it must not be frozen.
   DevTools uses them to show the original, commented files. */
const fs = require("fs");
const path = require("path");
const esbuild = require("esbuild");

const ROOT = path.join(__dirname, "..");
const OUT = path.join(ROOT, "dist");
// a vendor snippet: the script it loads reads its top-level names
const KEEP_AS_IS = new Set(["js/plerdy.js"]);

// .assetsignore in the gitignore style it is written in: "dir/" is a
// directory at any depth, "*.ext" a file name at any depth, "/x" the root only
function ignoreRules() {
  const esc = (s) => s.replace(/[.+^${}()|[\]\\?]/g, "\\$&");
  return fs.readFileSync(path.join(ROOT, ".assetsignore"), "utf8").split(/\r?\n/)
    .map((l) => l.trim()).filter((l) => l && !l.startsWith("#"))
    .map((p) => {
      const dirOnly = p.endsWith("/");
      if (dirOnly) p = p.slice(0, -1);
      const anchored = p.includes("/");
      if (p.startsWith("/")) p = p.slice(1);
      const re = new RegExp("^" + p.split("*").map(esc).join("[^/]*") + "$");
      return (rel, isDir) => (!dirOnly || isDir) && re.test(anchored ? rel : path.posix.basename(rel));
    });
}

function copyTree(rules) {
  const skip = (rel, isDir) => rel === "dist" || rules.some((m) => m(rel, isDir));
  let files = 0;
  const walk = (relDir) => {
    for (const ent of fs.readdirSync(path.join(ROOT, relDir), { withFileTypes: true })) {
      const rel = relDir ? relDir + "/" + ent.name : ent.name;
      const isDir = ent.isDirectory();
      if (skip(rel, isDir)) continue;
      if (isDir) {
        fs.mkdirSync(path.join(OUT, rel), { recursive: true });
        walk(rel);
      } else if (ent.isFile()) {
        fs.copyFileSync(path.join(ROOT, rel), path.join(OUT, rel));
        files++;
      }
    }
  };
  walk("");
  return files;
}

function minify() {
  const rows = [];
  for (const dir of ["js", "css"]) {
    const abs = path.join(OUT, dir);
    if (!fs.existsSync(abs)) continue;
    for (const name of fs.readdirSync(abs)) {
      if (!name.endsWith("." + dir)) continue;
      const rel = dir + "/" + name;
      if (KEEP_AS_IS.has(rel)) continue;
      const src = fs.readFileSync(path.join(abs, name), "utf8");
      const r = esbuild.transformSync(src, {
        loader: dir,
        minify: true,
        legalComments: "none",
        // JS only: keeps the minifier from writing syntax newer than the
        // source's own (CSS is left untargeted, so nothing is rewritten)
        ...(dir === "js" ? { target: "es2020" } : {}),
        sourcemap: "external",
        sourcefile: rel,
        sourceRoot: "/src/",
      });
      for (const w of r.warnings) console.warn("build warning:", rel, w.text);
      const mapUrl = "/maps/" + rel + ".map";
      const tail = dir === "css" ? `\n/*# sourceMappingURL=${mapUrl} */\n` : `\n//# sourceMappingURL=${mapUrl}\n`;
      fs.writeFileSync(path.join(abs, name), r.code + tail);
      fs.mkdirSync(path.join(OUT, "maps", dir), { recursive: true });
      fs.writeFileSync(path.join(OUT, "maps", rel + ".map"), r.map);
      rows.push([rel, Buffer.byteLength(src), Buffer.byteLength(r.code)]);
    }
  }
  return rows;
}

fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT);
const copied = copyTree(ignoreRules());
const rows = minify();
console.log(`build: ${copied} files copied to dist/`);
for (const [rel, before, after] of rows) {
  console.log(`  ${rel.padEnd(20)} ${(before / 1024).toFixed(1).padStart(6)} KB -> ${(after / 1024).toFixed(1).padStart(6)} KB`);
}
