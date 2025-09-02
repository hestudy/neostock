import { useState, useEffect, useRef, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Star, Clock, TrendingUp, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { SearchHistory, type SearchHistoryItem } from "@/lib/search-history";
import { MobileListItem } from "./stock-mobile-optimizations";
import type { Stock } from "@/hooks/use-stocks";

interface SearchSuggestion {
	id: string;
	text: string;
	type: "stock" | "history" | "trending" | "industry" | "quick";
	stock?: Stock;
	highlight?: string | null;
	popularity?: number;
}

interface SearchSuggestionsProps {
	query: string;
	searchResults: Stock[];
	instantResults: Stock[];
	onSuggestionClick: (suggestion: string) => void;
	onClearHistory?: () => void;
	visible: boolean;
	className?: string;
}

export function SearchSuggestions({
	query,
	searchResults,
	instantResults,
	onSuggestionClick,
	onClearHistory,
	visible,
	className,
}: SearchSuggestionsProps) {
	const [history, setHistory] = useState<SearchHistoryItem[]>([]);
	const [selectedIndex, setSelectedIndex] = useState(-1);
	const [trendingStocks, setTrendingStocks] = useState<Stock[]>([]);
	const suggestionsRef = useRef<HTMLDivElement>(null);
	const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

	// Mock trending stocks - in real implementation, this would come from API
	useEffect(() => {
		const mockTrending: Stock[] = [
			{ code: "000001", name: "平安银行", industry: "银行", price: 12.50, change: 0.5 },
			{ code: "000002", name: "万科A", industry: "房地产", price: 18.30, change: -0.3 },
			{ code: "600036", name: "招商银行", industry: "银行", price: 35.80, change: 0.8 },
			{ code: "600519", name: "贵州茅台", industry: "白酒", price: 1680.00, change: 1.2 },
			{ code: "000858", name: "五粮液", industry: "白酒", price: 128.50, change: 0.9 },
		];
		setTrendingStocks(mockTrending);
	}, []);

	useEffect(() => {
		if (visible) {
			const historyItems = query 
				? SearchHistory.search(query, 5) 
				: SearchHistory.getRecent(5);
			setHistory(historyItems);
		}
	}, [query, visible]);

	// Generate intelligent suggestions
	const suggestions = useMemo(() => {
		const allSuggestions: SearchSuggestion[] = [];
		const queryLower = query.toLowerCase();

		// Search results suggestions (from API)
		const searchSuggestions = searchResults.map((stock, index) => ({
			id: `search-${index}`,
			text: `${stock.name} (${stock.code})`,
			type: "stock" as const,
			stock,
			highlight: getHighlightMatch(stock.name, query) || getHighlightMatch(stock.code, query),
		}));

		// Instant results suggestions (for faster feedback)
		const instantSuggestions = instantResults
			.filter(stock => !searchResults.some(r => r.code === stock.code))
			.map((stock, index) => ({
				id: `instant-${index}`,
				text: `${stock.name} (${stock.code})`,
				type: "stock" as const,
				stock,
				highlight: getHighlightMatch(stock.name, query) || getHighlightMatch(stock.code, query),
			}));

		// Search history suggestions
		const historySuggestions = history.map((item, index) => ({
			id: `history-${index}`,
			text: item.query,
			type: "history" as const,
			highlight: getHighlightMatch(item.query, query),
		}));

		// Trending stocks when query is empty
		if (!query.trim()) {
			const trendingSuggestions = trendingStocks.slice(0, 3).map((stock, index) => ({
				id: `trending-${index}`,
				text: `${stock.name} (${stock.code})`,
				type: "trending" as const,
				stock,
				popularity: Math.floor(Math.random() * 100) + 1,
			}));
			allSuggestions.push(...trendingSuggestions);
		}

		// Industry suggestions
		const allStocks = [...searchResults, ...instantResults];
		const industries = [...new Set(allStocks.map(s => s.industry))];
		const industrySuggestions = industries
			.filter(industry => industry.toLowerCase().includes(queryLower))
			.slice(0, 3)
			.map((industry, index) => ({
				id: `industry-${index}`,
				text: industry,
				type: "industry" as const,
				highlight: getHighlightMatch(industry, query),
			}));

		// Combine all suggestions
		allSuggestions.push(...searchSuggestions);
		allSuggestions.push(...instantSuggestions);
		allSuggestions.push(...historySuggestions);
		allSuggestions.push(...industrySuggestions);

		// Remove duplicates and limit results
		const uniqueSuggestions = allSuggestions.filter((suggestion, index, self) =>
			index === self.findIndex(s => s.text === suggestion.text)
		);

		return uniqueSuggestions.slice(0, 10); // Limit to 10 suggestions
	}, [query, searchResults, instantResults, history, trendingStocks]);

	// Handle keyboard navigation
	useEffect(() => {
		const handleKeyDown = (e: KeyboardEvent) => {
			if (!visible) return;

			switch (e.key) {
				case "ArrowDown":
					e.preventDefault();
					setSelectedIndex(prev => 
						prev < suggestions.length - 1 ? prev + 1 : prev
					);
					break;
				case "ArrowUp":
					e.preventDefault();
					setSelectedIndex(prev => prev > 0 ? prev - 1 : -1);
					break;
				case "Enter":
					e.preventDefault();
					if (selectedIndex >= 0 && suggestions[selectedIndex]) {
						onSuggestionClick(suggestions[selectedIndex].text);
					}
					break;
				case "Escape":
					setSelectedIndex(-1);
					break;
			}
		};

		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [visible, selectedIndex, suggestions, onSuggestionClick]);

	// Scroll selected item into view
	useEffect(() => {
		if (selectedIndex >= 0 && itemRefs.current[selectedIndex]) {
			itemRefs.current[selectedIndex]?.scrollIntoView({
				block: "nearest",
				behavior: "smooth",
			});
		}
	}, [selectedIndex]);

	// Reset selection when query changes
	useEffect(() => {
		setSelectedIndex(-1);
	}, [query]);

	// Handle click outside
	useEffect(() => {
		const handleClickOutside = (e: MouseEvent) => {
			if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
				setSelectedIndex(-1);
			}
		};

		document.addEventListener("mousedown", handleClickOutside);
		return () => document.removeEventListener("mousedown", handleClickOutside);
	}, []);

	const handleSuggestionClick = (suggestion: SearchSuggestion) => {
		onSuggestionClick(suggestion.text);
	};

	const handleRemoveHistoryItem = (e: React.MouseEvent, query: string) => {
		e.stopPropagation();
		SearchHistory.remove(query);
		const updatedHistory = SearchHistory.getRecent(5);
		setHistory(updatedHistory);
	};

	const handleClearAll = () => {
		SearchHistory.clear();
		setHistory([]);
		onClearHistory?.();
	};

	if (!visible || suggestions.length === 0) {
		return null;
	}

	// Helper functions
	const getSuggestionIcon = (type: SearchSuggestion["type"]) => {
		switch (type) {
			case "stock":
				return <Search className="h-4 w-4 text-muted-foreground" />;
			case "history":
				return <Clock className="h-4 w-4 text-muted-foreground" />;
			case "trending":
				return <TrendingUp className="h-4 w-4 text-orange-500" />;
			case "industry":
				return <Star className="h-4 w-4 text-blue-500" />;
			default:
				return <Search className="h-4 w-4 text-muted-foreground" />;
		}
	};

	const formatSuggestionText = (suggestion: SearchSuggestion) => {
		if (suggestion.highlight) {
			return <span dangerouslySetInnerHTML={{ __html: suggestion.highlight }} />;
		}
		return suggestion.text;
	};

	return (
		<Card 
			ref={suggestionsRef}
			className={cn(
				"absolute top-full left-0 right-0 z-50 mt-1",
				"border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
				"shadow-lg",
				"min-h-[40px]", // Minimum height for touch targets
				className
			)}>
			<CardContent className="p-0">
				{query && (
					<div className="flex items-center justify-between p-3 border-b">
						<div className="flex items-center gap-2 text-sm text-muted-foreground">
							<Search className="h-4 w-4" />
							搜索建议
						</div>
						{history.length > 0 && (
							<Button
								variant="ghost"
								size="sm"
								onClick={handleClearAll}
								className="h-6 px-2 text-xs text-muted-foreground hover:text-destructive"
							>
								清除历史
							</Button>
						)}
					</div>
				)}

				<div className="max-h-80 overflow-y-auto">
					{suggestions.map((suggestion, index) => (
						<MobileListItem
							key={suggestion.id}
							ref={(el) => {
          if (el) {
            itemRefs.current[index] = el;
          }
        }}
							onClick={() => handleSuggestionClick(suggestion)}
							className={cn(
								"group hover:bg-muted/50 transition-colors duration-150",
								"min-h-[44px]", // Touch target size
								selectedIndex === index && "bg-muted",
								index === suggestions.length - 1 && "border-b-0"
							)}
						>
							<div className="flex items-center gap-3 flex-1 min-w-0">
								<div className="flex-shrink-0">
									{getSuggestionIcon(suggestion.type)}
								</div>
								
								<div className="flex-1 min-w-0">
									<div className="text-sm font-medium truncate">
										{formatSuggestionText(suggestion)}
									</div>
									
									{suggestion.stock && (
										<div className="text-xs text-muted-foreground flex items-center gap-2 mt-1">
											<span>{suggestion.stock.industry}</span>
											{suggestion.stock.price && (
												<span className={cn(
													"font-medium",
													suggestion.stock.change && suggestion.stock.change > 0 
														? "text-green-600" 
														: "text-red-600"
												)}>
													¥{suggestion.stock.price.toFixed(2)}
													{suggestion.stock.change && (
														<span className="ml-1">
															{suggestion.stock.change > 0 ? "+" : ""}
															{suggestion.stock.change}%
														</span>
													)}
												</span>
											)}
										</div>
									)}
									
									{suggestion.type === "trending" && suggestion.popularity && (
										<div className="text-xs text-muted-foreground mt-1">
											热度: {suggestion.popularity}
										</div>
									)}
									
									{suggestion.type === "history" && (
										<div className="flex items-center gap-2 mt-1">
											<Badge variant="secondary" className="text-xs px-1.5 py-0.5">
												历史
											</Badge>
											<span className="text-xs text-muted-foreground">
												{formatTime(suggestion.id.includes('history') ? 
													history.find(h => h.query === suggestion.text)?.timestamp || Date.now() 
													: Date.now()
												)}
											</span>
										</div>
									)}
								</div>
								
								{suggestion.type === "history" && (
									<Button
										variant="ghost"
										size="sm"
										onClick={(e) => handleRemoveHistoryItem(e, suggestion.text)}
										className={cn(
											"opacity-0 group-hover:opacity-100 transition-opacity",
											"h-6 w-6 p-0 ml-2",
											"hover:bg-destructive/10 hover:text-destructive"
										)}
									>
										<X className="h-3 w-3" />
										<span className="sr-only">删除</span>
									</Button>
								)}
							</div>
						</MobileListItem>
					))}
				</div>
			</CardContent>
		</Card>
	);
}

function getHighlightMatch(text: string, query: string): string | null {
	if (!query.trim()) return null;

	const normalizedQuery = query.toLowerCase();
	const normalizedText = text.toLowerCase();
	const index = normalizedText.indexOf(normalizedQuery);

	if (index === -1) return null;

	const before = text.substring(0, index);
	const match = text.substring(index, index + query.length);
	const after = text.substring(index + query.length);

	return `${before}<mark class="bg-primary/20 text-primary font-medium">${match}</mark>${after}`;
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