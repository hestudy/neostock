import { useState, useEffect, useCallback } from "react";

const FAVORITES_STORAGE_KEY = "stock_favorites";

interface StockFavorite {
	ts_code: string;
	name: string;
	symbol: string;
	addedAt: number;
}

interface UseStockFavoritesReturn {
	favorites: StockFavorite[];
	isFavorite: (tsCode: string) => boolean;
	addFavorite: (stock: Omit<StockFavorite, "addedAt">) => Promise<void>;
	removeFavorite: (tsCode: string) => Promise<void>;
	toggleFavorite: (stock: Omit<StockFavorite, "addedAt">) => Promise<void>;
	clearFavorites: () => Promise<void>;
	loading: boolean;
	error: string | null;
}

export function useStockFavorites(): UseStockFavoritesReturn {
	const [favorites, setFavorites] = useState<StockFavorite[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	// 从本地存储加载收藏列表
	const loadFavorites = useCallback(() => {
		try {
			setLoading(true);
			setError(null);
			
			if (typeof window === "undefined") {
				setFavorites([]);
				return;
			}

			const stored = localStorage.getItem(FAVORITES_STORAGE_KEY);
			if (stored) {
				const parsed = JSON.parse(stored);
				if (Array.isArray(parsed)) {
					setFavorites(parsed);
				} else {
					setFavorites([]);
				}
			} else {
				setFavorites([]);
			}
		} catch (err) {
			console.error("Failed to load favorites:", err);
			setError("加载收藏列表失败");
			setFavorites([]);
		} finally {
			setLoading(false);
		}
	}, []);

	// 保存到本地存储
	const saveFavorites = useCallback((newFavorites: StockFavorite[]) => {
		try {
			if (typeof window !== "undefined") {
				localStorage.setItem(FAVORITES_STORAGE_KEY, JSON.stringify(newFavorites));
			}
			setFavorites(newFavorites);
		} catch (err) {
			console.error("Failed to save favorites:", err);
			setError("保存收藏列表失败");
		}
	}, []);

	// 初始化加载
	useEffect(() => {
		loadFavorites();
	}, [loadFavorites]);

	// 检查是否为收藏股票
	const isFavorite = useCallback(
		(tsCode: string) => {
			return favorites.some((fav) => fav.ts_code === tsCode);
		},
		[favorites]
	);

	// 添加收藏
	const addFavorite = useCallback(
		async (stock: Omit<StockFavorite, "addedAt">) => {
			try {
				setError(null);
				
				if (isFavorite(stock.ts_code)) {
					return; // 已经收藏，不重复添加
				}

				const newFavorite: StockFavorite = {
					...stock,
					addedAt: Date.now(),
				};

				const newFavorites = [newFavorite, ...favorites];
				saveFavorites(newFavorites);
			} catch (err) {
				console.error("Failed to add favorite:", err);
				setError("添加收藏失败");
			}
		},
		[favorites, isFavorite, saveFavorites]
	);

	// 移除收藏
	const removeFavorite = useCallback(
		async (tsCode: string) => {
			try {
				setError(null);
				
				const newFavorites = favorites.filter((fav) => fav.ts_code !== tsCode);
				saveFavorites(newFavorites);
			} catch (err) {
				console.error("Failed to remove favorite:", err);
				setError("移除收藏失败");
			}
		},
		[favorites, saveFavorites]
	);

	// 切换收藏状态
	const toggleFavorite = useCallback(
		async (stock: Omit<StockFavorite, "addedAt">) => {
			if (isFavorite(stock.ts_code)) {
				await removeFavorite(stock.ts_code);
			} else {
				await addFavorite(stock);
			}
		},
		[isFavorite, addFavorite, removeFavorite]
	);

	// 清除所有收藏
	const clearFavorites = useCallback(async () => {
		try {
			setError(null);
			saveFavorites([]);
		} catch (err) {
			console.error("Failed to clear favorites:", err);
			setError("清除收藏失败");
		}
	}, [saveFavorites]);

	return {
		favorites,
		isFavorite,
		addFavorite,
		removeFavorite,
		toggleFavorite,
		clearFavorites,
		loading,
		error,
	};
}