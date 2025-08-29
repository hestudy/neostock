import { useState, useEffect } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { History, X, Star, Clock, TrendingUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchHistory, type SearchHistoryItem } from "@/lib/search-history";
import { MobileListItem } from "./stock-mobile-optimizations";

interface SearchSuggestionsProps {
	query: string;
	onSuggestionClick: (suggestion: string) => void;
	onClearHistory?: () => void;
	visible: boolean;
	className?: string;
}

export function SearchSuggestions({
	query,
	onSuggestionClick,
	onClearHistory,
	visible,
	className,
}: SearchSuggestionsProps) {
	const [history, setHistory] = useState<SearchHistoryItem[]>([]);

	useEffect(() => {
		if (visible) {
			const historyItems = query 
				? SearchHistory.search(query, 8) 
				: SearchHistory.getRecent(8);
			setHistory(historyItems);
		}
	}, [query, visible]);

	const handleHistoryClick = (item: SearchHistoryItem) => {
		onSuggestionClick(item.query);
	};

	const handleRemoveHistoryItem = (e: React.MouseEvent, query: string) => {
		e.stopPropagation();
		SearchHistory.remove(query);
		const updatedHistory = SearchHistory.getRecent(8);
		setHistory(updatedHistory);
	};

	const handleClearAll = () => {
		SearchHistory.clear();
		setHistory([]);
		onClearHistory?.();
	};

	if (!visible || history.length === 0) {
		return null;
	}

	return (
		<Card className={cn(
			"absolute top-full left-0 right-0 z-50 mt-1",
			"border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
			"shadow-lg",
			className
		)}>
			<CardContent className="p-0">
				<div className="flex items-center justify-between p-3 border-b">
					<div className="flex items-center gap-2 text-sm text-muted-foreground">
						<History className="h-4 w-4" />
						{query ? "搜索建议" : "搜索历史"}
					</div>
					{history.length > 0 && (
						<Button
							variant="ghost"
							size="sm"
							onClick={handleClearAll}
							className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
						>
							清除全部
						</Button>
					)}
				</div>

				<div className="max-h-64 overflow-y-auto">
					{history.map((item, index) => (
						<MobileListItem
							key={`${item.query}-${item.timestamp}`}
							onClick={() => handleHistoryClick(item)}
							className={cn(
								"group hover:bg-muted/50",
								index === history.length - 1 && "border-b-0"
							)}
						>
							<div className="flex items-center gap-3 flex-1 min-w-0">
								<div className="flex-shrink-0">
									{item.type === "code" ? (
										<TrendingUp className="h-4 w-4 text-muted-foreground" />
									) : item.type === "name" ? (
										<Star className="h-4 w-4 text-muted-foreground" />
									) : (
										<Clock className="h-4 w-4 text-muted-foreground" />
									)}
								</div>
								
								<div className="flex-1 min-w-0">
									<div className="text-sm font-medium truncate">
										{highlightMatch(item.query, query)}
									</div>
									<div className="flex items-center gap-2 mt-1">
										<Badge variant="secondary" className="text-xs px-1.5 py-0.5">
											{getTypeLabel(item.type)}
										</Badge>
										<span className="text-xs text-muted-foreground">
											{formatTime(item.timestamp)}
										</span>
									</div>
								</div>
							</div>

							<Button
								variant="ghost"
								size="sm"
								onClick={(e) => handleRemoveHistoryItem(e, item.query)}
								className={cn(
									"opacity-0 group-hover:opacity-100 transition-opacity",
									"h-6 w-6 p-0 ml-2",
									"hover:bg-destructive/10 hover:text-destructive"
								)}
							>
								<X className="h-3 w-3" />
								<span className="sr-only">删除</span>
							</Button>
						</MobileListItem>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function highlightMatch(text: string, query: string): React.ReactNode {
	if (!query.trim()) return text;

	const normalizedQuery = query.toLowerCase();
	const normalizedText = text.toLowerCase();
	const index = normalizedText.indexOf(normalizedQuery);

	if (index === -1) return text;

	const before = text.substring(0, index);
	const match = text.substring(index, index + query.length);
	const after = text.substring(index + query.length);

	return (
		<>
			{before}
			<span className="bg-primary/20 text-primary font-medium">{match}</span>
			{after}
		</>
	);
}

function getTypeLabel(type: SearchHistoryItem["type"]): string {
	switch (type) {
		case "code": return "代码";
		case "name": return "名称";
		case "mixed": return "综合";
		default: return "搜索";
	}
}

function formatTime(timestamp: number): string {
	const now = Date.now();
	const diff = now - timestamp;

	if (diff < 60 * 1000) return "刚刚";
	if (diff < 60 * 60 * 1000) return `${Math.floor(diff / (60 * 1000))}分钟前`;
	if (diff < 24 * 60 * 60 * 1000) return `${Math.floor(diff / (60 * 60 * 1000))}小时前`;
	if (diff < 7 * 24 * 60 * 60 * 1000) return `${Math.floor(diff / (24 * 60 * 60 * 1000))}天前`;

	return new Date(timestamp).toLocaleDateString('zh-CN', {
		month: 'short',
		day: 'numeric'
	});
}

interface QuickAccessProps {
	onItemClick: (query: string) => void;
	className?: string;
}

export function QuickAccess({ onItemClick, className }: QuickAccessProps) {
	const quickAccessItems = [
		{ label: "热门股票", query: "", icon: TrendingUp },
		{ label: "银行股", query: "银行", icon: Star },
		{ label: "科技股", query: "科技", icon: Star },
		{ label: "新能源", query: "新能源", icon: Star },
		{ label: "医药股", query: "医药", icon: Star },
	];

	return (
		<div className={cn("space-y-2", className)}>
			<div className="text-sm font-medium text-muted-foreground mb-3">
				快速访问
			</div>
			<div className="flex flex-wrap gap-2">
				{quickAccessItems.map((item) => {
					const IconComponent = item.icon;
					return (
						<Button
							key={item.label}
							variant="outline"
							size="sm"
							onClick={() => onItemClick(item.query)}
							className={cn(
								"flex items-center gap-2 h-8 px-3",
								"hover:bg-primary/5 hover:border-primary/20"
							)}
						>
							<IconComponent className="h-3 w-3" />
							{item.label}
						</Button>
					);
				})}
			</div>
		</div>
	);
}