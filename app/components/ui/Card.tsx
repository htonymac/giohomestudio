"use client";

import { HTMLAttributes, forwardRef } from "react";

// v14 Card primitive — solid #151518, hairline border, no blur, no gradient bg.

type CardProps = HTMLAttributes<HTMLDivElement> & {
  padding?: number | string;
  radius?: number | string;
};

const Card = forwardRef<HTMLDivElement, CardProps>(function Card(
  { children, style, padding = 18, radius = 18, className, ...rest },
  ref
) {
  return (
    <div
      ref={ref}
      className={className}
      style={{
        background: "#151518",
        border: "1px solid rgba(255,255,255,.06)",
        borderRadius: radius,
        padding,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
});

Card.displayName = "Card";

export default Card;
export { Card };
