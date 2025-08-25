import { createFileRoute } from '@tanstack/react-router'
import PerformanceDashboard from '@/components/performance/performance-dashboard'

export const Route = createFileRoute('/admin/performance')({
  component: PerformanceMonitoring,
})

function PerformanceMonitoring() {
  return (
    <div className="container mx-auto py-6">
      <PerformanceDashboard />
    </div>
  )
}