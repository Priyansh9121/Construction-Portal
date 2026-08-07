/**
 * File purpose:
 * A dashboard statistic card with an animated count-up value.
 *
 * Props:
 * - label, value, icon and styling variant
 *
 * State and hooks:
 * - Local animation frame state for the count-up
 *
 * Rendered by:
 * - DashboardPage.jsx
 *
 * Important notes:
 * - Presentational. Takes an already-computed figure and does not fetch.
 * - The animation is decorative — the final value is always the prop, so a
 * - re-render mid-animation lands on the correct number.
 */

import {
    motion,
    useMotionValue,
    useTransform,
    animate,
  } from "framer-motion";
  import { useEffect } from "react";
  import { formatCurrency } from "../utils/currency";
  
  function AnimatedStatCard({
    title,
    value,
    prefix = "",
    suffix = "",
    currency = false,
  }) {
    const numericValue =
      Number(String(value).replace(/[^0-9.-]/g, "")) || 0;
  
    const count = useMotionValue(0);
  
    const displayedValue = useTransform(count, (latest) => {
      if (currency) {
        return formatCurrency(latest, {
          minimumFractionDigits: 0,
          maximumFractionDigits: 0,
        });
      }
  
      return `${prefix}${Math.round(latest).toLocaleString(
        "en-IN"
      )}${suffix}`;
    });
  
    useEffect(() => {
      const controls = animate(count, numericValue, {
        duration: 0.9,
        ease: "easeOut",
      });
  
      return () => controls.stop();
    }, [count, numericValue]);
  
    /*
     * V2-I030. The hover lift (`y: -8, scale: 1.02`) and tap scale are gone.
     *
     * A control that moves under the cursor is a mis-click risk in a dense
     * grid, and AUD-011 removed hover lifts from every other control in the
     * product. This one survived because it was a Framer Motion prop rather
     * than CSS, so the stylesheet sweep never saw it. Hover feedback is now
     * the border change in styles/v2/pages/dashboard.css — visible, instant,
     * and it moves nothing.
     *
     * The count-up is kept: it fires once on mount, is bounded, and it draws
     * the eye to a figure that has just changed. That is motion carrying
     * meaning rather than decorating.
     */
    return (
      <div className="card animated-stat-card">
        <p>{title}</p>
        <motion.h2>{displayedValue}</motion.h2>
      </div>
    );
  }
  
  export default AnimatedStatCard;