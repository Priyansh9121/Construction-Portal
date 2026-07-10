import { formatCurrency } from "../utils/currency";

export const BRAND = {
    name: "Construction Portal",
    subtitle: "Professional Construction Management System",
    primary: [15, 23, 42],
    secondary: [37, 99, 235],
    success: [22, 163, 74],
    danger: [220, 38, 38],
    warning: [245, 158, 11],
    light: [248, 250, 252],
    border: [203, 213, 225],
    text: [15, 23, 42],
    muted: [100, 116, 139],
  };
  
  export const exportDate = () =>
    new Date().toLocaleString("en-AU", {
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });



  export const getCompanySettings = () => {
    try {
      return (
        JSON.parse(localStorage.getItem("companySettings")) || {
          company_name: "Construction Portal",
          abn_gst: "",
          address: "",
          phone: "",
          email: "",
        }
      );
    } catch {
      return {
        company_name: "Construction Portal",
        abn_gst: "",
        address: "",
        phone: "",
        email: "",
      };
    }
  };

  export const formatExportMoney = formatCurrency;