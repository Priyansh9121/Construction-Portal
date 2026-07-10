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
  
    return (
      <motion.div
        className="card animated-stat-card"
        whileHover={{
          y: -8,
          scale: 1.02,
        }}
        whileTap={{
          scale: 0.98,
        }}
      >
        <p>{title}</p>
        <motion.h2>{displayedValue}</motion.h2>
      </motion.div>
    );
  }
  
  export default AnimatedStatCard;