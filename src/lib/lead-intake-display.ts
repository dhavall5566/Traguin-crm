export type LeadIntakeDetails = {
  formType?: string;
  formSubmissionId?: string;
  memberCode?: string;
  inquiryCode?: string;
  itineraryTitle?: string;
  itinerarySlug?: string;
  relatedItineraryId?: string;
  destination?: string;
  startDate?: string;
  endDate?: string;
  rooms?: string;
  adults?: string;
  children?: string;
  childAges?: string;
  travelingWithPets?: string;
  budget?: string;
  email?: string;
  phone?: string;
  name?: string;
  notes?: string;
  extras: Array<{ label: string; value: string }>;
};

function parseBulletLine(line: string): { label: string; value: string } | null {
  const match = line.match(/^\s*•\s*([^:]+):\s*(.+)$/);
  if (!match) return null;
  return { label: match[1].trim(), value: match[2].trim() };
}

export function parseLeadIntakeNote(content: string): LeadIntakeDetails | null {
  if (!content.includes("Website form submission")) return null;

  const result: LeadIntakeDetails = { extras: [] };
  const lines = content.split("\n");

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;

    if (line.startsWith("Website form submission (")) {
      result.formType = line.replace("Website form submission (", "").replace(")", "");
      continue;
    }
    if (line.startsWith("Form submission ID:")) {
      result.formSubmissionId = line.replace("Form submission ID:", "").trim();
      continue;
    }
    if (line.startsWith("Name:")) {
      result.name = line.replace("Name:", "").trim();
      continue;
    }
    if (line.startsWith("Email:")) {
      result.email = line.replace("Email:", "").trim();
      continue;
    }
    if (line.startsWith("Phone:")) {
      result.phone = line.replace("Phone:", "").trim();
      continue;
    }
    if (line.startsWith("Related itinerary ID:")) {
      result.relatedItineraryId = line.replace("Related itinerary ID:", "").trim();
      continue;
    }

    const bullet = parseBulletLine(line);
    if (!bullet) continue;

    const key = bullet.label.toLowerCase();
    switch (key) {
      case "member code":
        result.memberCode = bullet.value;
        break;
      case "inquiry code":
        result.inquiryCode = bullet.value;
        break;
      case "itinerary":
        result.itineraryTitle = bullet.value;
        break;
      case "itinerary slug":
        result.itinerarySlug = bullet.value;
        break;
      case "destination":
        result.destination = bullet.value;
        break;
      case "start date":
        result.startDate = bullet.value;
        break;
      case "end date":
        result.endDate = bullet.value;
        break;
      case "rooms":
        result.rooms = bullet.value;
        break;
      case "adults":
        result.adults = bullet.value;
        break;
      case "children":
        result.children = bullet.value;
        break;
      case "children ages":
        result.childAges = bullet.value;
        break;
      case "traveling with pets":
        result.travelingWithPets = bullet.value;
        break;
      case "budget (inr)":
        result.budget = bullet.value;
        break;
      case "notes":
        result.notes = bullet.value;
        break;
      default:
        result.extras.push(bullet);
    }
  }

  return result;
}

export function findLeadIntakeNote(
  notes: Array<{ content: string }>
): LeadIntakeDetails | null {
  for (const note of notes) {
    const parsed = parseLeadIntakeNote(note.content);
    if (parsed) return parsed;
  }
  return null;
}
