"use strict";

const form = document.getElementById("form");
const file = document.getElementById("file");
const msg = document.getElementById("message");
const send = document.getElementById("send");
const grid = document.getElementById("clips");
const status = document.getElementById("status");
const refresh = document.getElementById("refresh");
const preview = document.getElementById("preview");
let conf;
let url;
let cache;

file.addEventListener("change", () => {
  if (url) URL.revokeObjectURL(url);
  const clip = file.files[0];
  preview.hidden = !clip;
  preview.removeAttribute("src");
  if (clip) {
    url = URL.createObjectURL(clip);
    preview.src = url;
  }
});

refresh.addEventListener("click", async () => {
  refresh.disabled = true;
  status.textContent = "Loading clips...";
  try {
    if (!conf) {
      const res = await fetch("clips-config.json", { cache: "no-cache" });
      if (!res.ok) throw new Error("Clips are temporarily unavailable.");
      conf = await res.json();
    }
    const res = await fetch(conf.host + "/rest/v1/rpc/read_clips", {
      method: "POST",
      headers: { apikey: conf.key, "Content-Type": "application/json" },
      body: "{}"
    });
    if (!res.ok) throw new Error("Could not load clips. Try Refresh again.");
    const rows = await res.json();
    if (!Array.isArray(rows)) throw new Error("Could not load clips.");
    grid.replaceChildren();
    for (const row of rows) {
      if (!/^[a-f0-9-]{36}\.mp4$/.test(row.path)) continue;
      const card = document.createElement("article");
      const video = document.createElement("video");
      video.controls = true;
      video.playsInline = true;
      video.preload = "none";
      video.src = conf.host + "/storage/v1/object/public/night-clips/" + encodeURIComponent(row.path);
      video.setAttribute("aria-label", row.title);
      const title = document.createElement("h3");
      title.textContent = row.title;
      const name = document.createElement("p");
      name.textContent = row.nick + " · " + new Date(row.made).toLocaleDateString();
      card.append(title, video, name);
      grid.append(card);
    }
    status.textContent = rows.length ? rows.length + " / 20 clips" : "No clips yet. Be the first to share a night.";
  } catch (err) {
    status.textContent = err.message;
  } finally {
    refresh.disabled = false;
  }
});

form.addEventListener("submit", async (ev) => {
  ev.preventDefault();
  const clip = file.files[0];
  if (!clip || !clip.name.toLowerCase().endsWith(".mp4") || clip.size === 0 || clip.size > 41943040) {
    msg.textContent = "Choose an MP4 between 1 byte and 40 MB.";
    return;
  }
  if (!conf) {
    msg.textContent = "Clips are offline. Try Refresh before uploading.";
    return;
  }
  const nick = document.getElementById("nick").value.trim();
  const title = document.getElementById("title").value.trim();
  if (!nick || !title || !document.getElementById("public").checked) {
    msg.textContent = "Enter your name and title, and confirm you want to publish.";
    return;
  }
  send.disabled = true;
  file.disabled = true;
  msg.textContent = "Preparing your upload...";
  try {
    const head = { apikey: conf.key, "Content-Type": "application/json" };
    const tag = [clip.name, clip.size, clip.lastModified, nick, title].join("|");
    if (!cache) {
      try { cache = JSON.parse(localStorage.getItem("night-clip")); } catch {}
    }
    if (!cache || cache.tag !== tag) {
      const res = await fetch(conf.host + "/rest/v1/rpc/claim_clip", {
        method: "POST", headers: head, body: JSON.stringify({ nick, title, bytes: clip.size })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Could not start the upload.");
      if (!/^[a-f0-9-]{36}\.mp4$/.test(data.path)) throw new Error("Could not reserve the upload.");
      cache = { tag, path: data.path };
      try { localStorage.setItem("night-clip", JSON.stringify(cache)); } catch {}
    }
    msg.textContent = "Uploading your night. Keep this page open...";
    const res = await fetch(conf.host + "/storage/v1/object/night-clips/" + encodeURIComponent(cache.path), {
      method: "POST", headers: { apikey: conf.key, "Content-Type": "video/mp4", "x-upsert": "false" }, body: clip
    });
    if (!res.ok) {
      const data = await res.json();
      if (res.status !== 409 && data.statusCode !== "409") {
        throw new Error("Upload failed. Your video is still on your PC. Press Upload clip to retry.");
      }
    }
    cache = null;
    try { localStorage.removeItem("night-clip"); } catch {}
    form.reset();
    preview.pause();
    preview.hidden = true;
    preview.removeAttribute("src");
    if (url) URL.revokeObjectURL(url);
    msg.textContent = "Published. Your clip is in the gallery above.";
    refresh.click();
  } catch (err) {
    msg.textContent = err.message || "Could not upload. Your recording is still on your PC.";
  } finally {
    send.disabled = false;
    file.disabled = false;
  }
});

refresh.click();
