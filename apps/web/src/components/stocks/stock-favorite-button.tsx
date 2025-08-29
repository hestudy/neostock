import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { useStockFavorites } from "@/hooks/use-stock-favorites";

interface StockFavoriteButtonProps {
	tsCode: string;
	name: string;
	symbol: string;
	className?: string;
	size?: "default" | "sm" | "lg" | "icon";
	variant?: "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
	showText?: boolean;
	disabled?: boolean;
}

export function StockFavoriteButton({
	tsCode,
	name,
	symbol,
	className,
	size = "default",
	variant = "ghost",
	showText = false,
	disabled = false,
}: StockFavoriteButtonProps) {
	const { isFavorite, toggleFavorite } = useStockFavorites();
	const [isToggling, setIsToggling] = useState(false);
	
	const favorite = isFavorite(tsCode);

	const handleToggleFavorite = async (e?: React.MouseEvent) => {
		if (e) {
			e.stopPropagation();
			e.preventDefault();
		}

		if (isToggling || disabled) return;

		try {
			setIsToggling(true);
			await toggleFavorite({
				ts_code: tsCode,
				name,
				symbol,
			});
		} catch (error) {
			console.error("Toggle favorite failed:", error);
		} finally {
			setIsToggling(false);
		}
	};

	return (
		<Button
			variant={variant}
			size={size}
			onClick={handleToggleFavorite}
			disabled={disabled || isToggling}
			className={cn(
				"transition-colors",
				favorite && "text-yellow-500 hover:text-yellow-600",
				!favorite && "text-muted-foreground hover:text-foreground",
				// 触摸目标优化
				size === "icon" && "min-h-[44px] min-w-[44px]",
				size === "sm" && "min-h-[36px]",
				className
			)}
			title={favorite ? "取消收藏" : "添加收藏"}
		>
			<Star
				className={cn(
					"transition-all duration-200",
					size === "sm" && "h-4 w-4",
					size === "default" && "h-4 w-4",
					size === "lg" && "h-5 w-5",
					favorite && "fill-current",
					isToggling && "animate-pulse"
				)}
			/>
			{showText && (
				<span className="ml-2">
					{favorite ? "已收藏" : "收藏"}
				</span>
			)}
		</Button>
	);
}

interface StockFavoriteToggleProps {
	tsCode: string;
	name: string;
	symbol: string;
	className?: string;
	children?: (props: {
		isFavorite: boolean;
		isToggling: boolean;
		toggleFavorite: () => void;
	}) => React.ReactNode;
}

export function StockFavoriteToggle({
	tsCode,
	name,
	symbol,
	className,
	children,
}: StockFavoriteToggleProps) {
	const { isFavorite, toggleFavorite } = useStockFavorites();
	const [isToggling, setIsToggling] = useState(false);
	
	const favorite = isFavorite(tsCode);

	const handleToggleFavorite = async () => {
		if (isToggling) return;

		try {
			setIsToggling(true);
			await toggleFavorite({
				ts_code: tsCode,
				name,
				symbol,
			});
		} catch (error) {
			console.error("Toggle favorite failed:", error);
		} finally {
			setIsToggling(false);
		}
	};

	if (children) {
		return (
			<div className={className}>
				{children({
					isFavorite: favorite,
					isToggling,
					toggleFavorite: handleToggleFavorite,
				})}
			</div>
		);
	}

	return (
		<StockFavoriteButton
			tsCode={tsCode}
			name={name}
			symbol={symbol}
			className={className}
		/>
	);
}