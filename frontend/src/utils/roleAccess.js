export function normaliseRole(value) {
    return String(value || "")
      .trim()
      .toLowerCase();
  }
  
  export function canLoadAdminData(user) {
    const role = normaliseRole(user?.role);
  
    return role === "admin" || role === "manager";
  }