import { createFileRoute, useParams } from "@tanstack/react-router";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "@tanstack/react-router";
import { authClient } from "@/lib/auth-client";
import { useEffect } from "react";
import { StockPageContainer } from "@/components/stocks/stock-layout";
import { StockBreadcrumbs } from "@/components/stocks/stock-breadcrumbs";

export const Route = createFileRoute("/stocks/$symbol")({
	component: StockDetailPage,
	head: ({ params }: { params: { symbol: string } }) => ({
		meta: [
			{
				title: `${params.symbol} 股票详情 - neostock`,
			},
			{
				name: "description",
				content: `查看 ${params.symbol} 的详细信息、图表和技术分析`,
			},
		],
	}),
});

function StockDetailPage() {
	const { symbol } = useParams({ from: "/stocks/$symbol" });
	const router = useRouter();
	const { data: session, isPending } = authClient.useSession();
	const navigate = Route.useNavigate();

	useEffect(() => {
		if (!session && !isPending) {
			navigate({
				to: "/login",
			});
		}
	}, [session, isPending, navigate]);

	const handleBack = () => {
		router.history.back();
	};

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
			
			<div className="mb-6">
				<Button
					variant="ghost"
					onClick={handleBack}
					className="mb-4"
				>
					<ArrowLeft className="h-4 w-4 mr-2" />
					返回
				</Button>
			</div>

			<Card>
				<CardHeader>
					<div className="flex items-center justify-between">
						<div>
							<CardTitle className="text-2xl">{symbol}</CardTitle>
							<CardDescription>
								股票代码: {symbol}
							</CardDescription>
						</div>
						<Badge variant="secondary">A股</Badge>
					</div>
				</CardHeader>
				<CardContent>
					<p className="text-muted-foreground">
						股票详情页面正在开发中，将显示 {symbol} 的详细信息...
					</p>
				</CardContent>
			</Card>
		</StockPageContainer>
	);
}