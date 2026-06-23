"use client";

import { useEffect } from "react";
import { getCmsAppUrl } from "@/lib/admin-links";
import { prefetchCrossApp } from "@/lib/cross-app-prefetch";

export function CrmProductSwitcher() {
  const cmsUrl = getCmsAppUrl();

  useEffect(() => {
    prefetchCrossApp(cmsUrl);
  }, [cmsUrl]);

  return (
    <div className="crm-product-switcher" role="tablist" aria-label="Product area">
      <a
        href={cmsUrl}
        className="crm-product-tab crm-product-tab--link"
        role="tab"
        aria-selected="false"
        onMouseEnter={() => prefetchCrossApp(cmsUrl)}
        onFocus={() => prefetchCrossApp(cmsUrl)}
      >
        CMS
      </a>
      <span className="crm-product-tab crm-product-tab--active" role="tab" aria-selected="true">
        CRM
      </span>
    </div>
  );
}
