import { useNavigate } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Star, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import { MobileListItem } from "./stock-mobile-optimizations";

interface StockBasicInfo {
	ts_code: string;
	symbol: string;
	name: string;
	area: string;
	industry: string;
	market: string;
	list_date: string;
	is_hs: string;
}

interface StockPriceInfo {
	current_price?: number;
	change?: number;
	change_percent?: number;
	volume?: number;
	amount?: number;
}

interface StockItemData extends StockBasicInfo {
	price?: StockPriceInfo;
	isFavorite?: boolean;
}

interface StockListItemProps {
	stock: StockItemData;
	onToggleFavorite?: (tsCode: string) => void;
	onClick?: (tsCode: string) => void;
	className?: string;
	compact?: boolean;
}

export function StockListItem({
	stock,
	onToggleFavorite,
	onClick,
	className,
	compact = false,
}: StockListItemProps) {
	const navigate = useNavigate();

	const handleFavoriteClick = (e: React.MouseEvent) => {
		e.stopPropagation();
		e.preventDefault();
		onToggleFavorite?.(stock.ts_code);
	};

	const handleItemClick = () => {
		if (onClick) {
			onClick(stock.ts_code);
		} else {
			navigate({ to: "/stocks/$symbol", params: { symbol: stock.ts_code } });
		}
	};

	const formatPrice = (price: number) => {
		return price.toFixed(2);
	};

	const formatChange = (change: number) => {
		const sign = change >= 0 ? "+" : "";
		return `${sign}${change.toFixed(2)}`;
	};

	const formatChangePercent = (percent: number) => {
		const sign = percent >= 0 ? "+" : "";
		return `${sign}${percent.toFixed(2)}%`;
	};

	const getPriceColor = (change?: number) => {
		if (!change) return "text-muted-foreground";
		if (change > 0) return "text-green-600";
		if (change < 0) return "text-red-600";
		return "text-muted-foreground";
	};

	const getPriceIcon = (change?: number) => {
		if (!change) return <Minus className="h-3 w-3" />;
		if (change > 0) return <TrendingUp className="h-3 w-3" />;
		if (change < 0) return <TrendingDown className="h-3 w-3" />;
		return <Minus className="h-3 w-3" />;
	};

	const getMarketBadgeVariant = (market: string) => {
		switch (market) {
			case "主板": return "default";
			case "创业板": return "secondary";
			case "科创板": return "outline";
			default: return "secondary";
		}
	};

	if (compact) {
		return (
			<MobileListItem
				onClick={handleItemClick}
				className={cn("justify-between", className)}
			>
				<div className="flex items-center gap-3 flex-1 min-w-0">
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2 mb-1">
							<span className="font-medium text-sm truncate">
								{stock.name}
							</span>
							<Badge variant={getMarketBadgeVariant(stock.market)} className="text-xs px-1.5 py-0.5">
								{stock.market}
							</Badge>
						</div>
						<div className="text-xs text-muted-foreground truncate">
							{stock.ts_code} • {stock.industry}
						</div>
					</div>
					
					{stock.price && (
						<div className="flex flex-col items-end gap-1">
							<span className={cn("font-mono text-sm", getPriceColor(stock.price.change))}>
								¥{formatPrice(stock.price.current_price || 0)}
							</span>
							{stock.price.change !== undefined && (
								<div className={cn("flex items-center gap-1 text-xs", getPriceColor(stock.price.change))}>
									{getPriceIcon(stock.price.change)}
									<span>{formatChange(stock.price.change)}</span>
									{stock.price.change_percent !== undefined && (
										<span>({formatChangePercent(stock.price.change_percent)})</span>
									)}
								</div>
							)}
						</div>
					)}
				</div>
				
				<Button
					variant="ghost"
					size="sm"
					onClick={handleFavoriteClick}
					className={cn(
						"ml-2 p-1.5 h-auto min-h-[32px] min-w-[32px]",
						stock.isFavorite && "text-yellow-500"
					)}
				>
					<Star className={cn("h-4 w-4", stock.isFavorite && "fill-current")} />
				</Button>
			</MobileListItem>
		);
	}

	return (
		<div 
			onClick={handleItemClick}
			className="block cursor-pointer"
		>
			<Card className={cn(
				"transition-all duration-200 hover:shadow-md hover:border-primary/50",
				"cursor-pointer",
				className
			)}>
				<CardContent className="p-4">
					<div className="flex items-start justify-between">
						<div className="flex-1 min-w-0">
							<div className="flex items-center gap-2 mb-2">
								<h3 className="font-semibold truncate">{stock.name}</h3>
								<Badge variant={getMarketBadgeVariant(stock.market)}>
									{stock.market}
								</Badge>
								{stock.is_hs === "1" && (
									<Badge variant="outline" className="text-xs">
										沪深港通
									</Badge>
								)}
							</div>
							
							<div className="space-y-1 text-sm text-muted-foreground">
								<div>代码: {stock.ts_code}</div>
								<div>行业: {stock.industry}</div>
								<div>地区: {stock.area}</div>
							</div>
						</div>
						
						<div className="flex flex-col items-end gap-2 ml-4">
							<Button
								variant="ghost"
								size="sm"
								onClick={handleFavoriteClick}
								className={cn(
									"p-2 h-auto",
									stock.isFavorite && "text-yellow-500"
								)}
							>
								<Star className={cn("h-4 w-4", stock.isFavorite && "fill-current")} />
							</Button>
							
							{stock.price && (
								<div className="text-right">
									<div className={cn("font-mono text-lg font-semibold", getPriceColor(stock.price.change))}>
										¥{formatPrice(stock.price.current_price || 0)}
									</div>
									{stock.price.change !== undefined && (
										<div className={cn("flex items-center gap-1 text-sm mt-1", getPriceColor(stock.price.change))}>
											{getPriceIcon(stock.price.change)}
											<span>{formatChange(stock.price.change)}</span>
											{stock.price.change_percent !== undefined && (
												<span>({formatChangePercent(stock.price.change_percent)})</span>
											)}
										</div>
									)}
								</div>
							)}
						</div>
					</div>
				</CardContent>
			</Card>
		</div>
	);
}

interface StockListProps {
	stocks: StockItemData[];
	loading?: boolean;
	error?: string;
	onToggleFavorite?: (tsCode: string) => void;
	onStockClick?: (tsCode: string) => void;
	compact?: boolean;
	className?: string;
	emptyMessage?: string;
}

export function StockList({
	stocks,
	loading = false,
	error,
	onToggleFavorite,
	onStockClick,
	compact = false,
	className,
	emptyMessage = "暂无股票数据",
}: StockListProps) {
	if (loading) {
		return (
			<div className={cn("space-y-4", className)}>
				{Array.from({ length: compact ? 8 : 6 }).map((_, index) => (
					<StockListItemSkeleton key={index} compact={compact} />
				))}
			</div>
		);
	}

	if (error) {
		return (
			<div className={cn("text-center py-8", className)}>
				<div className="text-destructive mb-2">加载失败</div>
				<div className="text-sm text-muted-foreground">{error}</div>
			</div>
		);
	}

	if (!stocks.length) {
		return (
			<div className={cn("text-center py-8", className)}>
				<div className="text-muted-foreground">{emptyMessage}</div>
			</div>
		);
	}

	return (
		<div className={cn(compact ? "border rounded-lg overflow-hidden" : "space-y-4", className)}>
			{stocks.map((stock) => (
				<StockListItem
					key={stock.ts_code}
					stock={stock}
					onToggleFavorite={onToggleFavorite}
					onClick={onStockClick}
					compact={compact}
				/>
			))}
		</div>
	);
}

interface StockListItemSkeletonProps {
	compact?: boolean;
}

export function StockListItemSkeleton({ compact = false }: StockListItemSkeletonProps) {
	if (compact) {
		return (
			<div className="flex items-center justify-between p-4 border-b">
				<div className="flex-1 space-y-2">
					<div className="flex items-center gap-2">
						<Skeleton className="h-4 w-24" />
						<Skeleton className="h-4 w-12" />
					</div>
					<Skeleton className="h-3 w-32" />
				</div>
				<div className="flex flex-col items-end gap-1">
					<Skeleton className="h-4 w-16" />
					<Skeleton className="h-3 w-20" />
				</div>
				<Skeleton className="h-8 w-8 ml-2" />
			</div>
		);
	}

	return (
		<Card>
			<CardContent className="p-4">
				<div className="flex justify-between">
					<div className="flex-1 space-y-3">
						<div className="flex items-center gap-2">
							<Skeleton className="h-5 w-32" />
							<Skeleton className="h-5 w-12" />
						</div>
						<div className="space-y-2">
							<Skeleton className="h-4 w-40" />
							<Skeleton className="h-4 w-36" />
							<Skeleton className="h-4 w-28" />
						</div>
					</div>
					<div className="flex flex-col items-end gap-2 ml-4">
						<Skeleton className="h-8 w-8" />
						<div className="text-right space-y-1">
							<Skeleton className="h-6 w-20" />
							<Skeleton className="h-4 w-24" />
						</div>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}