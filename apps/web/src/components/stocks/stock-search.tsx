import { useState, useRef, useEffect } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Search, X, History, Star } from "lucide-react";
import { cn } from "@/lib/utils";

interface StockSearchProps {
	onSearch?: (query: string) => void;
	onClear?: () => void;
	placeholder?: string;
	className?: string;
	autoFocus?: boolean;
	disabled?: boolean;
	value?: string;
	onChange?: (value: string) => void;
}

export function StockSearch({
	onSearch,
	onClear,
	placeholder = "搜索股票代码或名称...",
	className,
	autoFocus = false,
	disabled = false,
	value: controlledValue,
	onChange,
}: StockSearchProps) {
	const [value, setValue] = useState(controlledValue || "");
	const [isFocused, setIsFocused] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);

	const currentValue = controlledValue !== undefined ? controlledValue : value;

	const handleInputChange = (newValue: string) => {
		if (controlledValue === undefined) {
			setValue(newValue);
		}
		onChange?.(newValue);
	};

	const handleSearch = () => {
		if (currentValue.trim()) {
			onSearch?.(currentValue.trim());
		}
	};

	const handleClear = () => {
		const newValue = "";
		if (controlledValue === undefined) {
			setValue(newValue);
		}
		onChange?.(newValue);
		if (onClear) {
			onClear();
		}
		inputRef.current?.focus();
	};

	const handleKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			e.preventDefault();
			handleSearch();
		}
		if (e.key === "Escape") {
			handleClear();
		}
	};

	useEffect(() => {
		if (autoFocus && inputRef.current) {
			inputRef.current.focus();
		}
	}, [autoFocus]);

	return (
		<div className={cn("relative", className)}>
			<div className="relative flex items-center">
				<div className="absolute left-3 top-1/2 transform -translate-y-1/2">
					<Search className="h-4 w-4 text-muted-foreground" />
				</div>
				
				<Input
					ref={inputRef}
					type="text"
					placeholder={placeholder}
					value={currentValue}
					onChange={(e) => handleInputChange(e.target.value)}
					onKeyDown={handleKeyDown}
					onFocus={() => setIsFocused(true)}
					onBlur={() => setIsFocused(false)}
					disabled={disabled}
					className={cn(
						"pl-10 pr-20",
						"min-h-[44px]", // 移动端触摸目标
						"text-base", // 防止iOS缩放
						isFocused && "ring-2 ring-ring",
					)}
					autoComplete="off"
					spellCheck={false}
				/>

				<div className="absolute right-2 top-1/2 transform -translate-y-1/2 flex items-center gap-1">
					{currentValue && (
						<Button
							type="button"
							variant="ghost"
							size="sm"
							onClick={handleClear}
							className={cn(
								"h-8 w-8 p-0",
								"min-h-[32px] min-w-[32px]", // 触摸目标
								"hover:bg-muted",
							)}
							disabled={disabled}
						>
							<X className="h-4 w-4" />
							<span className="sr-only">清除搜索</span>
						</Button>
					)}
					
					<Button
						type="button"
						size="sm"
						onClick={handleSearch}
						disabled={disabled || !currentValue.trim()}
						className={cn(
							"h-8 px-3",
							"min-h-[32px]", // 触摸目标
						)}
					>
						搜索
					</Button>
				</div>
			</div>
		</div>
	);
}

interface SearchQuickActionsProps {
	onHistoryClick?: () => void;
	onFavoritesClick?: () => void;
	className?: string;
}

export function SearchQuickActions({
	onHistoryClick,
	onFavoritesClick,
	className,
}: SearchQuickActionsProps) {
	return (
		<div className={cn("flex items-center gap-2", className)}>
			<Button
				variant="outline"
				size="sm"
				onClick={onHistoryClick}
				className={cn(
					"flex items-center gap-2",
					"min-h-[36px]", // 触摸目标
				)}
			>
				<History className="h-4 w-4" />
				搜索历史
			</Button>
			
			<Button
				variant="outline"
				size="sm"
				onClick={onFavoritesClick}
				className={cn(
					"flex items-center gap-2",
					"min-h-[36px]", // 触摸目标
				)}
			>
				<Star className="h-4 w-4" />
				我的收藏
			</Button>
		</div>
	);
}

interface SearchContainerProps {
	children: React.ReactNode;
	className?: string;
}

export function SearchContainer({ children, className }: SearchContainerProps) {
	return (
		<div className={cn(
			"space-y-4",
			"bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60",
			"rounded-lg border p-4",
			className
		)}>
			{children}
		</div>
	);
}