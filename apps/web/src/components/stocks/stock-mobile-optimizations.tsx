import type { ReactNode } from "react";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

interface TouchOptimizedButtonProps {
	children: ReactNode;
	className?: string;
	onClick?: () => void;
	disabled?: boolean;
}

export function TouchOptimizedButton({
	children,
	className,
	onClick,
	disabled = false,
}: TouchOptimizedButtonProps) {
	return (
		<button
			onClick={onClick}
			disabled={disabled}
			className={cn(
				// 触摸目标最小44px
				"min-h-[44px] min-w-[44px]",
				// 触屏优化
				"touch-manipulation",
				"select-none",
				"-webkit-tap-highlight-color-transparent",
				// 禁用双击缩放
				"touch-action-manipulation",
				// 基础样式
				"flex items-center justify-center",
				"rounded-md transition-colors",
				"disabled:opacity-50 disabled:pointer-events-none",
				className
			)}
		>
			{children}
		</button>
	);
}

interface TouchOptimizedInputProps {
	placeholder?: string;
	value?: string;
	onChange?: (value: string) => void;
	className?: string;
	autoFocus?: boolean;
}

export function TouchOptimizedInput({
	placeholder,
	value,
	onChange,
	className,
	autoFocus = false,
}: TouchOptimizedInputProps) {
	return (
		<input
			type="text"
			placeholder={placeholder}
			value={value}
			onChange={(e) => onChange?.(e.target.value)}
			autoFocus={autoFocus}
			className={cn(
				// 触摸目标最小44px高度
				"min-h-[44px]",
				// 移动端输入优化
				"touch-manipulation",
				"-webkit-tap-highlight-color-transparent",
				// 防止页面缩放
				"text-base", // 16px防止iOS缩放
				// 基础样式
				"w-full px-3 py-2",
				"border border-input bg-background",
				"rounded-md",
				"focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
				"placeholder:text-muted-foreground",
				className
			)}
		/>
	);
}

interface MobileListItemProps {
	children: ReactNode;
	onClick?: () => void;
	className?: string;
	selected?: boolean;
}

export const MobileListItem = forwardRef<HTMLDivElement, MobileListItemProps>(({
	children,
	onClick,
	className,
	selected = false,
}: MobileListItemProps, ref) => {
	return (
		<div
			ref={ref}
			onClick={onClick}
			className={cn(
				// 触摸目标最小44px
				"min-h-[44px]",
				// 触屏优化
				"touch-manipulation",
				"select-none",
				"-webkit-tap-highlight-color-transparent",
				// 基础样式
				"flex items-center px-4 py-3",
				"border-b border-border",
				"transition-colors duration-150",
				// 交互状态
				onClick && "cursor-pointer hover:bg-muted/50 active:bg-muted",
				selected && "bg-muted",
				className
			)}
		>
			{children}
		</div>
	);
});