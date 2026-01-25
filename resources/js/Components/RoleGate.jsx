import useRoles from "@/Hooks/useRoles";

/**
 * RoleGate
 *
 * @param allow   array of roles that CAN see the content
 * @param deny    array of roles that CANNOT see the content
 * @param children
 */
export default function RoleGate({
  allow = [],
  deny = [],
  children,
}) {
  const { role } = useRoles();

  // ❌ Explicit deny wins
  if (deny.includes(role)) {
    return null;
  }

  // ✅ Allow list (if provided)
  if (allow.length > 0 && !allow.includes(role)) {
    return null;
  }

  return <>{children}</>;
}
