import React, { useRef, useState, useEffect } from 'react';
import { cn } from '../lib/utils';

interface MarqueeTextProps {
  children: React.ReactNode;
  className?: string;
  /** 控制滚动的速度 (秒)，默认 25s 走完自身宽度 */
  speed?: number; 
}

export function MarqueeText({ children, className, speed = 8 }: MarqueeTextProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    const text = textRef.current;
    if (!container || !text) return;

    const checkOverflow = () => {
      // 放弃 getBoundingClientRect，使用 scrollWidth 与 clientWidth。
      // scrollWidth 能获取到即使被 overflow 隐藏时的真实内容宽度
      const containerWidth = container.clientWidth;
      const textWidth = text.scrollWidth;
      
      // 容差处理：避免在边缘 1-2 像素时疯狂触发状态切换 (Layout Thrashing)
      setIsOverflowing(textWidth > containerWidth + 2);
    };

    // 使用 ResizeObserver 监听容器与内容的变化
    const resizeObserver = new ResizeObserver(() => {
      // 放入 requestAnimationFrame，将测量推迟到下一帧渲染前，避免阻塞主线程
      requestAnimationFrame(checkOverflow);
    });
    
    resizeObserver.observe(container);
    resizeObserver.observe(text);

    // 初始执行一次
    checkOverflow();

    return () => resizeObserver.disconnect();
  },[children]);

  return (
    <div 
      ref={containerRef} 
      className={cn(
        // 核心：相对定位，隐藏溢出，强制单行
        "relative flex w-full overflow-hidden whitespace-nowrap", 
        isOverflowing && "[mask-image:linear-gradient(to_right,transparent,black_10%,black_90%,transparent)]",
        className
      )}
    >
      {/* 第一个节点：原内容 */}
      <div 
        ref={textRef} 
        className={cn(
          // w-max 确保它能自然撑开以供准确测量
          "flex w-max shrink-0", 
          isOverflowing && "animate-marquee pr-12"
        )}
        style={isOverflowing ? { animationDuration: `${speed}s` } : {}}
      >
        {children}
      </div>
      
      {/* 第二个节点：当溢出时才渲染的克隆内容，用于无缝衔接 */}
      {isOverflowing && (
        <div 
          className="flex w-max shrink-0 animate-marquee pr-12" 
          aria-hidden="true" // 避免屏幕阅读器重复朗读
          style={{ animationDuration: `${speed}s` }}
        >
          {children}
        </div>
      )}
    </div>
  );
}