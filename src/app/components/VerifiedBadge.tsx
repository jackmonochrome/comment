export function VerifiedBadge({ className = "" }: { className?: string }) {
  // Создаем путь для badge с закругленными зубчиками
  const createBadgePath = () => {
    const cx = 12; // центр x
    const cy = 12; // центр y
    const outerRadius = 9.5; // внешний радиус
    const innerRadius = 8; // внутренний радиус
    const points = 8; // количество зубчиков (уменьшено в 2 раза)
    
    let path = '';
    
    for (let i = 0; i < points * 2; i++) {
      const angle = (Math.PI * 2 * i) / (points * 2);
      const radius = i % 2 === 0 ? outerRadius : innerRadius;
      const x = cx + Math.cos(angle - Math.PI / 2) * radius;
      const y = cy + Math.sin(angle - Math.PI / 2) * radius;
      
      if (i === 0) {
        path += `M ${x} ${y}`;
      } else {
        // Используем quadratic curve для закругления
        const prevAngle = (Math.PI * 2 * (i - 1)) / (points * 2);
        const prevRadius = (i - 1) % 2 === 0 ? outerRadius : innerRadius;
        const prevX = cx + Math.cos(prevAngle - Math.PI / 2) * prevRadius;
        const prevY = cy + Math.sin(prevAngle - Math.PI / 2) * prevRadius;
        
        const cpX = (prevX + x) / 2;
        const cpY = (prevY + y) / 2;
        
        path += ` Q ${cpX} ${cpY} ${x} ${y}`;
      }
    }
    
    path += ' Z';
    return path;
  };

  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Badge с закругленными зубчиками */}
      <path
        d={createBadgePath()}
        fill="#5B9FED"
      />
      
      {/* Галочка черного цвета */}
      <path
        d="M16.5 9L10.5 15L7.5 12"
        stroke="#18181B"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
