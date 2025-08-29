import { Link, useRouterState } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import { cn } from "@/lib/utils";

interface BreadcrumbItem {
	label: string;
	href?: string;
	current?: boolean;
}

interface StockBreadcrumbsProps {
	items?: BreadcrumbItem[];
	className?: string;
}

export function StockBreadcrumbs({ items, className }: StockBreadcrumbsProps) {
	const routerState = useRouterState();
	
	const generateBreadcrumbs = (): BreadcrumbItem[] => {
		if (items) return items;

		const breadcrumbs: BreadcrumbItem[] = [
			{ label: "首页", href: "/" },
		];

		const pathname = routerState.location.pathname;

		if (pathname.startsWith("/stocks")) {
			breadcrumbs.push({ label: "股票", href: "/stocks" });
			
			if (pathname.match(/^\/stocks\/[^/]+$/)) {
				const symbol = pathname.split("/").pop();
				breadcrumbs.push({ label: symbol || "", current: true });
			}
		}

		return breadcrumbs;
	};

	const breadcrumbs = generateBreadcrumbs();

	return (
		<nav
			aria-label="Breadcrumb"
			className={cn("flex items-center space-x-1 text-sm text-muted-foreground", className)}
		>
			{breadcrumbs.map((item, index) => (
				<div key={index} className="flex items-center">
					{index > 0 && (
						<ChevronRight className="h-4 w-4 mx-1 text-muted-foreground/60" />
					)}
					{index === 0 && (
						<Home className="h-4 w-4 mr-1 text-muted-foreground/60" />
					)}
					{item.current ? (
						<span className="font-medium text-foreground">
							{item.label}
						</span>
					) : (
						<Link
							to={item.href || "/"}
							className="hover:text-foreground transition-colors"
						>
							{item.label}
						</Link>
					)}
				</div>
			))}
		</nav>
	);
}