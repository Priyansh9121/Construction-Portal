import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect } from "react";

function AnimatedStatCard({ title, value, prefix = "", suffix = "" }) {
  const numericValue = Number(String(value).replace(/[^0-9.-]/g, "")) || 0;
  const count = useMotionValue(0);
  const rounded = useTransform(count, (latest) =>
    `${prefix}${Math.round(latest).toLocaleString()}${suffix}`
  );

  useEffect(() => {
    const controls = animate(count, numericValue, {
      duration: 0.9,
      ease: "easeOut",
    });

    return controls.stop;
  }, [numericValue]);

  return (
    <motion.div
      className="card animated-stat-card"
      whileHover={{ y: -8, scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
    >
      <p>{title}</p>
      <motion.h2>{rounded}</motion.h2>
    </motion.div>
  );
}

export default AnimatedStatCard;