/**
 * Derive voter group from user ID.
 * 081bct049–081bct072 = Group C
 * 081bct073–081bct096 = Group D
 * admin@123 = admin
 */
export function getUserGroup(userId) {
  if (!userId) return null;
  if (userId === "admin@123") return "admin";
  const match = userId.match(/(\d+)$/);
  if (!match) return null;
  const num = parseInt(match[1], 10);
  if (num >= 49 && num <= 72) return "C";
  if (num >= 73 && num <= 96) return "D";
  return null;
}
