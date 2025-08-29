import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";
import { useEffect } from "react";
import { StockPageContainer } from "@/components/stocks/stock-layout";
import { StockBreadcrumbs } from "@/components/stocks/stock-breadcrumbs";

export const Route = createFileRoute("/stocks/")({
	component: StockListPage,
	head: () => ({
		meta: [
			{
				title: "股票列表 - neostock",
			},
			{
				name: "description",
				content: "A股市场股票搜索和基本信息",
			},
		],
	}),
});

function StockListPage() {
	const { data: session, isPending } = authClient.useSession();
	const navigate = Route.useNavigate();

	useEffect(() => {
		if (!session && !isPending) {
			navigate({
				to: "/login",
			});
		}
	}, [session, isPending, navigate]);

	if (isPending) {
		return <div>Loading...</div>;
	}

	if (!session) {
		return null;
	}

	return (
		<StockPageContainer>
			<div className="mb-4">
				<StockBreadcrumbs />
			</div>
			<Card>
				<CardHeader>
					<CardTitle>股票列表</CardTitle>
					<CardDescription>
						浏览和搜索 A 股市场的股票信息
					</CardDescription>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground">
						股票搜索和列表功能正在开发中...
					</p>
				</CardContent>
			</Card>
		</StockPageContainer>
	);
}