import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.4/+esm";

const btn = document.querySelector("#discord");
const label = document.querySelector("#account");
let user;

try {
  const res = await fetch("./clips-config.json");
  if (!res.ok) throw new Error();
  const conf = await res.json();
  const auth = createClient(conf.host, conf.key, {
    auth: { flowType: "pkce" }
  }).auth;

  const { error } = await auth.initialize();
  auth.onAuthStateChange((_event, sess) => {
    user = sess?.user;
    btn.textContent = user ? "Sign out" : "Sign in with Discord";
    const meta = user?.user_metadata;
    const name = (meta?.user_name || meta?.preferred_username || meta?.name || "Discord user").replace(/#0$/, "");
    label.textContent = user ? "Signed in as " + name : "";
    label.hidden = !user;
    btn.disabled = false;
  });
  if (error) {
    label.textContent = "Discord sign-in could not finish. Try again.";
    label.hidden = false;
  }

  btn.addEventListener("click", async () => {
    btn.disabled = true;
    const res = user
      ? await auth.signOut({ scope: "local" })
      : await auth.signInWithOAuth({
          provider: "discord",
          options: { redirectTo: new URL("./", location.href).href }
        });
    if (res.error) {
      label.textContent = "Discord sign-in is unavailable. Try again.";
      label.hidden = false;
      btn.disabled = false;
    }
  });
} catch {
  label.textContent = "Discord sign-in is unavailable.";
  label.hidden = false;
}
