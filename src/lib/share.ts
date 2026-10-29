// Client-side share helpers.
export function whatsappUrl(text: string): string {
  return `https://wa.me/?text=${encodeURIComponent(text)}`;
}

export function shareText(pidgin: string, appUrl: string): string {
  return `${pidgin.trim()}\n\nCheck your own bill: ${appUrl}`;
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older Android WebViews.
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.setAttribute("readonly", "");
    ta.style.position = "fixed";
    ta.style.opacity = "0";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try {
      ok = document.execCommand("copy");
    } catch {
      ok = false;
    }
    document.body.removeChild(ta);
    return ok;
  }
}

export function downloadText(filename: string, text: string): void {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/** Fills letter placeholders with details that never left the phone. */
export function personalise(letter: string, p: { name?: string | null; address?: string | null }): string {
  let out = letter;
  if (p.name) out = out.replaceAll("[Your Name]", p.name);
  if (p.address) out = out.replaceAll("[Your Address]", p.address);
  return out;
}
