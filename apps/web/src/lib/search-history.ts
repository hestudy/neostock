const SEARCH_HISTORY_KEY = "stock_search_history";
const MAX_HISTORY_ITEMS = 10;

export interface SearchHistoryItem {
	query: string;
	timestamp: number;
	type: "code" | "name" | "mixed";
}

export class SearchHistory {
	private static getStorageKey(): string {
		return SEARCH_HISTORY_KEY;
	}

	static add(query: string, type: SearchHistoryItem["type"] = "mixed"): void {
		if (!query.trim()) return;

		const history = this.getAll();
		const normalizedQuery = query.trim();
		
		const existingIndex = history.findIndex(
			(item) => item.query.toLowerCase() === normalizedQuery.toLowerCase()
		);

		if (existingIndex >= 0) {
			history.splice(existingIndex, 1);
		}

		const newItem: SearchHistoryItem = {
			query: normalizedQuery,
			timestamp: Date.now(),
			type,
		};

		history.unshift(newItem);

		if (history.length > MAX_HISTORY_ITEMS) {
			history.splice(MAX_HISTORY_ITEMS);
		}

		this.save(history);
	}

	static getAll(): SearchHistoryItem[] {
		try {
			if (typeof window === "undefined") return [];
			
			const stored = localStorage.getItem(this.getStorageKey());
			if (!stored) return [];

			const parsed = JSON.parse(stored);
			return Array.isArray(parsed) ? parsed : [];
		} catch (error) {
			console.warn("Failed to load search history:", error);
			return [];
		}
	}

	static getRecent(limit: number = 5): SearchHistoryItem[] {
		return this.getAll().slice(0, limit);
	}

	static clear(): void {
		try {
			if (typeof window !== "undefined") {
				localStorage.removeItem(this.getStorageKey());
			}
		} catch (error) {
			console.warn("Failed to clear search history:", error);
		}
	}

	static remove(query: string): void {
		const history = this.getAll();
		const filtered = history.filter(
			(item) => item.query.toLowerCase() !== query.toLowerCase()
		);
		this.save(filtered);
	}

	private static save(history: SearchHistoryItem[]): void {
		try {
			if (typeof window !== "undefined") {
				localStorage.setItem(this.getStorageKey(), JSON.stringify(history));
			}
		} catch (error) {
			console.warn("Failed to save search history:", error);
		}
	}

	static search(query: string, limit: number = 5): SearchHistoryItem[] {
		if (!query.trim()) return this.getRecent(limit);

		const history = this.getAll();
		const normalizedQuery = query.toLowerCase();

		return history
			.filter((item) =>
				item.query.toLowerCase().includes(normalizedQuery)
			)
			.slice(0, limit);
	}
}