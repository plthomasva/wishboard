export interface Conflict {
  message: string;
  target_attribute: string;
}

export function parseAttributesString(val: string): string[] {
  return val
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export async function fetchConflicts(attributes: {
  gender: string[];
  orientation: string[];
  role: string[];
}): Promise<Conflict[]> {
  try {
    const response = await fetch('/api/rules/check-conflicts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ attributes }),
    });
    if (response.ok) {
      const data = await response.json();
      return data.conflicts ?? [];
    }
  } catch {
    // Non-fatal, fallback to empty array
  }
  return [];
}

export function getConflictWarning(conflicts: Conflict[], attribute: string): string | undefined {
  const filtered = conflicts.filter((c) => c.target_attribute === attribute);
  return filtered.length > 0 ? filtered.map((c) => c.message).join(' ') : undefined;
}
