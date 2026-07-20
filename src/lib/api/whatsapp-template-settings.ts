import { crmFetchJson } from "@/lib/api/crm-client";

export type WhatsAppTemplateCatalogEntry = {
  id: string;
  subject: string;
  whatsapp_enabled: boolean;
  audience: string;
  whatsapp_text?: string;
  default_template_id?: string;
  default_template_name?: string;
};

export type AgencyWhatsAppTemplateSettings = {
  default_template_id: string;
  default_template_name: string;
  template_language: string;
  overrides: Record<string, string>;
  env_default_template_id: string;
  env_default_template_name: string;
  env_template_language: string;
  sender_display_phone?: string;
};

export type AgencyWhatsAppTemplateSettingsInput = {
  default_template_id?: string;
  default_template_name?: string;
  template_language?: string;
  overrides?: Record<string, string>;
};

export type WhatsAppTemplateTestInput = {
  catalog_id: string;
  to_phone?: string;
  template_override?: string;
};

export function fetchWhatsAppTemplateCatalog(): Promise<WhatsAppTemplateCatalogEntry[]> {
  return crmFetchJson<WhatsAppTemplateCatalogEntry[]>(
    "/api/crm/settings/whatsapp-templates/catalog",
  );
}

export function fetchAgencyWhatsAppTemplateSettings(): Promise<AgencyWhatsAppTemplateSettings> {
  return crmFetchJson<AgencyWhatsAppTemplateSettings>(
    "/api/crm/settings/whatsapp-templates",
  );
}

export function saveAgencyWhatsAppTemplateSettings(
  payload: AgencyWhatsAppTemplateSettingsInput,
): Promise<AgencyWhatsAppTemplateSettings> {
  return crmFetchJson<AgencyWhatsAppTemplateSettings>(
    "/api/crm/settings/whatsapp-templates",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
}

export function sendWhatsAppTemplateTest(
  payload: WhatsAppTemplateTestInput,
): Promise<{ message: string }> {
  return crmFetchJson<{ message: string }>("/api/crm/settings/whatsapp-templates/test", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
}
