import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface StockLayoutProps {
	children: ReactNode;
	className?: string;
	sidebar?: ReactNode;
	header?: ReactNode;
}

export function StockLayout({
	children,
	className,
	sidebar,
	header,
}: StockLayoutProps) {
	return (
		<div className={cn("flex flex-col min-h-screen", className)}>
			{header && (
				<div className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
					{header}
				</div>
			)}
			<div className="flex flex-1 overflow-hidden">
				{sidebar && (
					<aside className="hidden lg:block w-64 border-r bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
						<div className="p-4">
							{sidebar}
						</div>
					</aside>
				)}
				<main className="flex-1 overflow-auto">
					<div className="container mx-auto p-4 max-w-7xl">
						{children}
					</div>
				</main>
			</div>
		</div>
	);
}

export function StockPageContainer({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn(
			"grid grid-cols-1 gap-4",
			"sm:gap-4 sm:p-2",
			"md:grid-cols-1 md:gap-6 md:p-4",
			"lg:grid-cols-1 lg:gap-8 lg:p-6",
			"xl:grid-cols-1 xl:gap-8",
			// 触屏优化
			"touch-action-manipulation",
			"-webkit-tap-highlight-color-transparent",
			className
		)}>
			{children}
		</div>
	);
}

export function StockGrid({
	children,
	className,
}: {
	children: ReactNode;
	className?: string;
}) {
	return (
		<div className={cn(
			"grid gap-4",
			"grid-cols-1",
			"sm:grid-cols-2",
			"lg:grid-cols-3",
			"xl:grid-cols-4",
			"2xl:grid-cols-5",
			className
		)}>
			{children}
		</div>
	);
}