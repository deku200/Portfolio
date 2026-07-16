/* ==========================================================
   slv_visual — admin panel (talks to the backend API)
   Auth is a real login (POST /api/login) with an httpOnly session
   cookie; all data lives in the server database, not the browser.
   ========================================================== */

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/* ---------- API helper ---------- */
async function api(method, path, body, isForm) {
  const opts = { method, credentials: "include" };
  if (body != null && !isForm) { opts.headers = { "Content-Type": "application/json" }; opts.body = JSON.stringify(body); }
  else if (body != null && isForm) { opts.body = body; } // FormData sets its own headers
  const r = await fetch("/api" + path, opts);
  let d = null; try { d = await r.json(); } catch (_) {}
  if (!r.ok) throw Object.assign(new Error((d && d.error) || ("HTTP " + r.status)), { status: r.status });
  return d;
}

function flash(msg) {
  const f = $("#flash");
  f.textContent = msg; f.classList.add("show");
  clearTimeout(flash._t); flash._t = setTimeout(() => f.classList.remove("show"), 1800);
}

const STATUS_OPTS = [["online", "Online"], ["offline", "Offline"], ["atwork", "At Work"]];
const statusSelect = (cur, cls) =>
  `<select class="${cls}">` +
  STATUS_OPTS.map(([v, l]) => `<option value="${v}"${v === cur ? " selected" : ""}>${l}</option>`).join("") +
  `</select>`;

/* ---------- image optimizer + upload ---------- */
const MAX_UPLOAD = 4.5 * 1024 * 1024; // stay under the server's 5 MB cap
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("unsupported or corrupted image file")); };
    img.src = url;
  });
}
function encodeJpeg(c, quality) {
  return new Promise((resolve, reject) =>
    c.toBlob(b => b ? resolve(b) : reject(new Error("image dimensions too large to process")), "image/jpeg", quality));
}
async function optimizeImage(file, maxW, maxH) {
  const img = await loadImage(file);
  // fit inside maxW × maxH — the height cap keeps huge full-page screenshots
  // within canvas limits instead of only scaling by width
  const scale = Math.min(1, maxW / img.width, (maxH || 4000) / img.height);
  const w = Math.max(1, Math.round(img.width * scale)), h = Math.max(1, Math.round(img.height * scale));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  c.getContext("2d").drawImage(img, 0, 0, w, h);
  // step the quality down until the file fits the upload cap
  for (const q of [0.82, 0.7, 0.58, 0.45]) {
    const blob = await encodeJpeg(c, q);
    if (blob.size <= MAX_UPLOAD) return blob;
  }
  throw new Error("image is too large even after compression");
}
async function uploadImage(file, maxW) {
  const blob = await optimizeImage(file, maxW || 800);
  const fd = new FormData(); fd.append("file", blob, "image.jpg");
  const d = await api("POST", "/upload", fd, true);
  return d.url;
}

/* ---------- 1. LOGIN GATE ---------- */
(async function boot() {
  const gateEl = $("#gate"), app = $("#app");
  const show = () => { gateEl.style.display = "none"; app.hidden = false; initApp(); };

  $("#gate-form").addEventListener("submit", async e => {
    e.preventDefault();
    $("#gate-err").textContent = "";
    try {
      await api("POST", "/login", { username: $("#gate-user").value.trim(), password: $("#gate-pass").value });
      $("#gate-pass").value = "";
      show();
    } catch (err) {
      $("#gate-err").textContent = err.status === 401 ? "ACCESS DENIED" : "LOGIN FAILED — IS THE SERVER RUNNING?";
    }
  });

  // resume an existing session
  try { await api("GET", "/me"); show(); } catch (_) { /* stay on the gate */ }
})();

function initApp() {
  $("#tabbar").addEventListener("click", e => {
    const btn = e.target.closest("button[data-view]");
    if (!btn) return;
    $$("#tabbar button").forEach(b => b.classList.toggle("is-active", b === btn));
    $$(".view").forEach(v => v.classList.toggle("is-active", v.id === "view-" + btn.dataset.view));
  });
  $("#lock-btn").addEventListener("click", async () => {
    try { await api("POST", "/logout"); } catch (_) {}
    location.reload();
  });

  renderApplications();
  renderTeamList();
  buildPartnerForm();
  buildProjectsEditor();
}

/* ---------- 2. APPLICATIONS ---------- */
async function renderApplications() {
  const list = $("#apps-list");
  let apps;
  try { apps = await api("GET", "/applications"); }
  catch (_) { list.innerHTML = `<div class="empty">// could not load — is the server running?</div>`; return; }
  if (!apps.length) { list.innerHTML = `<div class="empty">// no applications yet</div>`; return; }
  list.innerHTML = apps.map(a => `
    <div class="item">
      <div class="meta">
        <b>${esc(a.name) || "—"}</b> &nbsp; <a href="mailto:${esc(a.email)}">${esc(a.email) || "—"}</a>
        <small>${new Date(a.created_at).toLocaleString()}</small>
        ${a.budget ? `<div class="pill">BUDGET: ${esc(a.budget)}</div>` : ""}
        ${a.source ? `<div class="pill">SRC: ${esc(a.source)}</div>` : ""}
        ${a.message ? `<small style="margin-top:.5rem;">${esc(a.message)}</small>` : ""}
      </div>
      <button class="btn danger" data-del-app="${esc(a.id)}" type="button">DEL</button>
    </div>`).join("");

  $$("[data-del-app]", list).forEach(b => b.addEventListener("click", async () => {
    try { await api("DELETE", "/applications/" + encodeURIComponent(b.dataset.delApp)); renderApplications(); flash("Application deleted"); }
    catch (_) { flash("Delete failed"); }
  }));
}
document.addEventListener("click", async e => {
  if (e.target.id === "apps-refresh") { renderApplications(); flash("Refreshed"); }
  if (e.target.id === "apps-clear") {
    if (confirm("Delete ALL applications? This cannot be undone.")) {
      try { await api("DELETE", "/applications"); renderApplications(); flash("All applications cleared"); }
      catch (_) { flash("Clear failed"); }
    }
  }
});

/* ---------- 3. TEAM (founder + partners) ---------- */
function skillRow(name = "", level = 5) {
  const div = document.createElement("div");
  div.className = "skill-row";
  div.innerHTML =
    `<input class="s-name" placeholder="e.g. Frontend" value="${esc(name)}" />` +
    `<input class="s-lv" type="number" min="0" max="10" value="${+level || 0}" />` +
    `<button class="btn danger" type="button">✕</button>`;
  div.querySelector("button").addEventListener("click", () => div.remove());
  return div;
}

function buildPartnerForm() {
  const rows = $("#skill-rows");
  rows.innerHTML = "";
  [["Frontend", 8], ["Backend", 6], ["Design", 6]].forEach(([n, l]) => rows.appendChild(skillRow(n, l)));
  $("#add-skill").addEventListener("click", () => rows.appendChild(skillRow()));

  $("#partner-form").addEventListener("submit", async e => {
    e.preventDefault();
    const f = e.target.elements;
    const skills = $$(".skill-row", rows).map(r => ({
      name: r.querySelector(".s-name").value.trim(),
      level: Math.max(0, Math.min(10, +r.querySelector(".s-lv").value || 0)),
    })).filter(s => s.name);

    let photo = "";
    const file = f.photo.files[0];
    if (file) { try { photo = await uploadImage(file, 600); } catch (err) { flash("Image error: " + err.message); return; } }

    try {
      await api("POST", "/team", {
        name: f.name.value.trim(), role: f.role.value.trim() || "Partner",
        location: f.location.value.trim() || "—", status: f.status.value,
        bio: f.bio.value.trim(), skills, photo,
      });
      e.target.reset(); buildPartnerForm(); renderTeamList();
      flash("Partner added — reload the site to see them");
    } catch (err) { flash("Could not add partner: " + err.message); }
  }, { once: false });
}

// server member -> flat EN view for the admin UI
const flat = m => ({
  id: m.id, code: m.code, isBuiltin: m.isBuiltin,
  name: m.name.en, role: m.role.en, location: m.location.en, status: m.status,
  bio: m.bio.en, skills: (m.skills || []).map(s => ({ name: s.label_en, level: s.level })), photo: m.photo,
});

async function renderTeamList() {
  const list = $("#partners-list");
  let ppl;
  try { ppl = (await api("GET", "/team")).map(flat); }
  catch (_) { list.innerHTML = `<div class="empty">// could not load team — is the server running?</div>`; return; }

  list.innerHTML = ppl.map(p => `
    <div class="item">
      ${p.photo ? `<img class="thumb" src="${esc(p.photo)}" alt="" />` : ""}
      <div class="meta" style="flex:1;">
        <b>${esc(p.name)}</b> — ${esc(p.role)} · ${esc(p.location)}
        <span class="pill">${p.isBuiltin ? "BUILT-IN" : "ADDED"} · ${esc(p.code)}</span>
        ${p.bio ? `<small>${esc(p.bio)}</small>` : ""}
        <div>${p.skills.map(s => `<span class="pill">${esc(s.name)} ${s.level}/10</span>`).join("")}</div>
        <div style="margin-top:.55rem; display:flex; align-items:center; gap:.5rem;"><span class="muted">Status:</span> ${statusSelect(p.status, "status-quick")}</div>
      </div>
      <div style="display:flex; flex-direction:column; gap:.4rem;">
        <button class="btn ghost edit-btn" type="button">EDIT</button>
        ${p.isBuiltin ? "" : `<button class="btn danger del-btn" type="button">DEL</button>`}
      </div>
    </div>
    <div class="card editor" hidden style="margin-top:-.4rem;"></div>`).join("");

  const items = $$(".item", list);
  ppl.forEach((p, i) => {
    const item = items[i];
    const editor = item.nextElementSibling;
    item.querySelector(".status-quick").addEventListener("change", async e => {
      try { await api("PATCH", "/team/" + encodeURIComponent(p.id) + "/status", { status: e.target.value }); flash("Status updated — reload the site"); }
      catch (_) { flash("Status update failed"); }
    });
    item.querySelector(".edit-btn").addEventListener("click", () => {
      if (!editor.hidden) { editor.hidden = true; editor.innerHTML = ""; return; }
      openEditor(editor, p);
    });
    const del = item.querySelector(".del-btn");
    if (del) del.addEventListener("click", async () => {
      if (!confirm(`Delete ${p.name}?`)) return;
      try { await api("DELETE", "/team/" + encodeURIComponent(p.id)); renderTeamList(); flash("Partner removed — reload the site"); }
      catch (_) { flash("Delete failed"); }
    });
  });
}

function openEditor(editor, p) {
  editor.hidden = false;
  editor.innerHTML = `
    <h3>Edit ${esc(p.name)}</h3>
    <div class="row2">
      <label class="field"><span>Name</span><input class="e-name" value="${esc(p.name)}" /></label>
      <label class="field"><span>Role</span><input class="e-role" value="${esc(p.role)}" /></label>
    </div>
    <div class="row2">
      <label class="field"><span>Location</span><input class="e-location" value="${esc(p.location)}" /></label>
      <label class="field"><span>Status</span>${statusSelect(p.status, "e-status")}</label>
    </div>
    <label class="field"><span>Bio</span><textarea class="e-bio">${esc(p.bio || "")}</textarea></label>
    <span style="display:block; color:var(--dim); font-size:.68rem; text-transform:uppercase; letter-spacing:.06em; margin:.2rem 0 .5rem;">Skills</span>
    <div class="e-skills"></div>
    <button class="btn ghost e-addskill" type="button">+ ADD SKILL</button>
    <label class="field" style="margin-top:.8rem;"><span>Replace photo (optional)</span><input class="e-photo" type="file" accept="image/*" /></label>
    <div class="actions">
      <button class="btn e-save" type="button">SAVE</button>
      <button class="btn ghost e-cancel" type="button">CANCEL</button>
    </div>
    <p class="muted" style="margin-top:.6rem;">${p.isBuiltin ? "Editing a built-in member's text sets it for both languages." : ""}</p>`;

  const sk = editor.querySelector(".e-skills");
  (p.skills.length ? p.skills : [{ name: "", level: 5 }]).forEach(s => sk.appendChild(skillRow(s.name, s.level)));
  editor.querySelector(".e-addskill").addEventListener("click", () => sk.appendChild(skillRow()));
  editor.querySelector(".e-cancel").addEventListener("click", () => { editor.hidden = true; editor.innerHTML = ""; });

  editor.querySelector(".e-save").addEventListener("click", async () => {
    const g = s => editor.querySelector(s);
    const skills = $$(".skill-row", sk).map(r => ({
      name: r.querySelector(".s-name").value.trim(),
      level: Math.max(0, Math.min(10, +r.querySelector(".s-lv").value || 0)),
    })).filter(s => s.name);
    const payload = {
      name: g(".e-name").value.trim(), role: g(".e-role").value.trim(),
      location: g(".e-location").value.trim(), status: g(".e-status").value,
      bio: g(".e-bio").value.trim(), skills,
    };
    const file = g(".e-photo").files[0];
    if (file) { try { payload.photo = await uploadImage(file, 600); } catch (err) { flash("Image error: " + err.message); return; } }
    try { await api("PUT", "/team/" + encodeURIComponent(p.id), payload); renderTeamList(); flash("Saved — reload the site to see it"); }
    catch (err) { flash("Save failed: " + err.message); }
  });
}

/* ---------- 4. PROJECTS ---------- */
async function buildProjectsEditor() {
  const wrap = $("#projects-editor");
  let projects;
  try { projects = await api("GET", "/projects"); }
  catch (_) { wrap.innerHTML = `<div class="empty">// could not load projects — is the server running?</div>`; return; }
  wrap.innerHTML = "";

  projects.forEach(p => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <h3>Project ${p.id + 1}</h3>
      <div class="row2">
        <label class="field"><span>Title</span><input data-k="title" value="${esc(p.title)}" /></label>
        <label class="field"><span>Case label</span><input data-k="caseLabel" value="${esc(p.caseLabel)}" /></label>
      </div>
      <div class="row2">
        <label class="field"><span>Status (e.g. ■ DESIGN / ● LIVE / ■ IN DEV)</span><input data-k="status" value="${esc(p.status)}" /></label>
        <label class="field"><span>External link (optional)</span><input data-k="link" value="${esc(p.link)}" placeholder="https://…" /></label>
      </div>
      <label class="field"><span>Tags (comma separated)</span><input data-k="tags" value="${esc(p.tags)}" /></label>
      <label class="field"><span>Description (English)</span><textarea data-k="descEn">${esc(p.desc.en)}</textarea></label>
      <label class="field"><span>Description (Ukrainian)</span><textarea data-k="descUk">${esc(p.desc.uk)}</textarea></label>
      <label class="field"><span>Replace image (optional — keeps current if empty)</span><input data-k="imageFile" type="file" accept="image/*" /></label>
      <div class="muted" style="margin:-.4rem 0 .6rem;">Current image: ${esc(p.image)}</div>
      <div class="actions"><button class="btn" data-save type="button">SAVE</button></div>`;

    card.querySelector("[data-save]").addEventListener("click", async () => {
      const payload = {};
      $$("[data-k]", card).forEach(el => { if (el.dataset.k !== "imageFile") payload[el.dataset.k] = el.value.trim(); });
      const file = card.querySelector('[data-k="imageFile"]').files[0];
      if (file) { try { payload.image = await uploadImage(file, 1200); } catch (err) { flash("Image error: " + err.message); return; } }
      try { await api("PUT", "/projects/" + p.id, payload); buildProjectsEditor(); flash("Project saved — reload the site to see it"); }
      catch (err) { flash("Save failed: " + err.message); }
    });

    wrap.appendChild(card);
  });
}
