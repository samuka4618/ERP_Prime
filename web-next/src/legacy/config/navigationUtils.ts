import type { NavItem, NavSection } from './navigation';

export type PermissionHelpers = {
  hasPermission: (code: string) => boolean;
  hasAnyPermission: (...codes: string[]) => boolean;
};

function itemAllowedByPermission(item: NavItem, isAdmin: boolean, perms: PermissionHelpers): boolean {
  if (item.adminOnly && !isAdmin) return false;
  if (item.permissionAny?.length) {
    return perms.hasAnyPermission(...item.permissionAny);
  }
  if (item.permissionAll?.length) {
    return item.permissionAll.every((c) => perms.hasPermission(c));
  }
  return true;
}

/** Filtra itens por permissões; mantém secções admin só para administradores. */
export function filterNavByPermissions(
  sections: NavSection[],
  isAdmin: boolean,
  perms: PermissionHelpers
): NavSection[] {
  const filterItems = (items: NavItem[]): NavItem[] => {
    const out: NavItem[] = [];
    for (const it of items) {
      if (it.items?.length) {
        const children = filterItems(it.items);
        if (children.length > 0) out.push({ ...it, items: children });
        continue;
      }
      if (!it.href) continue;
      if (!itemAllowedByPermission(it, isAdmin, perms)) continue;
      out.push(it);
    }
    return out;
  };

  return sections
    .filter((sec) => !sec.adminOnly || isAdmin)
    .map((sec) => ({
      ...sec,
      items: sec.adminOnly ? sec.items : filterItems(sec.items),
    }))
    .filter((sec) => sec.items.length > 0);
}

/** Remove itens cujo `id` está em hiddenIds (árvore). */
export function applyHiddenNavIds(sections: NavSection[], hiddenIds: Set<string>): NavSection[] {
  const filterItems = (items: NavItem[]): NavItem[] => {
    const out: NavItem[] = [];
    for (const it of items) {
      if (it.items?.length) {
        const children = filterItems(it.items);
        if (children.length > 0) out.push({ ...it, items: children });
        continue;
      }
      if (it.href && !hiddenIds.has(it.id)) out.push(it);
    }
    return out;
  };

  return sections.map((sec) => ({
    ...sec,
    items: filterItems(sec.items),
  })).filter((sec) => sec.items.length > 0);
}

/** Ordena secções de topo conforme `sectionOrder` (ids desconhecidos ficam no fim). */
export function orderNavSections(sections: NavSection[], sectionOrder: string[]): NavSection[] {
  if (!sectionOrder.length) return sections;
  const rank = (id: string) => {
    const i = sectionOrder.indexOf(id);
    return i === -1 ? 1000 + sections.findIndex((s) => s.id === id) : i;
  };
  return [...sections].sort((a, b) => rank(a.id) - rank(b.id));
}

export type FlatNavEntry = { id: string; name: string; sectionId: string; depth: number };

export function buildNavIndex(
  sections: NavSection[]
): Map<string, { item: NavItem; sectionId: string }> {
  const map = new Map<string, { item: NavItem; sectionId: string }>();

  const walk = (items: NavItem[], sectionId: string) => {
    for (const it of items) {
      if (it.items?.length) walk(it.items, sectionId);
      else if (it.href) map.set(it.id, { item: it, sectionId });
    }
  };

  for (const sec of sections) {
    walk(sec.items, sec.id);
  }
  return map;
}

export function flattenNavForSettings(sections: NavSection[]): FlatNavEntry[] {
  const out: FlatNavEntry[] = [];

  const walk = (items: NavItem[], sectionId: string, depth: number) => {
    for (const it of items) {
      if (it.items?.length) {
        walk(it.items, sectionId, depth + 1);
      } else if (it.href) {
        out.push({ id: it.id, name: it.name, sectionId, depth });
      }
    }
  };

  for (const sec of sections) {
    walk(sec.items, sec.id, 0);
  }
  return out;
}
