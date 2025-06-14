"use client";
import { useEffect } from "react";
import confetti from "canvas-confetti"

interface AutoConfettiWrapperProps {
  children: React.ReactNode;
  delay?: number; // Optional delay before confetti starts (in milliseconds)
  duration?: number; // Duration of confetti animation (in milliseconds)
}

export function AutoConfettiWrapper({ 
  children, 
  delay = 500, 
  duration = 5000 
}: AutoConfettiWrapperProps) {
  useEffect(() => {
    const triggerConfetti = () => {
      const animationEnd = Date.now() + duration;
      const defaults = { startVelocity: 30, spread: 360, ticks: 60, zIndex: 0 };
      
      const randomInRange = (min: number, max: number) =>
        Math.random() * (max - min) + min;
      
      const interval = window.setInterval(() => {
        const timeLeft = animationEnd - Date.now();
        if (timeLeft <= 0) {
          return clearInterval(interval);
        }
        
        const particleCount = 50 * (timeLeft / duration);
        
        // Left side fireworks
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.1, 0.3), y: Math.random() - 0.2 },
        });
        
        // Right side fireworks
        confetti({
          ...defaults,
          particleCount,
          origin: { x: randomInRange(0.7, 0.9), y: Math.random() - 0.2 },
        });
      }, 250);
    };

    // Trigger confetti after specified delay
    const timeout = setTimeout(triggerConfetti, delay);
    
    return () => clearTimeout(timeout);
  }, [delay, duration]);

  return <div className="relative">{children}</div>;
}

// Example usage component
export default function ExamplePage() {
  return (
    <AutoConfettiWrapper delay={1000} duration={4000}>
      <div className="min-h-screen bg-gradient-to-br from-purple-400 via-pink-500 to-red-500 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-6xl font-bold text-white mb-4 drop-shadow-lg">
            🎉 Welcome! 🎉
          </h1>
          <p className="text-xl text-white/90 mb-8">
            Confetti will automatically trigger on page load
          </p>
        </div>
      </div>
    </AutoConfettiWrapper>
  );
}