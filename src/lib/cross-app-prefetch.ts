const prefetched = new Set<string>();

function originOf(url: string): string {
  try {
    return new URL(url).origin;
  } catch {
    return url;
  }
}

/** Warm DNS/TCP/TLS for another Traguin app (CMS ↔ CRM). Safe to call repeatedly. */
export function prefetchCrossApp(url: string): void {
  if (typeof document === "undefined" || !url || prefetched.has(url)) return;
  prefetched.add(url);

  const origin = originOf(url);

  if (!document.querySelector(`link[data-cross-app-origin="${origin}"]`)) {
    const preconnect = document.createElement("link");
    preconnect.rel = "preconnect";
    preconnect.href = origin;
    preconnect.setAttribute("data-cross-app-origin", origin);
    document.head.appendChild(preconnect);
  }

  if (!document.querySelector(`link[data-cross-app-prefetch="${url}"]`)) {
    const prefetch = document.createElement("link");
    prefetch.rel = "prefetch";
    prefetch.href = url;
    prefetch.setAttribute("data-cross-app-prefetch", url);
    document.head.appendChild(prefetch);
  }
}
