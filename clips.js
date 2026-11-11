import { api, conf, user, owner } from "./login.js?v=3";

const form = document.getElementById("form");
const file = document.getElementById("file");
const msg = document.getElementById("message");
const send = document.getElementById("send");
const grid = document.getElementById("clips");
const status = document.getElementById("status");
const refresh = document.getElementById("refresh");
const preview = document.getElementById("preview");
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
    if (!api) throw new Error("Clips are temporarily unavailable.");
    const { data: rows, error } = await api.rpc("read_clips");
    if (error) throw new Error("Could not load clips. Try Refresh again.");
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
      if (owner) {
        const tools = document.createElement("div");
        tools.className = "cliptools";
        for (const [text, step] of [["Move up", -1], ["Move down", 1], ["Delete clip", 0]]) {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.textContent = text;
          btn.addEventListener("click", async () => {
            if (!owner || (!step && !confirm("Permanently delete this clip?"))) return;
            for (const ctl of grid.querySelectorAll("button")) ctl.disabled = true;
            try {
              if (step) {
                const { error } = await api.rpc("move_clip", { obj: row.path, step });
                if (error) throw error;
              } else {
                const lock = await api.rpc("lock_clip", { obj: row.path });
                if (lock.error) throw lock.error;
                const del = await api.storage.from("night-clips").remove([row.path]);
                if (del.error) throw del.error;
                const { error } = await api.rpc("remove_clip", { obj: row.path });
                if (error) throw error;
              }
              refresh.click();
            } catch {
              status.textContent = "Could not change this clip. Try again.";
            } finally {
              for (const ctl of grid.querySelectorAll("button")) ctl.disabled = false;
            }
          });
          tools.append(btn);
        }
        card.append(tools);
      }
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
  if (!user) {
    msg.textContent = "Sign in with Discord to publish your clip.";
    return;
  }
  let title = document.getElementById("title").value.trim();
  if (title && /^night-.*-AI\.mp4$/i.test(clip.name) && !/^\[AI\] /i.test(title)) {
    title = `[AI] ${title}`.slice(0, 80);
  }
  if (!title || !document.getElementById("public").checked) {
    msg.textContent = "Enter a title and confirm you want to publish.";
    return;
  }
  send.disabled = true;
  file.disabled = true;
  msg.textContent = "Preparing your upload...";
  try {

    const tag = [clip.name, clip.size, clip.lastModified, user.id, title].join("|");
    if (!cache) {
      try { cache = JSON.parse(localStorage.getItem("night-clip")); } catch {}
    }
    if (!cache || cache.tag !== tag) {
      const { data, error } = await api.rpc("claim_clip", { title, bytes: clip.size });
      if (error) throw new Error(error.message || "Could not start the upload.");
      if (!/^[a-f0-9-]{36}\.mp4$/.test(data.path)) throw new Error("Could not reserve the upload.");
      cache = { tag, path: data.path };
      try { localStorage.setItem("night-clip", JSON.stringify(cache)); } catch {}
    }
    msg.textContent = "Uploading your night. Keep this page open...";
    const { error } = await api.storage.from("night-clips").upload(cache.path, clip, {
      contentType: "video/mp4", upsert: false
    });
    if (error && String(error.statusCode) !== "409") {
      cache = null;
      try { localStorage.removeItem("night-clip"); } catch {}
      throw new Error("Upload failed. Your video is still on your device. Press Upload clip to retry.");
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
document.addEventListener("site-auth", () => {
  if (!owner) grid.querySelectorAll(".cliptools").forEach(node => node.remove());
  if (owner) refresh.click();
});
