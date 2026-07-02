export const countPersonalSites = (
    sites = []
  ) =>
    sites.filter(
      (site) =>
        site.site_type === "Personal Site"
    ).length;
  
  export const countSubcontractorSites = (
    sites = []
  ) =>
    sites.filter(
      (site) =>
        site.site_type ===
        "Subcontractor Site"
    ).length;