import { useEffect, useState } from "react";

/**
 * CSS-only confetti animation. Shows 35 particles falling from top.
 * Auto-removes from DOM after 3 seconds.
 */
export function ConfettiEffect({ onComplete }: { onComplete?: () => void }) {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setVisible(false);
      onComplete?.();
    }, 3000);
    return () => clearTimeout(timer);
  }, [onComplete]);

  if (!visible) return null;

  const colors = [
    "hsl(var(--accent))",
    "#F59E0B",
    "#10B981",
    "#3B82F6",
    "#8B5CF6",
    "#EF4444",
    "#EC4899",
    "#F97316",
  ];

  const particles = Array.from({ length: 35 }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    delay: Math.random() * 0.8,
    duration: 2 + Math.random() * 1.5,
    size: 4 + Math.random() * 6,
    color: colors[i % colors.length],
    rotation: Math.random() * 360,
    xDrift: -30 + Math.random() * 60,
    isCircle: Math.random() > 0.5,
  }));

  return (
    <div className="fixed inset-0 z-[100] pointer-events-none overflow-hidden">
      <style>{`
        @keyframes confetti-fall {
          0% {
            transform: translateY(-20px) translateX(0) rotate(0deg);
            opacity: 1;
          }
          70% {
            opacity: 1;
          }
          100% {
            transform: translateY(100vh) translateX(var(--x-drift)) rotate(720deg);
            opacity: 0;
          }
        }
      `}</style>
      {particles.map((p) => (
        <div
          key={p.id}
          style={{
            position: "absolute",
            top: -10,
            left: `${p.left}%`,
            width: p.size,
            height: p.isCircle ? p.size : p.size * 1.5,
            backgroundColor: p.color,
            borderRadius: p.isCircle ? "50%" : "2px",
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
            ["--x-drift" as any]: `${p.xDrift}px`,
            transform: `rotate(${p.rotation}deg)`,
          }}
        />
      ))}
    </div>
  );
}
