import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm";

const btn = document.querySelector("#discord");
const label = document.querySelector("#account");
const signin = document.querySelector("#signin");
const list = document.querySelector("#loglist");
const edit = document.querySelector("#editlogs");
const form = document.querySelector("#logform");
const body = document.querySelector("#logbody");
const msg = document.querySelector("#logmsg");

export let api;
export let user;
export let owner = false;
export let conf;

try {
  const res = await fetch("./clips-config.json");
  if (!res.ok) throw new Error();
  conf = await res.json();
  api = createClient(conf.host, conf.key, { auth: { flowType: "pkce" } });
  const { error } = await api.auth.initialize();
  api.auth.onAuthStateChange((_ev, sess) => {
    if (_ev !== "INITIAL_SESSION" && user?.id === sess?.user?.id) {
      btn.disabled = false;
      return;
    }
    user = sess?.user;
    owner = false;
    signin.textContent = user ? "Sign out" : "Sign in";
    const meta = user?.user_metadata;
    const name = (meta?.user_name || meta?.preferred_username || meta?.name || "Discord user").replace(/#0$/, "");
    label.textContent = user ? "Signed in as " + name : "";
    label.hidden = !user;
    btn.disabled = false;
    if (edit) {
      edit.hidden = true;
      form.hidden = true;
    }
    document.dispatchEvent(new Event("site-auth"));
    if (!user) return;
    const id = user.id;
    setTimeout(async () => {
      const { data } = await api.rpc("site_owner");
      if (user?.id !== id) return;
      owner = data === true;
      if (edit) edit.hidden = !owner;
      document.dispatchEvent(new Event("site-auth"));
    }, 0);
  });
  if (error) {
    label.textContent = "Discord sign-in could not finish. Try again.";
    label.hidden = false;
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const res = user
      ? await api.auth.signOut({ scope: "local" })
      : await api.auth.signInWithOAuth({
          provider: "discord",
          options: { redirectTo: new URL(location.pathname, location.origin).href }
        });
    if (res.error) {
      label.textContent = "Discord sign-in is unavailable. Try again.";
      label.hidden = false;
      btn.disabled = false;
    }
  });

  if (list) {
    let txt = [...list.querySelectorAll("h3")].map(h => {
      const node = h.nextElementSibling;
      const note = node?.tagName === "UL"
        ? [...node.children].map(li => "• " + li.textContent).join("\n")
        : node?.textContent || "";
      return h.textContent + "\n" + note;
    }).join("\n\n");
    const { data } = await api.rpc("read_updates");
    if (typeof data === "string" && data) {
      txt = data;
      list.replaceChildren();
      for (const entry of txt.split(/\n\s*\n/)) {
        const [title, ...notes] = entry.split("\n");
        const h = document.createElement("h3");
        const p = document.createElement("p");
        h.textContent = title;
        p.textContent = notes.join("\n");
        p.style.whiteSpace = "pre-line";
        list.append(h, p);
      }
    }
    edit.onclick = () => {
      body.value = txt;
      form.hidden = false;
      body.focus();
    };
    document.querySelector("#cancellog").onclick = () => { form.hidden = true; };
    form.onsubmit = async ev => {
      ev.preventDefault();
      if (!owner) return;
      const btn = form.querySelector('[type="submit"]');
      btn.disabled = true;
      const { error } = await api.rpc("save_updates", { txt: body.value.trim() });
      if (!error) {
        location.reload();
        return;
      }
      msg.textContent = "Could not save the update log.";
      btn.disabled = false;
    };
  }
} catch {
  label.textContent = "Discord sign-in is unavailable.";
  label.hidden = false;
}
