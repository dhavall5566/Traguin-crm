import { createAgencyRole, listAgencyRoles } from "@/lib/api/rbac";
import {
  permissionsAllDenied,
  RBAC_DEFINITIONS_STORAGE_KEY,
  type RoleDefinition,
} from "@/lib/rbac";
import { useStore } from "@/lib/store";

function persistRoleDefinitions(roleDefinitions: RoleDefinition[]) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(RBAC_DEFINITIONS_STORAGE_KEY, JSON.stringify(roleDefinitions));
  } catch {
    /* quota / blocked */
  }
}

/** Merge API roles into local definitions and push local-only roles to the API. */
export async function syncAgencyRoleCatalog(agencyId: string): Promise<RoleDefinition[]> {
  if (!agencyId) {
    return useStore.getState().roleDefinitions.filter((r) => r.agencyId === agencyId);
  }

  const apiRoles = await listAgencyRoles();
  const stateBefore = useStore.getState();
  let roleDefinitions = [...stateBefore.roleDefinitions];

  for (const apiRole of apiRoles) {
    const exists = roleDefinitions.some(
      (r) =>
        r.agencyId === agencyId &&
        r.name.localeCompare(apiRole.name, undefined, { sensitivity: "accent" }) === 0,
    );
    if (!exists) {
      roleDefinitions.push({
        id: `role-api-${apiRole.id}`,
        agencyId,
        name: apiRole.name,
        isSystem: false,
        permissions: permissionsAllDenied(),
      });
    }
  }

  const localForAgency = roleDefinitions.filter((r) => r.agencyId === agencyId);
  await Promise.all(
    localForAgency.map(async (local) => {
      const onApi = apiRoles.some(
        (a) =>
          a.name.localeCompare(local.name, undefined, { sensitivity: "accent" }) === 0,
      );
      if (!onApi) {
        try {
          await createAgencyRole(local.name);
        } catch {
          /* duplicate or permission — ignore */
        }
      }
    }),
  );

  persistRoleDefinitions(roleDefinitions);
  useStore.setState({ roleDefinitions });

  return roleDefinitions.filter((r) => r.agencyId === agencyId);
}

export function sortAgencyRoleDefinitions(roles: RoleDefinition[]): RoleDefinition[] {
  return [...roles].sort((a, b) => {
    if (a.isSystem !== b.isSystem) return a.isSystem ? -1 : 1;
    return a.name.localeCompare(b.name);
  });
}

/** When a role was synced from the API, extract its database id for fast assignment. */
export function apiRoleIdFromDefinition(role: RoleDefinition): string | undefined {
  const prefix = 'role-api-';
  if (!role.id.startsWith(prefix)) return undefined;
  return role.id.slice(prefix.length);
}
