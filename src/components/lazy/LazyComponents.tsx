'use client';

import { lazy, Suspense } from 'react';
import { Card, CardContent } from '@/components/ui/card';

// Lazy load heavy components that are not immediately needed
export const LazyAdminControlPanel = lazy(() => 
  import('@/components/auction/AdminControlPanel')
);

export const LazyBotManagementTab = lazy(() =>
  import('@/components/auction/BotManagementTab')
);

export const LazyAuditTrail = lazy(() =>
  import('@/components/auction/AuditTrail')
);

// Loading components
export const ComponentSkeleton = () => (
  <Card className="animate-pulse">
    <CardContent className="p-6">
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 rounded w-3/4"></div>
        <div className="h-4 bg-gray-200 rounded w-1/2"></div>
        <div className="h-4 bg-gray-200 rounded w-5/6"></div>
      </div>
    </CardContent>
  </Card>
);

// Wrapper components with suspense
export const SuspenseAdminControlPanel = (props: any) => (
  <Suspense fallback={<ComponentSkeleton />}>
    <LazyAdminControlPanel {...props} />
  </Suspense>
);

export const SuspenseBotManagementTab = (props: any) => (
  <Suspense fallback={<ComponentSkeleton />}>
    <LazyBotManagementTab {...props} />
  </Suspense>
);

export const SuspenseAuditTrail = (props: any) => (
  <Suspense fallback={<ComponentSkeleton />}>
    <LazyAuditTrail {...props} />
  </Suspense>
);