/**
 * Validates that an ID is strictly alphanumeric and hyphens.
 * This satisfies SonarQube tainted value checks for URL parameters.
 */
export const isValidId = (id: string): boolean => {
  return /^[a-zA-Z0-9-]+$/.test(id);
};

/**
 * Validates that a secret is strictly alphanumeric, hyphens, and underscores.
 * This satisfies SonarQube tainted value checks for dynamically constructed headers.
 */
export const isValidSecret = (secret: string): boolean => {
  return /^[a-zA-Z0-9_-]+$/.test(secret);
};
